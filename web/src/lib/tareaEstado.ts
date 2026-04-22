import type { Tarea } from '@/types';

/**
 * Resuelve el estado resultante al reprogramar una tarea por drag.
 * - atrasada -> reprogramada
 * - pendiente con fecha hoy -> reprogramada
 * - pendiente con fecha futura -> pendiente
 */
export function resolverEstadoReprogramacion(
  tarea: Tarea,
  hoyYmd: string,
): 'reprogramada' | 'pendiente' {
  if (tarea.estado === 'atrasada') return 'reprogramada';
  if (tarea.estado === 'pendiente' && tarea.fecha_planificada === hoyYmd) return 'reprogramada';
  return 'pendiente';
}
