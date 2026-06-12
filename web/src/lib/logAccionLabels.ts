import type { TipoAccionLog } from '@/types';

/** Etiqueta corta para badges e historial de tarea. */
export const LOG_ACCION_LABEL: Record<TipoAccionLog, string> = {
  creada: 'Creada',
  iniciada: 'Iniciada',
  reprogramada: 'Reprogramada',
  eliminada: 'Eliminada',
  estado_cambiado: 'Estado actualizado',
  prioridad_cambiada: 'Prioridad',
  editada: 'Editada',
  cancelada: 'Cancelada',
  bloqueada: 'Bloqueada',
  desbloqueada: 'Desbloqueada',
  completada: 'Completada',
};

export function labelLogAccion(tipo: TipoAccionLog): string {
  return LOG_ACCION_LABEL[tipo] ?? tipo;
}

/** Verbo en feed de actividad reciente (Planificación). */
export function labelLogActividadFeed(tipo: string): string {
  const m: Record<string, string> = {
    completada: 'Completó tarea',
    bloqueada: 'Bloqueó tarea',
    reprogramada: 'Reprogramó tarea',
    cancelada: 'Canceló tarea',
    desbloqueada: 'Desbloqueó tarea',
  };
  return m[tipo] ?? 'Actividad';
}

/** Etiqueta breve en panel de justificaciones del jefe. */
export function labelLogJustificacion(tipo: string): string {
  const m: Record<string, string> = {
    bloqueada: 'Bloqueo',
    cancelada: 'Cancelación',
    reprogramada: 'Reprogramación',
    eliminada: 'Eliminación',
  };
  return m[tipo] ?? tipo;
}
