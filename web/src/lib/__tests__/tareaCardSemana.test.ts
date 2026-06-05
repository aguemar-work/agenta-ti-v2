import { describe, expect, it } from 'vitest';

import { senalFechaCard, senalSituacionCard } from '@/lib/tareaCardSemana';
import type { Tarea } from '@/types';

function tarea(overrides: Partial<Tarea>): Tarea {
  return {
    id: 'id',
    titulo: 'Test',
    descripcion: null,
    estado: 'pendiente',
    tipo: 'planificada',
    prioridad: 'media',
    fecha_planificada: '2026-06-05',
    semana_planificada: '202623',
    fecha_completada: null,
    asignado_a: 'u1',
    objetivo_id: null,
    creado_por: 'u1',
    es_imprevisto: false,
    nota_origen_id: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const HOY = '2026-06-05';

describe('senalSituacionCard', () => {
  it('no muestra situación creada', () => {
    expect(
      senalSituacionCard(tarea({ situacion: 'creada', fecha_planificada: '2026-06-10' }), HOY),
    ).toBeNull();
  });

  it('muestra reprogramada', () => {
    expect(
      senalSituacionCard(
        tarea({ situacion: 'reprogramada', reprogramaciones: 1, fecha_planificada: '2026-06-10' }),
        HOY,
      ),
    ).toBe('reprogramada');
  });

  it('prioriza vence hoy', () => {
    expect(senalSituacionCard(tarea({ fecha_planificada: HOY }), HOY)).toBe('vence_hoy');
  });
});

describe('senalFechaCard', () => {
  it('muestra vencía para atrasada', () => {
    const r = senalFechaCard(
      tarea({ situacion: 'atrasada', fecha_planificada: '2026-06-02' }),
      HOY,
    );
    expect(r).toMatch(/^Vencía /);
  });

  it('no muestra fecha en vence hoy (va en fila estado)', () => {
    expect(senalFechaCard(tarea({ fecha_planificada: HOY }), HOY)).toBeNull();
  });
});
