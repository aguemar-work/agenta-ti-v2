import { describe, expect, it } from 'vitest';

import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import type { Tarea } from '@/types';

// ---------------------------------------------------------------------------
// Factory — crea una tarea base con los valores mínimos requeridos.
// Solo sobrescribe los campos relevantes para cada test.
// ---------------------------------------------------------------------------
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
const MANANA = '2026-04-30';

// ---------------------------------------------------------------------------

describe('estadoEfectivoTablero', () => {

  // ── Los estados activos/terminales nunca se degradan ─────────────────────
  // Este bloque fue el bug raíz del trigger: sobreescribía en_progreso/bloqueada.

  describe('respeta estados activos aunque la fecha esté vencida', () => {
    const estadosProtegidos = [
      'en_progreso',
      'bloqueada',
      'completada',
      'cancelada',
      'reprogramada',
      'atrasada',
    ] as const;

    for (const estado of estadosProtegidos) {
      it(`no degrada tarea "${estado}" con fecha vencida`, () => {
        const t = tarea({ tipo: 'planificada', fecha_planificada: AYER, estado });
        expect(estadoEfectivoTablero(t, HOY)).toBe(estado);
      });
    }
  });

  // ── Tipo no_planificada nunca se degrada ──────────────────────────────────

  describe('no_planificada', () => {
    it('no degrada aunque la fecha esté vencida', () => {
      const t = tarea({ tipo: 'no_planificada', fecha_planificada: AYER, estado: 'pendiente' });
      expect(estadoEfectivoTablero(t, HOY)).toBe('pendiente');
    });
  });
});
