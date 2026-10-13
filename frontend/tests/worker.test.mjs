import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { SignJWT, jwtVerify } from "jose";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const domain = await build({
  entryPoints: [fileURLToPath(new URL("../../backend/src/domain/reservas.ts", import.meta.url))],
  bundle: true,
  write: false,
  format: "esm",
});
const { fechaActualLima, obtenerDia } = await import(
  `data:text/javascript;base64,${Buffer.from(domain.outputFiles[0].text).toString("base64")}`
);

const password = "test-password-only";
const jwtSecret = "test-only-secret-with-at-least-32-bytes";
const key = new TextEncoder().encode(jwtSecret);
let mf, db;
let nextIp = 1;
const { config, error: configError } = ts.parseConfigFileTextToJson(
  "wrangler.jsonc",
  await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
);
assert.equal(configError, undefined);
const fecha = (() => {
  const d = new Date(`${fechaActualLima()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  while (["Sábado", "Domingo"].includes(obtenerDia(d.toISOString().slice(0, 10))))
    d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
})();
const datos = (extra = {}) => ({
  profesor: "Docente",
  area: "Ciencia",
  grado: "1",
  seccion: "A",
  fechaProgramada: fecha,
  horaInicio: "13:00",
  horaFin: "13:40",
  ...extra,
});
async function request(path, { method = "GET", body, token, ip, headers = {} } = {}) {
  return mf.dispatchFetch(`https://aip.test${path}`, {
    method,
    headers: {
      "CF-Connecting-IP": ip || `192.0.2.${nextIp++}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
}
async function token() {
  return (await (await request("/api/admin/login", { method: "POST", body: { password } })).json())
    .token;
}
before(async () => {
  const bundle = await build({
    entryPoints: [fileURLToPath(new URL("../worker/index.ts", import.meta.url))],
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
  });
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: "aip-test",
      modules: true,
      script: bundle.outputFiles[0].text,
      compatibilityDate: config.compatibility_date,
      d1Databases: { DB: "test-reservas" },
      bindings: { ADMIN_PASSWORD: password, JWT_SECRET: jwtSecret },
      ratelimits: Object.fromEntries(config.ratelimits.map(({ name, ...value }) => [name, value])),
      assets: {
        directory: fileURLToPath(new URL("../dist/client", import.meta.url)),
        binding: config.assets.binding,
        run_worker_first: config.assets.run_worker_first,
        routerConfig: { has_user_worker: true },
        assetConfig: { not_found_handling: config.assets.not_found_handling },
      },
    }),
  );
  db = await mf.getD1Database("DB");
  const schema = await readFile(new URL("../schema.sql", import.meta.url), "utf8");
  // Keep trigger BEGIN...END intact; D1 exec splits on newlines.
  const statements = schema.match(
    /CREATE\s+(?:TABLE|INDEX)[\s\S]*?;|CREATE\s+TRIGGER[\s\S]*?END;/g,
  );
  for (const sql of statements) await db.prepare(sql).run();
});
after(async () => {
  await mf?.dispose();
});
beforeEach(async () => {
  await db.prepare("DELETE FROM reservas").run();
});

test("creación individual, disponibilidad pública y contrato administrativo", async () => {
  const response = await request("/api/reservas", { method: "POST", body: datos() });
  assert.equal(response.status, 201, await response.clone().text());
  const created = await response.json();
  assert.equal(typeof created.id, "number");
  assert.equal(typeof created.grupoId, "string");
  const publicas = await (await request("/api/reservas/publicas")).json();
  assert.deepEqual(publicas, [
    {
      dia: obtenerDia(fecha),
      fecha_programada: fecha,
      hora_inicio: "13:00",
      hora_fin: "13:40",
      profesor: "Docente",
    },
  ]);
  const admin = await token();
  for (const route of ["/api/reservas", "/api/reservas/admin"]) {
    const rows = await (await request(route, { token: admin })).json();
    assert.equal(rows[0].grupo_id, created.grupoId);
    assert.equal(rows[0].area, "Ciencia");
  }
  const occupied = await request("/api/reservas", { method: "POST", body: datos() });
  assert.equal(occupied.status, 409);
  assert.equal(
    (await occupied.json()).mensaje,
    "El horario 13:00 - 13:40 ya está reservado para esa fecha.",
  );
});

test("peticiones simultáneas dejan exactamente una reserva", async () => {
  const responses = await Promise.all(
    Array.from({ length: 12 }, () => request("/api/reservas", { method: "POST", body: datos() })),
  );
  assert.equal(responses.filter((r) => r.status === 201).length, 1);
  assert.equal(responses.filter((r) => r.status === 409).length, 11);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM reservas").first()).n, 1);
});

test("grupos: rollback después de insertar el primer intervalo, adyacencia y eliminación", async () => {
  await request("/api/reservas", {
    method: "POST",
    body: datos({ horaInicio: "14:20", horaFin: "15:00" }),
  });
  const failed = await request("/api/reservas/multiple", {
    method: "POST",
    body: datos({
      reservas: [
        { horaInicio: "13:00", horaFin: "13:40" },
        { horaInicio: "14:20", horaFin: "15:00" },
      ],
    }),
  });
  assert.equal(failed.status, 409);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM reservas").first()).n, 1);
  const created = await request("/api/reservas/multiple", {
    method: "POST",
    body: datos({
      reservas: [
        { horaInicio: "13:00", horaFin: "13:40" },
        { horaInicio: "13:40", horaFin: "14:20" },
      ],
    }),
  });
  assert.equal(created.status, 201);
  const group = await created.json();
  assert.equal("id" in group, false);
  const deleted = await request(`/api/reservas/grupo/${group.grupoId}`, {
    method: "DELETE",
    token: await token(),
  });
  assert.deepEqual(await deleted.json(), {
    mensaje: "Reserva eliminada correctamente.",
    bloquesEliminados: 2,
  });
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM reservas").first()).n, 1);
});

test("grupos concurrentes superpuestos no dejan escrituras parciales", async () => {
  const payloads = [
    [
      { horaInicio: "13:00", horaFin: "13:40" },
      { horaInicio: "14:20", horaFin: "15:00" },
    ],
    [
      { horaInicio: "13:40", horaFin: "14:20" },
      { horaInicio: "14:20", horaFin: "15:00" },
    ],
  ];
  const responses = await Promise.all(
    payloads.map((reservas) =>
      request("/api/reservas/multiple", { method: "POST", body: datos({ reservas }) }),
    ),
  );
  assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
  const rows = (await db.prepare("SELECT grupo_id FROM reservas").all()).results;
  assert.equal(rows.length, 2);
  assert.equal(new Set(rows.map((r) => r.grupo_id)).size, 1);
});

test("el trigger D1 rechaza SQL directo solapado y UPDATE; permite adyacencia", async () => {
  const created = await (await request("/api/reservas", { method: "POST", body: datos() })).json();
  const copy = (inicio, fin) =>
    db
      .prepare(
        "INSERT INTO reservas (grupo_id,profesor,area,grado,seccion,dia,fecha_programada,hora_inicio,hora_fin,fecha_reserva) SELECT grupo_id,profesor,area,grado,seccion,dia,fecha_programada,?,?,fecha_reserva FROM reservas WHERE id = ?",
      )
      .bind(inicio, fin, created.id);
  await assert.rejects(copy("13:20", "13:50").run(), /HORARIO_OCUPADO/);
  const adjacent = await copy("13:40", "14:20").run();
  await assert.rejects(
    db
      .prepare("UPDATE reservas SET hora_inicio = ? WHERE id = ?")
      .bind("13:30", adjacent.meta.last_row_id)
      .run(),
    /HORARIO_OCUPADO/,
  );
  await assert.rejects(
    db.batch([copy("14:20", "15:00"), copy("13:10", "13:30")]),
    /HORARIO_OCUPADO/,
  );
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM reservas").first()).n, 2);
});

test("autenticación, expiración, firma, rol, limitador y eliminación individual", async () => {
  assert.equal((await request("/api/admin/login", { method: "POST", body: {} })).status, 400);
  assert.equal(
    (await request("/api/admin/login", { method: "POST", body: { password: "incorrect" } })).status,
    401,
  );
  const admin = await token();
  const { payload } = await jwtVerify(admin, key);
  assert.equal(payload.exp - payload.iat, 7200);
  const expired = await new SignJWT({ rol: "administrador" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(1)
    .sign(key);
  const wrongRole = await new SignJWT({ rol: "usuario" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("2h")
    .sign(key);
  const wrongSignature = await new SignJWT({ rol: "administrador" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("2h")
    .sign(new TextEncoder().encode("different-secret"));
  for (const [value, status] of [
    [undefined, 401],
    [expired, 401],
    [wrongRole, 403],
    [wrongSignature, 401],
  ]) {
    assert.equal((await request("/api/reservas/admin", { token: value })).status, status);
    assert.equal(
      (await request("/api/reservas/1", { method: "DELETE", token: value })).status,
      status,
    );
    assert.equal(
      (await request("/api/reservas/grupo/example", { method: "DELETE", token: value })).status,
      status,
    );
  }
  const created = await (await request("/api/reservas", { method: "POST", body: datos() })).json();
  assert.equal((await request("/api/reservas/0", { method: "DELETE", token: admin })).status, 400);
  assert.equal(
    (await request(`/api/reservas/${created.id}`, { method: "DELETE", token: admin })).status,
    200,
  );
  assert.equal(
    (await request(`/api/reservas/${created.id}`, { method: "DELETE", token: admin })).status,
    404,
  );
  const attempts = [];
  for (let i = 0; i < 6; i++)
    attempts.push(
      await request("/api/admin/login", {
        method: "POST",
        body: { password: "wrong" },
        ip: "198.51.100.1",
      }),
    );
  assert.deepEqual(
    attempts.map((r) => r.status),
    [401, 401, 401, 401, 401, 429],
  );
  assert.equal(attempts[5].headers.get("Retry-After"), "60");
});

test("recesos, fines de semana, fechas, campos y superposición interna", async () => {
  for (const [inicio, fin] of [
    ["14:20", "15:50"],
    ["15:50", "17:20"],
    ["15:00", "15:10"],
    ["16:30", "16:40"],
  ]) {
    assert.equal(
      (
        await request("/api/reservas/multiple", {
          method: "POST",
          body: datos({ reservas: [{ horaInicio: inicio, horaFin: fin }] }),
        })
      ).status,
      400,
    );
  }
  for (const extra of [
    { fechaProgramada: "2020-01-01" },
    { fechaProgramada: "2099-02-30" },
    { fechaProgramada: "2099-10-10" },
    { profesor: " " },
    { profesor: "x".repeat(101) },
  ]) {
    assert.equal(
      (await request("/api/reservas", { method: "POST", body: datos(extra) })).status,
      400,
    );
  }
  assert.equal(fechaActualLima(new Date("2026-10-13T04:59:00Z")), "2026-10-12");
  assert.equal(fechaActualLima(new Date("2026-10-13T05:00:00Z")), "2026-10-13");
  assert.equal(
    (
      await request("/api/reservas/multiple", {
        method: "POST",
        body: datos({
          reservas: [
            { horaInicio: "13:00", horaFin: "14:20" },
            { horaInicio: "13:40", horaFin: "14:20" },
          ],
        }),
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request("/api/reservas/multiple", {
        method: "POST",
        body: datos({
          reservas: [
            { horaInicio: "13:00", horaFin: "15:00" },
            { horaInicio: "15:10", horaFin: "16:30" },
            { horaInicio: "16:40", horaFin: "18:00" },
          ],
        }),
      })
    ).status,
    201,
  );
});

test("SPA, API desconocida, mismo origen, JSON inválido y límite del cuerpo", async () => {
  for (const path of ["/", "/horario", "/admin", "/ruta-profunda"]) {
    const res = await request(path);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("Content-Type"), /text\/html/);
    assert.match(await res.text(), /id="root"/);
  }
  for (const path of ["/api", "/api/inexistente"]) {
    const res = await request(path);
    assert.equal(res.status, 404);
    assert.match(res.headers.get("Content-Type"), /application\/json/);
  }
  assert.equal(
    (await request("/api/reservas/publicas", { headers: { Origin: "https://other.test" } })).status,
    403,
  );
  const same = await request("/api/reservas/publicas", { headers: { Origin: "https://aip.test" } });
  assert.equal(same.status, 200);
  assert.equal(same.headers.get("Access-Control-Allow-Origin"), null);
  assert.equal((await request("/api/reservas", { method: "POST", body: "{" })).status, 400);
  assert.equal(
    (await request("/api/reservas", { method: "POST", body: "x".repeat(102401) })).status,
    413,
  );
});
