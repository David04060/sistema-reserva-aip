import { test } from "node:test";
import assert from "node:assert/strict";
import { agruparBloques } from "../src/domain/horario.ts";
import { leerRespuesta, mensajeError } from "../src/lib/http.ts";
import { mostrarFecha, mostrarFechaReserva } from "../src/lib/fechas.ts";

test("agrupa selecciones desordenadas sin atravesar los dos recesos", () => {
  assert.deepEqual(agruparBloques([9, 3, 1, 8, 6, 2, 5].map((bloqueId) => ({ bloqueId }))), [
    { horaInicio: "13:00", horaFin: "15:00" },
    { horaInicio: "15:10", horaFin: "16:30" },
    { horaInicio: "16:40", horaFin: "18:00" },
  ]);
});
test("no une bloques separados por un horario sin seleccionar", () => {
  assert.deepEqual(agruparBloques([{ bloqueId: 1 }, { bloqueId: 3 }]), [
    { horaInicio: "13:00", horaFin: "13:40" },
    { horaInicio: "14:20", horaFin: "15:00" },
  ]);
});
test("ignora recesos, identificadores inexistentes y duplicados", () => {
  assert.deepEqual(agruparBloques([4, 7, 0, 1, 1].map((bloqueId) => ({ bloqueId }))), [
    { horaInicio: "13:00", horaFin: "13:40" },
  ]);
  assert.deepEqual(agruparBloques([]), []);
});
test("las respuestas HTTP no JSON conservan el código de error", async () => {
  await assert.rejects(leerRespuesta(new Response("Bad gateway", { status: 502 })), /HTTP 502/);
  await assert.rejects(leerRespuesta(new Response("")), /respuesta inválida/);
  await assert.rejects(leerRespuesta(new Response("null")), /respuesta inválida/);
  await assert.rejects(leerRespuesta(new Response('"texto"')), /respuesta inválida/);
  assert.deepEqual(await leerRespuesta(new Response('{"mensaje":"Ocupado"}', { status: 409 })), {
    mensaje: "Ocupado",
  });
});
test("distingue errores de conexión de errores de servidor", () => {
  assert.match(mensajeError(new TypeError("Failed to fetch")), /conectar/);
  assert.equal(mensajeError(new Error("Servicio no disponible")), "Servicio no disponible");
});
test("las fechas de reserva se presentan en la zona horaria de Lima", () => {
  assert.equal(mostrarFecha("2026-10-12"), "12/10/2026");
  assert.match(mostrarFechaReserva("2026-10-13T02:30:00Z"), /12\/10\/26/);
});
