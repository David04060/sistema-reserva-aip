import { SignJWT, jwtVerify } from "jose";
import { ErrorReserva, validarReserva } from "../../backend/src/domain/reservas";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ADMIN_LOGIN_LIMITER: RateLimit;
  ADMIN_PASSWORD: string;
  JWT_SECRET: string;
}

const json = (data: unknown, status = 200, headers: HeadersInit = {}) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers },
  });
const fallo = (status: number, mensaje: string) => json({ mensaje }, status);
const secret = (env: Env) => new TextEncoder().encode(env.JWT_SECRET);

async function body(request: Request): Promise<unknown> {
  // Limit the stream too: Content-Length can be absent or untrusted.
  const reader = request.body?.getReader();
  if (!reader) return {};
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 100 * 1024) {
      await reader.cancel();
      throw new ErrorReserva(413, "La petición supera el tamaño permitido.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return size ? JSON.parse(new TextDecoder().decode(bytes)) : {};
  } catch {
    throw new ErrorReserva(400, "El cuerpo de la petición contiene JSON inválido.");
  }
}

async function autorizar(request: Request, env: Env): Promise<Response | undefined> {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return fallo(401, "No autorizado.");
  const token = authorization.substring(7).trim();
  if (!token) return fallo(401, "Token no proporcionado.");
  if (!env.JWT_SECRET) return fallo(500, "La autenticación del servidor no está configurada.");
  try {
    const { payload } = await jwtVerify(token, secret(env), {
      algorithms: ["HS256"],
      requiredClaims: ["exp"],
    });
    if (payload.rol !== "administrador") return fallo(403, "No tiene permisos de administrador.");
  } catch {
    return fallo(401, "La sesión de administrador no es válida o ha expirado.");
  }
}

async function login(request: Request, env: Env): Promise<Response> {
  const { success } = await env.ADMIN_LOGIN_LIMITER.limit({
    key: request.headers.get("CF-Connecting-IP") || "local",
  });
  if (!success)
    return json(
      { mensaje: "Demasiados intentos de inicio de sesión. Intente nuevamente más tarde." },
      429,
      { "Retry-After": "60" },
    );
  const datos = await body(request);
  const password = (datos as { password?: unknown } | null)?.password;
  if (!env.ADMIN_PASSWORD || !env.JWT_SECRET)
    return fallo(500, "La autenticación del servidor no está configurada.");
  if (typeof password !== "string" || !password.length)
    return fallo(400, "Debe ingresar una contraseña.");
  if (password.length > 200) return fallo(400, "La contraseña no es válida.");
  // Compare fixed-length digests without an early exit on differing characters.
  const digest = async (value: string) =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  const [provided, expected] = await Promise.all([digest(password), digest(env.ADMIN_PASSWORD)]);
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= provided[i] ^ expected[i];
  if (difference) return fallo(401, "Contraseña incorrecta.");
  const token = await new SignJWT({ rol: "administrador" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(secret(env));
  return json({ mensaje: "Inicio de sesión correcto.", token });
}

function conflicto(error: unknown): boolean {
  return (
    error instanceof Error && (error.message.includes("HORARIO_OCUPADO") || conflicto(error.cause))
  );
}

async function crear(request: Request, env: Env, multiple: boolean): Promise<Response> {
  const datos = validarReserva(await body(request), multiple);
  const grupoId = crypto.randomUUID();
  const fechaReserva = new Date().toISOString();
  const insertar = env.DB.prepare(`INSERT INTO reservas (
    grupo_id, profesor, area, grado, seccion, dia,
    fecha_programada, hora_inicio, hora_fin, fecha_reserva
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  try {
    // The SQL trigger is the authority; a SELECT before INSERT cannot prevent races.
    const resultados = await env.DB.batch(
      datos.reservas.map((r) =>
        insertar.bind(
          grupoId,
          datos.profesor,
          datos.area,
          datos.grado,
          datos.seccion,
          datos.dia,
          datos.fechaProgramada,
          r.horaInicio,
          r.horaFin,
          fechaReserva,
        ),
      ),
    );
    return json(
      {
        mensaje: multiple
          ? "Reservas realizadas correctamente."
          : "Reserva realizada correctamente.",
        grupoId,
        ...(multiple ? {} : { id: resultados[0].meta.last_row_id }),
      },
      201,
    );
  } catch (error) {
    if (!conflicto(error)) throw error;
    // Only used to preserve the existing error message, never to enforce exclusivity.
    for (const r of datos.reservas) {
      const ocupado = await env.DB.prepare(
        "SELECT id FROM reservas WHERE fecha_programada = ? AND hora_inicio < ? AND hora_fin > ? LIMIT 1",
      )
        .bind(datos.fechaProgramada, r.horaFin, r.horaInicio)
        .first();
      if (ocupado)
        return fallo(
          409,
          `El horario ${r.horaInicio} - ${r.horaFin} ya está reservado para esa fecha.`,
        );
    }
    return fallo(409, "Los horarios seleccionados se superponen.");
  }
}

async function api(request: Request, env: Env, path: string): Promise<Response> {
  const method = request.method;
  if (method === "POST" && path === "/api/admin/login") return login(request, env);
  if (method === "GET" && path === "/api/reservas/publicas") {
    const { results } = await env.DB.prepare(
      "SELECT dia, fecha_programada, hora_inicio, hora_fin, profesor FROM reservas ORDER BY fecha_programada, hora_inicio",
    ).all();
    return json(results);
  }
  if (method === "POST" && (path === "/api/reservas" || path === "/api/reservas/multiple"))
    return crear(request, env, path.endsWith("/multiple"));
  const grupo = method === "DELETE" ? /^\/api\/reservas\/grupo\/([^/]+)$/.exec(path) : null;
  const individual = method === "DELETE" ? /^\/api\/reservas\/([^/]+)$/.exec(path) : null;
  const listar = method === "GET" && (path === "/api/reservas" || path === "/api/reservas/admin");
  if (!listar && !grupo && !individual) return fallo(404, "La ruta solicitada no existe.");
  const unauthorized = await autorizar(request, env);
  if (unauthorized) return unauthorized;
  if (listar) {
    const { results } = await env.DB.prepare(
      "SELECT * FROM reservas ORDER BY fecha_programada, hora_inicio",
    ).all();
    return json(results);
  }
  let parametro: string;
  try {
    parametro = decodeURIComponent((grupo || individual)![1]);
  } catch {
    return fallo(400, grupo ? "Grupo de reserva inválido." : "ID de reserva inválido.");
  }
  if (
    grupo
      ? !parametro.trim() || parametro.length > 100
      : !/^[1-9]\d*$/.test(parametro) || !Number.isSafeInteger(Number(parametro))
  )
    return fallo(400, grupo ? "Grupo de reserva inválido." : "ID de reserva inválido.");
  const resultado = await env.DB.prepare(
    grupo ? "DELETE FROM reservas WHERE grupo_id = ?" : "DELETE FROM reservas WHERE id = ?",
  )
    .bind(grupo ? parametro : Number(parametro))
    .run();
  if (!resultado.meta.changes) return fallo(404, "La reserva no existe.");
  return json({
    mensaje: "Reserva eliminada correctamente.",
    ...(grupo ? { bloquesEliminados: resultado.meta.changes } : {}),
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (path !== "/api" && !path.startsWith("/api/")) return env.ASSETS.fetch(request);
    // No cross-origin API access or permissive CORS headers.
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin) return fallo(403, "Origen no permitido.");
    try {
      return await api(request, env, path);
    } catch (error) {
      if (error instanceof ErrorReserva) return fallo(error.status, error.message);
      console.error(
        "Error interno de la API",
        error instanceof Error ? error.message : "Error desconocido",
      );
      return fallo(500, "Ocurrió un error interno en el servidor.");
    }
  },
};
