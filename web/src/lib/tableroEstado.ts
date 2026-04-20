import type { EstadoTarea, Tarea } from '@/types';

/** Alinea columna Kanban con la regla de atrasadas (misma lógica que HOY). */
export function estadoEfectivoTablero(t: Tarea, hoyYmd: string): EstadoTarea {
  if (
    t.tipo === 'planificada' &&
    t.fecha_planificada &&
    t.fecha_planificada < hoyYmd &&
    (t.estado === 'pendiente' || t.estado === 'en_progreso' || t.estado === 'bloqueada')
  ) {
    return 'atrasada';
  }
  return t.estado;
}
