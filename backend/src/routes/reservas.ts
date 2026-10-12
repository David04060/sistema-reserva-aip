import { Router, type RequestHandler } from "express";
import { randomUUID } from "crypto";
import db from "../database";
import { verificarAdministrador } from "../middleware/adminAuth";
import { ErrorReserva, validarReserva } from "../domain/reservas";

const router = Router();
const comprobarDisponibilidad = db.prepare(`
  SELECT id FROM reservas
  WHERE fecha_programada = ? AND hora_inicio < ? AND hora_fin > ? LIMIT 1
`);
const insertar = db.prepare(`
  INSERT INTO reservas (
    grupo_id, profesor, area, grado, seccion, dia,
    fecha_programada, hora_inicio, hora_fin, fecha_reserva
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

router.get("/publicas", (_req, res) => {
  res.json(
    db
      .prepare(
        `
    SELECT dia, fecha_programada, hora_inicio, hora_fin, profesor
    FROM reservas ORDER BY fecha_programada, hora_inicio
  `,
      )
      .all(),
  );
});

function crearReserva(multiple: boolean): RequestHandler {
  return (req, res, next) => {
    try {
      const datos = validarReserva(req.body, multiple);
      const grupoId = randomUUID();
      const fechaReserva = new Date().toISOString();
      // La disponibilidad y la escritura comparten el bloqueo de la transacción.
      const guardar = db.transaction(() => {
        for (const reserva of datos.reservas) {
          if (
            comprobarDisponibilidad.get(datos.fechaProgramada, reserva.horaFin, reserva.horaInicio)
          ) {
            throw new ErrorReserva(
              409,
              `El horario ${reserva.horaInicio} - ${reserva.horaFin} ya está reservado para esa fecha.`,
            );
          }
        }
        return datos.reservas.map(
          (reserva) =>
            insertar.run(
              grupoId,
              datos.profesor,
              datos.area,
              datos.grado,
              datos.seccion,
              datos.dia,
              datos.fechaProgramada,
              reserva.horaInicio,
              reserva.horaFin,
              fechaReserva,
            ).lastInsertRowid,
        );
      });
      const ids = guardar.immediate();
      res.status(201).json({
        mensaje: multiple
          ? "Reservas realizadas correctamente."
          : "Reserva realizada correctamente.",
        grupoId,
        ...(multiple ? {} : { id: ids[0] }),
      });
    } catch (error) {
      if (error instanceof ErrorReserva) {
        res.status(error.status).json({ mensaje: error.message });
      } else {
        next(error);
      }
    }
  };
}

router.post("/", crearReserva(false));
router.post("/multiple", crearReserva(true));

const listarReservas: RequestHandler = (_req, res) => {
  res.json(db.prepare("SELECT * FROM reservas ORDER BY fecha_programada, hora_inicio").all());
};
router.get("/admin", verificarAdministrador, listarReservas);
router.get("/", verificarAdministrador, listarReservas);

router.delete("/grupo/:grupoId", verificarAdministrador, (req, res) => {
  const grupoId = req.params.grupoId;
  if (typeof grupoId !== "string" || !grupoId.trim() || grupoId.length > 100) {
    return res.status(400).json({ mensaje: "Grupo de reserva inválido." });
  }
  const resultado = db.prepare("DELETE FROM reservas WHERE grupo_id = ?").run(grupoId);
  if (!resultado.changes) return res.status(404).json({ mensaje: "La reserva no existe." });
  return res.json({
    mensaje: "Reserva eliminada correctamente.",
    bloquesEliminados: resultado.changes,
  });
});

router.delete("/:id", verificarAdministrador, (req, res) => {
  const parametro = req.params.id;
  if (
    typeof parametro !== "string" ||
    !/^[1-9]\d*$/.test(parametro) ||
    !Number.isSafeInteger(Number(parametro))
  ) {
    return res.status(400).json({ mensaje: "ID de reserva inválido." });
  }
  const resultado = db.prepare("DELETE FROM reservas WHERE id = ?").run(Number(parametro));
  if (!resultado.changes) return res.status(404).json({ mensaje: "La reserva no existe." });
  return res.json({ mensaje: "Reserva eliminada correctamente." });
});

export default router;
