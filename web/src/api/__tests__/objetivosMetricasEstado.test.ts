import { describe, expect, it } from 'vitest';

import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import type { Tarea } from '@/types';

/** Escenario del bug: BD aún no re-sincronizó el trigger de atrasada. */
function tareaMetricas(overrides: Partial<Tarea>): Pick<Tarea, 'estado' | 'tipo' | 'fecha_planificada'> {
  return {
    estado: 'pendiente',
    tipo: 'planificada',
    fecha_planificada: '2026-04-28',
    ...overrides,
  };
}

describe('objetivosMetricas — clasificación por estado efectivo', () => {
  const hoy = '2026-04-29';

  it('pendiente vencida se clasifica como atrasada (no pendiente)', () => {
    const t = tareaMetricas({ estado: 'pendiente' });
    expect(estadoEfectivoTablero(t, hoy)).toBe('atrasada');
  });

  it('reprogramada vencida se clasifica como atrasada (no reprogramada)', () => {
    const t = tareaMetricas({ estado: 'reprogramada' });
    expect(estadoEfectivoTablero(t, hoy)).toBe('atrasada');
  });

  it('pendiente al día sigue siendo pendiente', () => {
    const t = tareaMetricas({ estado: 'pendiente', fecha_planificada: hoy });
    expect(estadoEfectivoTablero(t, hoy)).toBe('pendiente');
  });
});
