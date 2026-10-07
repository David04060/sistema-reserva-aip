import { Router } from "express";
import { randomUUID } from "crypto";

import db from "../database";
import { verificarAdministrador } from "../middleware/adminAuth";

const router = Router();

/*
|--------------------------------------------------------------------------
| DÍAS PERMITIDOS
|--------------------------------------------------------------------------
*/

const diasPermitidos = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes"
];

/*
|--------------------------------------------------------------------------
| HORARIOS PERMITIDOS
|--------------------------------------------------------------------------
*/

const horariosPermitidos = [
  {
    inicio: "13:00",
    fin: "13:40"
  },
  {
    inicio: "13:40",
    fin: "14:20"
  },
  {
    inicio: "14:20",
    fin: "15:00"
  },
  {
    inicio: "15:10",
    fin: "15:50"
  },
  {
    inicio: "15:50",
    fin: "16:30"
  },
  {
    inicio: "16:40",
    fin: "17:20"
  },
  {
    inicio: "17:20",
    fin: "18:00"
  }
];

/*
|--------------------------------------------------------------------------
| OBTENER DÍA DE UNA FECHA
|--------------------------------------------------------------------------
*/

function obtenerDiaDeFecha(
  fecha: string
): string | null {

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(fecha)
  ) {
    return null;
  }

  const partes =
    fecha.split("-").map(Number);

  const año = partes[0];
  const mes = partes[1];
  const dia = partes[2];

  const fechaObjeto =
    new Date(
      año,
      mes - 1,
      dia,
      12,
      0,
      0
    );

  /*
  |--------------------------------------------------------------------------
  | COMPROBAR QUE LA FECHA REALMENTE EXISTE
  |--------------------------------------------------------------------------
  */

  if (
    fechaObjeto.getFullYear() !== año ||
    fechaObjeto.getMonth() !== mes - 1 ||
    fechaObjeto.getDate() !== dia
  ) {
    return null;
  }

  const dias = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado"
  ];

  return dias[
    fechaObjeto.getDay()
  ];
}

/*
|--------------------------------------------------------------------------
| VALIDAR FECHA
|--------------------------------------------------------------------------
*/

function fechaValida(
  fecha: string
): boolean {

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(fecha)
  ) {
    return false;
  }

  const partes =
    fecha.split("-").map(Number);

  const año = partes[0];
  const mes = partes[1];
  const dia = partes[2];

  const fechaObjeto =
    new Date(
      año,
      mes - 1,
      dia,
      12,
      0,
      0
    );

  /*
  |--------------------------------------------------------------------------
  | FECHA INEXISTENTE
  |--------------------------------------------------------------------------
  */

  if (
    fechaObjeto.getFullYear() !== año ||
    fechaObjeto.getMonth() !== mes - 1 ||
    fechaObjeto.getDate() !== dia
  ) {
    return false;
  }

  /*
  |--------------------------------------------------------------------------
  | FECHA ACTUAL
  |--------------------------------------------------------------------------
  */

  const hoy = new Date();

  const hoyObjeto =
    new Date(
      hoy.getFullYear(),
      hoy.getMonth(),
      hoy.getDate(),
      12,
      0,
      0
    );

  /*
  |--------------------------------------------------------------------------
  | NO PERMITIR FECHAS PASADAS
  |--------------------------------------------------------------------------
  */

  return fechaObjeto >= hoyObjeto;
}

/*
|--------------------------------------------------------------------------
| VALIDAR HORARIO INDIVIDUAL
|--------------------------------------------------------------------------
*/

function horarioPermitido(
  horaInicio: string,
  horaFin: string
): boolean {

  return horariosPermitidos.some(
    (horario) =>
      horario.inicio === horaInicio &&
      horario.fin === horaFin
  );
}

/*
|--------------------------------------------------------------------------
| VALIDAR INTERVALO DE BLOQUES
|--------------------------------------------------------------------------
*/

function bloquesValidos(
  horaInicio: string,
  horaFin: string
): boolean {

  let encontrado = false;

  let horaActual = horaInicio;

  for (
    const horario of horariosPermitidos
  ) {

    if (
      !encontrado &&
      horario.inicio === horaInicio
    ) {

      encontrado = true;

      horaActual =
        horario.fin;

      if (
        horaActual === horaFin
      ) {
        return true;
      }

      continue;
    }

    if (
      encontrado &&
      horario.inicio === horaActual
    ) {

      horaActual =
        horario.fin;

      if (
        horaActual === horaFin
      ) {
        return true;
      }
    }
  }

  return false;
}

/*
|--------------------------------------------------------------------------
| VALIDAR DATOS GENERALES
|--------------------------------------------------------------------------
*/

function validarDatosGenerales(
  profesor: unknown,
  area: unknown,
  grado: unknown,
  seccion: unknown
) {

  if (
    typeof profesor !== "string" ||
    typeof area !== "string" ||
    typeof grado !== "string" ||
    typeof seccion !== "string"
  ) {

    return {
      valido: false,
      mensaje:
        "Datos de reserva inválidos."
    };
  }

  const profesorLimpio =
    profesor.trim();

  const areaLimpia =
    area.trim();

  const gradoLimpio =
    grado.trim();

  const seccionLimpia =
    seccion.trim();

  if (
    profesorLimpio === "" ||
    areaLimpia === "" ||
    gradoLimpio === "" ||
    seccionLimpia === ""
  ) {

    return {
      valido: false,
      mensaje:
        "Todos los campos son obligatorios."
    };
  }

  /*
  |--------------------------------------------------------------------------
  | LONGITUDES MÁXIMAS
  |--------------------------------------------------------------------------
  */

  if (
    profesorLimpio.length > 100 ||
    areaLimpia.length > 100 ||
    gradoLimpio.length > 30 ||
    seccionLimpia.length > 20
  ) {

    return {
      valido: false,
      mensaje:
        "Uno de los campos supera la longitud permitida."
    };
  }

  return {
    valido: true,
    profesorLimpio,
    areaLimpia,
    gradoLimpio,
    seccionLimpia
  };
}

/*
|--------------------------------------------------------------------------
| RESERVAS PÚBLICAS
|--------------------------------------------------------------------------
*/

router.get(
  "/publicas",
  (req, res) => {

    try {

      const reservas =
        db.prepare(`
          SELECT
            dia,
            fecha_programada,
            hora_inicio,
            hora_fin,
            profesor
          FROM reservas
          ORDER BY
            fecha_programada,
            hora_inicio
        `).all();

      return res.json(
        reservas
      );

    } catch (error) {

      console.error(error);

      return res.status(500).json({
        mensaje:
          "No se pudieron obtener las reservas."
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| CREAR UNA RESERVA
|--------------------------------------------------------------------------
*/

router.post(
  "/",
  (req, res) => {

    const {
      profesor,
      area,
      grado,
      seccion,
      fechaProgramada,
      horaInicio,
      horaFin
    } = req.body;

    const datos =
      validarDatosGenerales(
        profesor,
        area,
        grado,
        seccion
      );

    if (!datos.valido) {

      return res.status(400).json({
        mensaje:
          datos.mensaje
      });
    }

    if (
      typeof fechaProgramada !== "string" ||
      typeof horaInicio !== "string" ||
      typeof horaFin !== "string"
    ) {

      return res.status(400).json({
        mensaje:
          "Datos de reserva inválidos."
      });
    }

    /*
    |--------------------------------------------------------------------------
    | FECHA
    |--------------------------------------------------------------------------
    */

    if (
      !fechaValida(
        fechaProgramada
      )
    ) {

      return res.status(400).json({
        mensaje:
          "La fecha no es válida o corresponde a una fecha pasada."
      });
    }

    /*
    |--------------------------------------------------------------------------
    | DÍA
    |--------------------------------------------------------------------------
    */

    const dia =
      obtenerDiaDeFecha(
        fechaProgramada
      );

    if (
      !dia ||
      !diasPermitidos.includes(dia)
    ) {

      return res.status(400).json({
        mensaje:
          "Solo se pueden realizar reservas de lunes a viernes."
      });
    }

    /*
    |--------------------------------------------------------------------------
    | HORARIO
    |--------------------------------------------------------------------------
    */

    if (
      !horarioPermitido(
        horaInicio,
        horaFin
      )
    ) {

      return res.status(400).json({
        mensaje:
          "El horario seleccionado no es válido."
      });
    }

    /*
    |--------------------------------------------------------------------------
    | COMPROBAR DISPONIBILIDAD
    |--------------------------------------------------------------------------
    */

    const reservaExistente =
      db.prepare(`
        SELECT id
        FROM reservas
        WHERE fecha_programada = ?
          AND hora_inicio < ?
          AND hora_fin > ?
        LIMIT 1
      `).get(
        fechaProgramada,
        horaFin,
        horaInicio
      );

    if (reservaExistente) {

      return res.status(409).json({
        mensaje:
          "El horario seleccionado ya está reservado para esa fecha."
      });
    }

    /*
    |--------------------------------------------------------------------------
    | CREAR RESERVA
    |--------------------------------------------------------------------------
    */

    const grupoId =
      randomUUID();

    const fechaReserva =
      new Date().toISOString();

    const resultado =
      db.prepare(`
        INSERT INTO reservas (
          grupo_id,
          profesor,
          area,
          grado,
          seccion,
          dia,
          fecha_programada,
          hora_inicio,
          hora_fin,
          fecha_reserva
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        grupoId,
        datos.profesorLimpio,
        datos.areaLimpia,
        datos.gradoLimpio,
        datos.seccionLimpia,
        dia,
        fechaProgramada,
        horaInicio,
        horaFin,
        fechaReserva
      );

    return res.status(201).json({
      mensaje:
        "Reserva realizada correctamente.",
      id:
        resultado.lastInsertRowid,
      grupoId
    });
  }
);

/*
|--------------------------------------------------------------------------
| CREAR MÚLTIPLES RESERVAS
|--------------------------------------------------------------------------
*/

router.post(
  "/multiple",
  (req, res) => {

    const {
      profesor,
      area,
      grado,
      seccion,
      fechaProgramada,
      reservas
    } = req.body;

    const datos =
      validarDatosGenerales(
        profesor,
        area,
        grado,
        seccion
      );

    if (!datos.valido) {

      return res.status(400).json({
        mensaje:
          datos.mensaje
      });
    }

    if (
      typeof fechaProgramada !== "string" ||
      !Array.isArray(reservas)
    ) {

      return res.status(400).json({
        mensaje:
          "Datos de reserva inválidos."
      });
    }

    /*
    |--------------------------------------------------------------------------
    | CANTIDAD DE BLOQUES
    |--------------------------------------------------------------------------
    */

    if (
      reservas.length === 0
    ) {

      return res.status(400).json({
        mensaje:
          "Debe seleccionar al menos un horario."
      });
    }

    if (
      reservas.length > 35
    ) {

      return res.status(400).json({
        mensaje:
          "Se seleccionaron demasiados horarios."
      });
    }

    /*
    |--------------------------------------------------------------------------
    | FECHA
    |--------------------------------------------------------------------------
    */

    if (
      !fechaValida(
        fechaProgramada
      )
    ) {

      return res.status(400).json({
        mensaje:
          "La fecha no es válida o corresponde a una fecha pasada."
      });
    }

    /*
    |--------------------------------------------------------------------------
    | DÍA
    |--------------------------------------------------------------------------
    */

    const dia =
      obtenerDiaDeFecha(
        fechaProgramada
      );

    if (
      !dia ||
      !diasPermitidos.includes(dia)
    ) {

      return res.status(400).json({
        mensaje:
          "Solo se pueden realizar reservas de lunes a viernes."
      });
    }

    /*
    |--------------------------------------------------------------------------
    | VALIDAR CADA HORARIO
    |--------------------------------------------------------------------------
    */

    for (
      const reserva of reservas
    ) {

      if (
        typeof reserva !== "object" ||
        reserva === null ||
        typeof reserva.horaInicio !== "string" ||
        typeof reserva.horaFin !== "string"
      ) {

        return res.status(400).json({
          mensaje:
            "Uno de los horarios enviados no es válido."
        });
      }

      const horarioIndividual =
        horarioPermitido(
          reserva.horaInicio,
          reserva.horaFin
        );

      const intervaloValido =
        bloquesValidos(
          reserva.horaInicio,
          reserva.horaFin
        );

      if (
        !horarioIndividual &&
        !intervaloValido
      ) {

        return res.status(400).json({
          mensaje:
            "Uno de los horarios seleccionados no es válido."
        });
      }
    }

    /*
    |--------------------------------------------------------------------------
    | EVITAR DUPLICADOS DENTRO DE LA MISMA PETICIÓN
    |--------------------------------------------------------------------------
    */

    for (
      let i = 0;
      i < reservas.length;
      i++
    ) {

      for (
        let j = i + 1;
        j < reservas.length;
        j++
      ) {

        const reservaA =
          reservas[i];

        const reservaB =
          reservas[j];

        if (
          reservaA.horaInicio <
            reservaB.horaFin &&
          reservaA.horaFin >
            reservaB.horaInicio
        ) {

          return res.status(409).json({
            mensaje:
              "Los horarios seleccionados se superponen."
          });
        }
      }
    }

    /*
    |--------------------------------------------------------------------------
    | COMPROBAR BASE DE DATOS
    |--------------------------------------------------------------------------
    */

    for (
      const reserva of reservas
    ) {

      const reservaExistente =
        db.prepare(`
          SELECT id
          FROM reservas
          WHERE fecha_programada = ?
            AND hora_inicio < ?
            AND hora_fin > ?
          LIMIT 1
        `).get(
          fechaProgramada,
          reserva.horaFin,
          reserva.horaInicio
        );

      if (
        reservaExistente
      ) {

        return res.status(409).json({
          mensaje:
            `El horario ${reserva.horaInicio} - ${reserva.horaFin} ya está reservado para esa fecha.`
        });
      }
    }

    /*
    |--------------------------------------------------------------------------
    | CREAR GRUPO
    |--------------------------------------------------------------------------
    */

    const grupoId =
      randomUUID();

    const fechaReserva =
      new Date().toISOString();

    const insertar =
      db.prepare(`
        INSERT INTO reservas (
          grupo_id,
          profesor,
          area,
          grado,
          seccion,
          dia,
          fecha_programada,
          hora_inicio,
          hora_fin,
          fecha_reserva
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

    /*
    |--------------------------------------------------------------------------
    | TRANSACCIÓN
    |--------------------------------------------------------------------------
    */

    const insertarReservas =
      db.transaction(() => {

        for (
          const reserva of reservas
        ) {

          insertar.run(
            grupoId,
            datos.profesorLimpio,
            datos.areaLimpia,
            datos.gradoLimpio,
            datos.seccionLimpia,
            dia,
            fechaProgramada,
            reserva.horaInicio,
            reserva.horaFin,
            fechaReserva
          );
        }
      });

    try {

      insertarReservas();

      return res.status(201).json({
        mensaje:
          "Reservas realizadas correctamente.",
        grupoId
      });

    } catch (error) {

      console.error(error);

      return res.status(500).json({
        mensaje:
          "No se pudieron guardar las reservas."
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| ADMIN - OBTENER RESERVAS
|--------------------------------------------------------------------------
*/

router.get(
  "/admin",
  verificarAdministrador,
  (req, res) => {

    try {

      const reservas =
        db.prepare(`
          SELECT
            id,
            grupo_id,
            profesor,
            area,
            grado,
            seccion,
            dia,
            fecha_programada,
            hora_inicio,
            hora_fin,
            fecha_reserva
          FROM reservas
          ORDER BY
            fecha_programada,
            hora_inicio
        `).all();

      return res.json(
        reservas
      );

    } catch (error) {

      console.error(error);

      return res.status(500).json({
        mensaje:
          "No se pudieron obtener las reservas."
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| ADMIN - OBTENER TODAS
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  verificarAdministrador,
  (req, res) => {

    try {

      const reservas =
        db.prepare(`
          SELECT *
          FROM reservas
          ORDER BY
            fecha_programada,
            hora_inicio
        `).all();

      return res.json(
        reservas
      );

    } catch (error) {

      console.error(error);

      return res.status(500).json({
        mensaje:
          "No se pudieron obtener las reservas."
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| ADMIN - ELIMINAR GRUPO
|--------------------------------------------------------------------------
*/

router.delete(
  "/grupo/:grupoId",
  verificarAdministrador,
  (req, res) => {

    const grupoId =
      req.params.grupoId;

    if (
      typeof grupoId !== "string" ||
      grupoId.trim() === ""
    ) {

      return res.status(400).json({
        mensaje:
          "Grupo de reserva inválido."
      });
    }

    const resultado =
      db.prepare(`
        DELETE FROM reservas
        WHERE grupo_id = ?
      `).run(grupoId);

    if (
      resultado.changes === 0
    ) {

      return res.status(404).json({
        mensaje:
          "La reserva no existe."
      });
    }

    return res.json({
      mensaje:
        "Reserva eliminada correctamente.",
      bloquesEliminados:
        resultado.changes
    });
  }
);

/*
|--------------------------------------------------------------------------
| ADMIN - ELIMINAR RESERVA INDIVIDUAL
|--------------------------------------------------------------------------
*/

router.delete(
  "/:id",
  verificarAdministrador,
  (req, res) => {

    const id =
      Number(req.params.id);

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {

      return res.status(400).json({
        mensaje:
          "ID de reserva inválido."
      });
    }

    const resultado =
      db.prepare(`
        DELETE FROM reservas
        WHERE id = ?
      `).run(id);

    if (
      resultado.changes === 0
    ) {

      return res.status(404).json({
        mensaje:
          "La reserva no existe."
      });
    }

    return res.json({
      mensaje:
        "Reserva eliminada correctamente."
    });
  }
);

export default router;