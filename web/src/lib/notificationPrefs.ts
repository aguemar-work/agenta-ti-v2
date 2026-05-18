/**
 * Preferencias de notificaciones en tiempo real (por usuario, localStorage).
 * Reduce fatiga: el usuario elige qué eventos generan toast.
 */

export type NotificationEventKey =
  | 'tarea_asignada'
  | 'ot_aprobada'
  | 'ot_rechazada'
  | 'tarea_completada'
  | 'ot_enviada'
  | 'incidencia_registrada'
  | 'tarea_atrasada'
  | 'tarea_bloqueada_critica'
  | 'resumen_sla_diario';

export type NotificationPrefs = Record<NotificationEventKey, boolean>;

export const NOTIFICATION_EVENT_LABELS: Record<NotificationEventKey, string> = {
  tarea_asignada: 'Tarea asignada a mí',
  ot_aprobada: 'OT aprobada',
  ot_rechazada: 'OT rechazada',
  tarea_completada: 'Tarea completada (equipo)',
  ot_enviada: 'OT enviada a aprobación',
  incidencia_registrada: 'Incidencia registrada',
  tarea_atrasada: 'Tarea atrasada (equipo)',
  tarea_bloqueada_critica: 'Tarea bloqueada >48 h',
  resumen_sla_diario: 'Resumen diario SLA',
};

/** Eventos visibles según rol */
export function eventosDisponiblesPorRol(rol: 'jefe' | 'miembro'): NotificationEventKey[] {
  const base: NotificationEventKey[] = ['tarea_asignada', 'ot_aprobada', 'ot_rechazada'];
  if (rol === 'jefe') {
    return [
      ...base,
      'tarea_completada',
      'ot_enviada',
      'incidencia_registrada',
      'tarea_atrasada',
      'tarea_bloqueada_critica',
      'resumen_sla_diario',
    ];
  }
  return base;
}

const DEFAULT_PREFS: NotificationPrefs = {
  tarea_asignada: true,
  ot_aprobada: true,
  ot_rechazada: true,
  tarea_completada: true,
  ot_enviada: true,
  incidencia_registrada: true,
  tarea_atrasada: true,
  tarea_bloqueada_critica: true,
  resumen_sla_diario: true,
};

function storageKey(userId: string) {
  return `nexora_notif_prefs_v1_${userId}`;
}

export function getDefaultNotificationPrefs(): NotificationPrefs {
  return { ...DEFAULT_PREFS };
}

export function loadNotificationPrefs(userId: string): NotificationPrefs {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return getDefaultNotificationPrefs();
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
    return { ...DEFAULT_PREFS, ...parsed };
  } catch {
    return getDefaultNotificationPrefs();
  }
}

export function saveNotificationPrefs(userId: string, prefs: NotificationPrefs): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(prefs));
  } catch {
    // quota / modo privado
  }
}

export function isNotificationEnabled(
  prefs: NotificationPrefs,
  event: NotificationEventKey,
): boolean {
  return prefs[event] !== false;
}
