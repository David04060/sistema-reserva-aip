export interface Bloque {
  id: number;
  inicio: string;
  fin: string;
  receso?: boolean;
}
export interface Reserva {
  dia: string;
  fecha_programada: string;
  hora_inicio: string;
  hora_fin: string;
  profesor: string;
}
export interface Seleccion {
  bloqueId: number;
}
export interface ReservaAgrupada {
  horaInicio: string;
  horaFin: string;
}

export const bloques: Bloque[] = [
  { id: 1, inicio: "13:00", fin: "13:40" },
  { id: 2, inicio: "13:40", fin: "14:20" },
  { id: 3, inicio: "14:20", fin: "15:00" },
  { id: 4, inicio: "15:00", fin: "15:10", receso: true },
  { id: 5, inicio: "15:10", fin: "15:50" },
  { id: 6, inicio: "15:50", fin: "16:30" },
  { id: 7, inicio: "16:30", fin: "16:40", receso: true },
  { id: 8, inicio: "16:40", fin: "17:20" },
  { id: 9, inicio: "17:20", fin: "18:00" },
];
export const nombresMeses = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
export const nombresDias = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

export function agruparBloques(seleccionados: Seleccion[]): ReservaAgrupada[] {
  const ids = new Set(seleccionados.map((s) => s.bloqueId));
  const grupos: ReservaAgrupada[] = [];
  for (const bloque of bloques.filter((b) => !b.receso && ids.has(b.id))) {
    const ultimo = grupos.at(-1);
    if (ultimo && ultimo.horaFin === bloque.inicio) ultimo.horaFin = bloque.fin;
    else grupos.push({ horaInicio: bloque.inicio, horaFin: bloque.fin });
  }
  return grupos;
}
