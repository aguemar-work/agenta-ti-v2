/** Fecha local `YYYY-MM-DD` (calendario del usuario). */
export function fechaLocalYmd(fecha: Date): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parsea `YYYY-MM-DD` como fecha local (mediodía, evita desfase UTC). */
export function parseYmdLocal(ymd: string): Date {
  return new Date(`${ymd}T12:00:00`);
}

/** Fecha local `dd/MM/yyyy` (formato corto para UI). */
export function fechaLocalDdMmYyyy(fecha: Date): string {
  const d = String(fecha.getDate()).padStart(2, '0');
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const y = fecha.getFullYear();
  return `${d}/${m}/${y}`;
}

/** Pie de card: «2 jun» (sin año). */
export function fechaCortaDiaMes(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`);
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
}
