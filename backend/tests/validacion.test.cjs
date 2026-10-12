const { test } = require("node:test");
const assert = require("node:assert/strict");
const { fechaActualLima, obtenerDia } = require("../dist/domain/reservas");

test("la fecha actual usa Lima aunque el servidor esté en otra zona horaria", () => {
  assert.equal(fechaActualLima(new Date("2026-10-13T04:59:59Z")), "2026-10-12");
  assert.equal(fechaActualLima(new Date("2026-10-13T05:00:00Z")), "2026-10-13");
});
test("valida días reales, años bisiestos y el formato de fecha", () => {
  assert.equal(obtenerDia("2024-02-29"), "Jueves");
  for (const fecha of ["2026-02-29", "2099-02-30", "2026-13-01", "2026-1-01", "texto"]) {
    assert.equal(obtenerDia(fecha), null);
  }
});
