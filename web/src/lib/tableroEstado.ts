/**
 * lib/tableroEstado.ts
 *
 * Estado efectivo para filtros y visualización (Mi Semana, Planificación).
 * Complementa el trigger `sgtd_fn_marcar_atrasada` en escrituras y cubre
 * filas aún no re-sincronizadas en lectura.
 */

import type { EstadoTarea, Tarea } from '@/types';

const ESTADOS_EVALUABLES_ATRASO: ReadonlySet<EstadoTarea> = new Set([
  'pendiente',
  'reprogramada',
]);

function esPlanificadaVencida(tarea: Tarea, hoyYmd: string): boolean {
  return (
    tarea.tipo === 'planificada' &&
    Boolean(tarea.fecha_planificada) &&
    tarea.fecha_planificada! < hoyYmd
  );
}

/**
 * Devuelve el estado efectivo de la tarea para agrupación/filtros en UI.
 */
export function estadoEfectivoTablero(tarea: Tarea, hoyYmd: string): EstadoTarea {
  if (
    esPlanificadaVencida(tarea, hoyYmd) &&
    ESTADOS_EVALUABLES_ATRASO.has(tarea.estado)
  ) {
    return 'atrasada';
  }
  return tarea.estado;
}