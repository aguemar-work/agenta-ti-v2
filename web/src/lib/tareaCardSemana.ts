/**
 * Señales de lectura rápida para tarjetas de tarea en Mi Semana (v2).
 */

import { fechaCortaDiaMes } from '@/lib/fecha';
import { ESTADO_EJECUCION_LABEL, SITUACION_LABEL } from '@/lib/estadoConfig';
import { situacionEfectiva } from '@/lib/tableroEstado';
import { tareaVenceHoy } from '@/lib/venceHoy';
import type { PrioridadTarea, Tarea } from '@/types';

export type SenalSituacionCard = 'atrasada' | 'reprogramada' | 'vence_hoy';

/** Situación visible en la fila de estado (no incluye «creada»). */
export function senalSituacionCard(tarea: Tarea, hoyYmd: string): SenalSituacionCard | null {
  if (tarea.estado === 'completada' || tarea.estado === 'cancelada') return null;
  if (tareaVenceHoy(tarea, hoyYmd)) return 'vence_hoy';
  const sit = situacionEfectiva(tarea, hoyYmd);
  if (sit === 'atrasada' || sit === 'reprogramada') return sit;
  return null;
}

/** Fecha en el pie: solo cuando aporta contexto (nunca el día «normal» de la columna). */
export function senalFechaCard(tarea: Tarea, hoyYmd: string): string | null {
  if (tarea.estado === 'completada' || tarea.estado === 'cancelada') return null;
  if (tareaVenceHoy(tarea, hoyYmd)) return null;

  const sit = situacionEfectiva(tarea, hoyYmd);
  if (sit === 'atrasada' && tarea.fecha_planificada && tarea.fecha_planificada < hoyYmd) {
    return `Vencía ${fechaCortaDiaMes(tarea.fecha_planificada)}`;
  }
  return null;
}

export function labelSenalSituacion(senal: SenalSituacionCard): string {
  if (senal === 'vence_hoy') return 'Vence hoy';
  return SITUACION_LABEL[senal];
}

export function labelEstadoEjecucion(tarea: Tarea): string {
  return ESTADO_EJECUCION_LABEL[tarea.estado];
}

export function claseBarraPrioridad(prioridad: PrioridadTarea): string {
  return `mc-semana-task-card__prio--${prioridad}`;
}

export function muestraChipPrioridad(prioridad: PrioridadTarea): boolean {
  return prioridad === 'critica';
}
