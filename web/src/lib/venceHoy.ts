import type { Tarea } from '@/types';

/** Tarea planificada para hoy y aún no cerrada (chip «Vence hoy»). */
export function tareaVenceHoy(tarea: Tarea, hoyYmd: string): boolean {
  if (!tarea.fecha_planificada || tarea.fecha_planificada !== hoyYmd) return false;
  return !['completada', 'cancelada'].includes(tarea.estado);
}
