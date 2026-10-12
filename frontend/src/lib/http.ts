export async function leerRespuesta<T>(respuesta: Response): Promise<T> {
  const texto = await respuesta.text();
  try {
    const datos: unknown = JSON.parse(texto);
    if (datos === null || typeof datos !== "object") throw new Error("Respuesta inválida");
    return datos as T;
  } catch {
    throw new Error(
      respuesta.ok
        ? "El servidor devolvió una respuesta inválida. Intente actualizar la página."
        : `El servidor no pudo completar la solicitud (HTTP ${respuesta.status}).`,
    );
  }
}

export function mensajeError(error: unknown): string {
  return error instanceof TypeError
    ? "No se pudo conectar con el servidor. Compruebe su conexión e intente nuevamente."
    : error instanceof Error
      ? error.message
      : "No se pudo completar la solicitud.";
}
