export const HORARIOS = [
  { inicio: "13:00", fin: "13:40" },
  { inicio: "13:40", fin: "14:20" },
  { inicio: "14:20", fin: "15:00" },
  { inicio: "15:10", fin: "15:50" },
  { inicio: "15:50", fin: "16:30" },
  { inicio: "16:40", fin: "17:20" },
  { inicio: "17:20", fin: "18:00" },
];

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export class ErrorReserva extends Error {
  constructor(
    public status: number,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

export interface Intervalo {
  horaInicio: string;
  horaFin: string;
}
export interface DatosReserva {
  profesor: string;
  area: string;
  grado: string;
  seccion: string;
  fechaProgramada: string;
  dia: string;
  reservas: Intervalo[];
}

export function fechaActualLima(ahora = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ahora);
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)!.value;
  return `${parte("year")}-${parte("month")}-${parte("day")}`;
}

export function obtenerDia(fecha: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  const objeto = new Date(`${fecha}T12:00:00Z`);
  if (Number.isNaN(objeto.getTime()) || objeto.toISOString().slice(0, 10) !== fecha) return null;
  return DIAS[objeto.getUTCDay()];
}

function horarioValido(inicio: string, fin: string, multiple: boolean): boolean {
  const indice = HORARIOS.findIndex((h) => h.inicio === inicio);
  if (indice < 0) return false;
  let actual = HORARIOS[indice].fin;
  if (actual === fin) return true;
  if (!multiple) return false;
  for (let i = indice + 1; i < HORARIOS.length; i++) {
    if (HORARIOS[i].inicio !== actual) return false;
    actual = HORARIOS[i].fin;
    if (actual === fin) return true;
  }
  return false;
}

export function validarReserva(body: unknown, multiple: boolean): DatosReserva {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ErrorReserva(400, "Datos de reserva inválidos.");
  }
  const datos = body as Record<string, unknown>;
  const campo = (nombre: string, maximo: number): string => {
    const valor = datos[nombre];
    if (typeof valor !== "string") throw new ErrorReserva(400, "Datos de reserva inválidos.");
    const limpio = valor.trim();
    if (!limpio) throw new ErrorReserva(400, "Todos los campos son obligatorios.");
    if (limpio.length > maximo)
      throw new ErrorReserva(400, "Uno de los campos supera la longitud permitida.");
    return limpio;
  };
  const profesor = campo("profesor", 100);
  const area = campo("area", 100);
  const grado = campo("grado", 30);
  const seccion = campo("seccion", 20);
  const fechaProgramada = datos.fechaProgramada;
  if (typeof fechaProgramada !== "string")
    throw new ErrorReserva(400, "Datos de reserva inválidos.");
  const dia = obtenerDia(fechaProgramada);
  if (!dia || fechaProgramada < fechaActualLima()) {
    throw new ErrorReserva(400, "La fecha no es válida o corresponde a una fecha pasada.");
  }
  if (dia === "Domingo" || dia === "Sábado") {
    throw new ErrorReserva(400, "Solo se pueden realizar reservas de lunes a viernes.");
  }
  const enviados = multiple
    ? datos.reservas
    : [{ horaInicio: datos.horaInicio, horaFin: datos.horaFin }];
  if (!Array.isArray(enviados)) throw new ErrorReserva(400, "Datos de reserva inválidos.");
  if (!enviados.length) throw new ErrorReserva(400, "Debe seleccionar al menos un horario.");
  if (enviados.length > HORARIOS.length)
    throw new ErrorReserva(400, "Se seleccionaron demasiados horarios.");
  const reservas: Intervalo[] = enviados
    .map((reserva: unknown) => {
      if (!reserva || typeof reserva !== "object" || Array.isArray(reserva)) {
        throw new ErrorReserva(400, "Uno de los horarios enviados no es válido.");
      }
      const { horaInicio, horaFin } = reserva as Record<string, unknown>;
      if (
        typeof horaInicio !== "string" ||
        typeof horaFin !== "string" ||
        !horarioValido(horaInicio, horaFin, multiple)
      ) {
        throw new ErrorReserva(400, "Uno de los horarios seleccionados no es válido.");
      }
      return { horaInicio, horaFin };
    })
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  for (let i = 1; i < reservas.length; i++) {
    if (reservas[i].horaInicio < reservas[i - 1].horaFin) {
      throw new ErrorReserva(409, "Los horarios seleccionados se superponen.");
    }
  }
  return { profesor, area, grado, seccion, fechaProgramada, dia, reservas };
}
