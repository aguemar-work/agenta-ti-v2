import { describe, expect, it } from 'vitest';

import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import type { Tarea } from '@/types';

function tarea(overrides: Partial<Tarea>): Tarea {
  return {
    id:                 'uuid-test',
    titulo:             'Tarea de prueba',
    descripcion:        null,
    estado:             'pendiente',
    tipo:               'planificada',
    prioridad:          'media',
    fecha_planificada:  null,
    semana_planificada: null,
    fecha_completada:   null,
    asignado_a:         'uuid-usuario',
    objetivo_id:        null,
    creado_por:         'uuid-usuario',
    es_imprevisto:      false,
    nota_origen_id:     null,
    created_at:         '2026-01-01T00:00:00Z',
    updated_at:         '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const HOY = '2026-04-29';
const AYER = '2026-04-28';

describe('estadoEfectivoTablero', () => {
  it('marca pendiente vencida como atrasada', () => {
    const t = tarea({ estado: 'pendiente', fecha_planificada: AYER });
    expect(estadoEfectivoTablero(t, HOY)).toBe('atrasada');
  });

  it('marca reprogramada vencida como atrasada', () => {
    const t = tarea({ estado: 'reprogramada', fecha_planificada: AYER });
    expect(estadoEfectivoTablero(t, HOY)).toBe('atrasada');
  });

  it('no degrada en_progreso vencida (acción consciente del usuario)', () => {
    const t = tarea({ estado: 'en_progreso', fecha_planificada: AYER });
    expect(estadoEfectivoTablero(t, HOY)).toBe('en_progreso');
  });

  it('no degrada estados terminales ni bloqueada', () => {
    for (const estado of ['completada', 'cancelada', 'bloqueada', 'atrasada'] as const) {
      const t = tarea({ estado, fecha_planificada: AYER });
      expect(estadoEfectivoTablero(t, HOY)).toBe(estado);
    }
  });

  it('no degrada no_planificada aunque la fecha esté vencida', () => {
    const t = tarea({ tipo: 'no_planificada', fecha_planificada: AYER, estado: 'pendiente' });
    expect(estadoEfectivoTablero(t, HOY)).toBe('pendiente');
  });

  it('respeta fecha futura en reprogramada', () => {
    const t = tarea({ estado: 'reprogramada', fecha_planificada: '2026-05-01' });
    expect(estadoEfectivoTablero(t, HOY)).toBe('reprogramada');
  });
});
