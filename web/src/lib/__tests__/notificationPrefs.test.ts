import { beforeEach, describe, expect, it } from 'vitest';

import {
  eventosDisponiblesPorRol,
  getDefaultNotificationPrefs,
  isNotificationEnabled,
  loadNotificationPrefs,
  saveNotificationPrefs,
} from '@/lib/notificationPrefs';

describe('notificationPrefs', () => {
  const userId = '00000000-0000-4000-8000-000000000099';

  beforeEach(() => {
    localStorage.clear();
  });

  it('devuelve todos los eventos activos por defecto', () => {
    const prefs = getDefaultNotificationPrefs();
    expect(isNotificationEnabled(prefs, 'tarea_asignada')).toBe(true);
    expect(isNotificationEnabled(prefs, 'incidencia_registrada')).toBe(true);
  });

  it('persiste preferencias por usuario', () => {
    const prefs = { ...getDefaultNotificationPrefs(), ot_aprobada: false };
    saveNotificationPrefs(userId, prefs);
    const loaded = loadNotificationPrefs(userId);
    expect(loaded.ot_aprobada).toBe(false);
    expect(loaded.tarea_asignada).toBe(true);
  });

  it('expone más eventos al jefe que al miembro', () => {
    expect(eventosDisponiblesPorRol('jefe').length).toBeGreaterThan(
      eventosDisponiblesPorRol('miembro').length,
    );
    expect(eventosDisponiblesPorRol('miembro')).not.toContain('ot_enviada');
  });
});
