/**
 * lib/tableroEstado.ts
 *
 * Clave visual para filtros y badges (Mi Semana, Planificación, Métricas).
 * Eje 1: `estado` (4 valores en BD). Eje 2: `situacion` desde `tarea_activa`.
 */

import { ESTADO_EJECUCION_LABEL, SITUACION_LABEL } from '@/lib/estadoConfig';
import type { ClaveVisualTarea, EstadoTarea, SituacionTarea, Tarea } from '@/types';

/** Campos mínimos para lectura de clave visual (métricas, tablero, UI). */
export type TareaParaEstadoEfectivo = Pick<Tarea, 'estado' | 'tipo' | 'fecha_planificada'> & {
  situacion?: SituacionTarea | null;
  reprogramaciones?: number;
};

function calcularSituacionFallback(
  tarea: TareaParaEstadoEfectivo,
  hoyYmd: string,
): SituacionTarea | null {
  if (tarea.estado === 'completada' || tarea.estado === 'cancelada') return null;
  if (
    tarea.tipo === 'planificada' &&
    tarea.fecha_planificada &&
    tarea.fecha_planificada < hoyYmd &&
    (tarea.estado === 'pendiente' || tarea.estado === 'en_progreso')
  ) {
    return 'atrasada';
  }
  if ((tarea.reprogramaciones ?? 0) > 0) return 'reprogramada';
  return 'creada';
}

/**
 * Devuelve la clave visual de la tarea para agrupación, filtros y badges.
 */
export function claveVisualTarea(tarea: TareaParaEstadoEfectivo, hoyYmd: string): ClaveVisualTarea {
  if (tarea.estado === 'completada' || tarea.estado === 'cancelada') {
    return tarea.estado;
  }

  const sit = tarea.situacion ?? calcularSituacionFallback(tarea, hoyYmd);
  if (sit === 'atrasada' || sit === 'reprogramada') return sit;

  return tarea.estado;
}

/** @deprecated Usar `claveVisualTarea`. Alias de compatibilidad. */
export function estadoEfectivoTablero(
  tarea: TareaParaEstadoEfectivo,
  hoyYmd: string,
): ClaveVisualTarea {
  return claveVisualTarea(tarea, hoyYmd);
}

/** Solo el eje persistido — para transiciones de estado y permisos. */
export function esEstadoPersistido(est: string): est is EstadoTarea {
  return est === 'pendiente' || est === 'en_progreso' || est === 'completada' || est === 'cancelada';
}

/** Situación efectiva (vista o fallback local). */
export function situacionEfectiva(
  tarea: TareaParaEstadoEfectivo,
  hoyYmd: string,
): SituacionTarea | null {
  if (tarea.estado === 'completada' || tarea.estado === 'cancelada') return null;
  return tarea.situacion ?? calcularSituacionFallback(tarea, hoyYmd);
}

/** Texto «situación · estado» para kickers y tooltips (modelo v1.1). */
export function textoEjesTarea(tarea: TareaParaEstadoEfectivo, hoyYmd: string): string | null {
  if (tarea.estado === 'completada' || tarea.estado === 'cancelada') {
    return ESTADO_EJECUCION_LABEL[tarea.estado];
  }

  const sit = situacionEfectiva(tarea, hoyYmd);
  const estLabel = ESTADO_EJECUCION_LABEL[tarea.estado];

  if (sit === 'atrasada' || sit === 'reprogramada') {
    return `${SITUACION_LABEL[sit]} · ${estLabel}`;
  }

  if (tarea.estado === 'en_progreso') return estLabel;
  return null;
}
