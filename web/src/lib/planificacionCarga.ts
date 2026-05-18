/**
 * Escala de saturación por cantidad de tareas en celda (vista Planificación).
 * Solo número + color de fondo — sin % ni barras.
 */

export const LEYENDA_SATURACION = [
  { rango: '0', label: '0 tareas', clase: 'mc-plan-celda--0' },
  { rango: '1–2', label: '1–2', clase: 'mc-plan-celda--1' },
  { rango: '3–4', label: '3–4', clase: 'mc-plan-celda--2' },
  { rango: '5–6', label: '5–6', clase: 'mc-plan-celda--3' },
  { rango: '7+', label: '7+', clase: 'mc-plan-celda--4' },
] as const;

/** Clase CSS según cantidad de tareas planificadas en el día. */
export function claseCeldaSaturacion(n: number): string {
  if (n === 0) return 'mc-plan-celda--0';
  if (n <= 2) return 'mc-plan-celda--1';
  if (n <= 4) return 'mc-plan-celda--2';
  if (n <= 6) return 'mc-plan-celda--3';
  return 'mc-plan-celda--4';
}
