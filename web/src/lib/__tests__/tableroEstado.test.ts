import { describe, expect, it } from 'vitest';

import { claveVisualTarea, textoEjesTarea } from '@/lib/tableroEstado';
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

describe('claveVisualTarea', () => {
  it('usa situacion atrasada desde la vista', () => {
    const t = tarea({ estado: 'pendiente', situacion: 'atrasada', fecha_planificada: AYER });
    expect(claveVisualTarea(t, HOY)).toBe('atrasada');
  });

  it('usa situacion reprogramada desde la vista', () => {
    const t = tarea({ estado: 'pendiente', situacion: 'reprogramada', reprogramaciones: 1 });
    expect(claveVisualTarea(t, HOY)).toBe('reprogramada');
  });

  it('calcula atrasada por fallback si no hay situacion', () => {
    const t = tarea({ estado: 'pendiente', fecha_planificada: AYER });
    expect(claveVisualTarea(t, HOY)).toBe('atrasada');
  });

  it('en_progreso vencida sigue siendo en_progreso (no atrasada visual si situacion no lo dice)', () => {
    const t = tarea({ estado: 'en_progreso', situacion: 'creada', fecha_planificada: AYER });
    expect(claveVisualTarea(t, HOY)).toBe('en_progreso');
  });

  it('no degrada estados terminales', () => {
    for (const estado of ['completada', 'cancelada'] as const) {
      const t = tarea({ estado, situacion: null, fecha_planificada: AYER });
      expect(claveVisualTarea(t, HOY)).toBe(estado);
    }
  });

  it('no degrada no_planificada aunque la fecha esté vencida', () => {
    const t = tarea({ tipo: 'no_planificada', fecha_planificada: AYER, estado: 'pendiente' });
    expect(claveVisualTarea(t, HOY)).toBe('pendiente');
  });
});

describe('textoEjesTarea', () => {
  it('combina situación y estado de ejecución', () => {
    const t = tarea({ estado: 'pendiente', situacion: 'reprogramada', reprogramaciones: 2 });
    expect(textoEjesTarea(t, HOY)).toBe('Reprogramada · Pendiente');
  });

  it('devuelve null para pendiente al día sin señal extra', () => {
    const t = tarea({ estado: 'pendiente', situacion: 'creada', fecha_planificada: HOY });
    expect(textoEjesTarea(t, HOY)).toBeNull();
  });

  it('muestra solo estado terminal', () => {
    const t = tarea({ estado: 'completada', situacion: null });
    expect(textoEjesTarea(t, HOY)).toBe('Completada');
  });
});
