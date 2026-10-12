const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

process.env.DATABASE_PATH = ":memory:";
process.env.ADMIN_PASSWORD = "test-password";
process.env.JWT_SECRET = "test-secret-for-isolated-integration-tests";
const app = require("../dist/server").default;
const db = require("../dist/database").default;
let server;
let base;
before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  db.close();
});
const payload = (reservas = [{ horaInicio: "13:00", horaFin: "14:20" }]) => ({
  profesor: "Docente de prueba",
  area: "Comunicación",
  grado: "5",
  seccion: "A",
  fechaProgramada: "2099-10-12",
  reservas,
});
const post = (body, path = "/reservas/multiple") =>
  fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

test("reservas múltiples: validación, disponibilidad y administración", async (t) => {
  await t.test("rechaza el profesor vacío que causaba el 400", async () => {
    const response = await post({ ...payload(), profesor: "" });
    assert.equal(response.status, 400);
    assert.match((await response.json()).mensaje, /obligatorios/);
  });
  let grupoId;
  await t.test("crea bloques consecutivos y separados por recesos en un grupo", async () => {
    const response = await post(
      payload([
        { horaInicio: "13:00", horaFin: "15:00" },
        { horaInicio: "15:10", horaFin: "16:30" },
        { horaInicio: "16:40", horaFin: "18:00" },
      ]),
    );
    assert.equal(response.status, 201);
    grupoId = (await response.json()).grupoId;
    const reservas = await (await fetch(base + "/reservas/publicas")).json();
    assert.equal(reservas.length, 3);
    assert.equal(reservas[0].profesor, "Docente de prueba");
    assert.equal(reservas[0].dia, "Lunes");
    assert.equal(reservas[0].area, undefined);
  });
  await t.test("rechaza conflicto sin insertar parcialmente otros bloques", async () => {
    const response = await post(
      payload([
        { horaInicio: "13:00", horaFin: "13:40" },
        { horaInicio: "17:20", horaFin: "18:00" },
      ]),
    );
    assert.equal(response.status, 409);
    assert.equal(db.prepare("SELECT COUNT(*) AS total FROM reservas").get().total, 3);
  });
  await t.test("rechaza horarios que atraviesan un receso", async () => {
    assert.equal((await post(payload([{ horaInicio: "14:20", horaFin: "15:50" }]))).status, 400);
  });
  await t.test("rechaza horarios superpuestos en el mismo envío", async () => {
    assert.equal(
      (
        await post(
          payload([
            { horaInicio: "13:00", horaFin: "14:20" },
            { horaInicio: "13:40", horaFin: "14:20" },
          ]),
        )
      ).status,
      409,
    );
  });
  await t.test("valida fechas, campos y bloques", async () => {
    for (const change of [
      { fechaProgramada: "2099-02-30" },
      { fechaProgramada: "2000-01-03" },
      { fechaProgramada: "2099-10-11" },
      { reservas: [] },
      { reservas: [null] },
      { area: "a".repeat(101) },
      { reservas: [{ horaInicio: "12:00", horaFin: "13:40" }] },
    ])
      assert.equal((await post({ ...payload(), ...change })).status, 400);
  });
  await t.test("peticiones sin cuerpo y JSON mal formado devuelven JSON y 400", async () => {
    for (const path of ["/reservas", "/reservas/multiple", "/admin/login"]) {
      const response = await fetch(base + path, { method: "POST" });
      assert.equal(response.status, 400);
      assert.equal(typeof (await response.json()).mensaje, "string");
    }
    const response = await fetch(base + "/reservas/multiple", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).mensaje, /JSON/);
  });
  await t.test("protege administración y elimina el grupo completo con autenticación", async () => {
    assert.equal((await fetch(base + "/reservas/admin")).status, 401);
    const login = await post({ password: "test-password" }, "/admin/login");
    assert.equal(login.status, 200);
    const { token } = await login.json();
    const response = await fetch(base + `/reservas/grupo/${grupoId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).bloquesEliminados, 3);
    assert.equal(db.prepare("SELECT COUNT(*) AS total FROM reservas").get().total, 0);
  });
  await t.test("crea una reserva individual", async () => {
    assert.equal(
      (await post({ ...payload(), horaInicio: "13:00", horaFin: "13:40" }, "/reservas")).status,
      201,
    );
  });
  await t.test("un conflicto posterior no guarda parcialmente un bloque libre", async () => {
    const antes = db.prepare("SELECT COUNT(*) AS total FROM reservas").get().total;
    const response = await post(
      payload([
        { horaInicio: "15:10", horaFin: "15:50" },
        { horaInicio: "13:00", horaFin: "13:40" },
      ]),
    );
    assert.equal(response.status, 409);
    assert.equal(db.prepare("SELECT COUNT(*) AS total FROM reservas").get().total, antes);
  });
  await t.test("dos solicitudes simultáneas al mismo bloque solo crean una reserva", async () => {
    const responses = await Promise.all([
      post(payload([{ horaInicio: "17:20", horaFin: "18:00" }])),
      post(payload([{ horaInicio: "17:20", horaFin: "18:00" }])),
    ]);
    assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
  });
  await t.test("rechaza cuerpos inválidos y peticiones demasiado grandes", async () => {
    for (const body of [
      null,
      [],
      { ...payload(), reservas: Array(8).fill({ horaInicio: "13:00", horaFin: "13:40" }) },
    ]) {
      assert.equal((await post(body)).status, 400);
    }
    assert.equal((await post({ ...payload(), profesor: "x".repeat(110000) })).status, 413);
  });
});
