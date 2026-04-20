/** Fecha local `YYYY-MM-DD` (calendario del usuario). */
export function fechaLocalYmd(fecha: Date): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Fecha local `dd/MM/yyyy` (formato corto para UI). */
export function fechaLocalDdMmYyyy(fecha: Date): string {
  const d = String(fecha.getDate()).padStart(2, '0');
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const y = fecha.getFullYear();
  return `${d}/${m}/${y}`;
}
