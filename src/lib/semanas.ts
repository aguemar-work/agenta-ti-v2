/**
 * Código de semana ISO `YYYYWW` (año ISO × 100 + número de semana, 01–53).
 * Usar siempre esta utilidad para `semana_planificada`, no duplicar la lógica en vistas.
 */
export function semanaIsoDesdeFecha(fecha: Date): string {
  const utc = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const isoYear = utc.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${isoYear}${String(week).padStart(2, '0')}`;
}

export function inicioSemanaIso(fecha: Date): Date {
  const d = new Date(
    Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()),
  );
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 1 - day);
  d.setUTCHours(0, 0, 0, 0);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function agregarDias(fecha: Date, dias: number): Date {
  const d = new Date(fecha);
  d.setDate(d.getDate() + dias);
  return d;
}

/** Número de semana ISO (1–53) a partir del lunes de esa semana. */
export function numeroSemanaDesdeLunes(lunes: Date): number {
  return parseInt(semanaIsoDesdeFecha(lunes).slice(4), 10);
}
