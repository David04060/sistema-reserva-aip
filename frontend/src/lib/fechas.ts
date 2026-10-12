export function hoyEnLima(): Date {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const parte = (tipo: string) => Number(partes.find((p) => p.type === tipo)!.value);
  return new Date(parte("year"), parte("month") - 1, parte("day"), 12);
}

export function mostrarFecha(fecha: string): string {
  return fecha.split("-").reverse().join("/");
}

export function mostrarFechaReserva(fecha: string): string {
  const objeto = new Date(fecha);
  return Number.isNaN(objeto.getTime())
    ? fecha
    : new Intl.DateTimeFormat("es-PE", {
        timeZone: "America/Lima",
        dateStyle: "short",
        timeStyle: "short",
      }).format(objeto);
}
