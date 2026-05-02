import { describe, expect, it } from 'vitest';

import { resolverEstadoReprogramacion } from '@/lib/tareaEstado';
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
    created_at:         '2026-01-01T00:00:00Z',
    updated_at:         '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const HOY    = '2026-04-29';
const AYER   = '2026-04-28';
const MANANA = '2026-04-30';

// ---------------------------------------------------------------------------

describe('resolverEstadoReprogramacion', () => {

  // ── Regla 1: atrasada → siempre reprogramada ──────────────────────────────

  describe('tarea atrasada', () => {
    it('devuelve "reprogramada" sin importar la fecha', () => {
      const t = tarea({ estado: 'atrasada', fecha_planificada: AYER });
      expect(resolverEstadoReprogramacion(t, HOY)).toBe('reprogramada');
    });

    it('devuelve "reprogramada" aunque la nueva fecha sea hoy', () => {
      const t = tarea({ estado: 'atrasada', fecha_planificada: HOY });
      expect(resolverEstadoReprogramacion(t, HOY)).toBe('reprogramada');
    });

    it('devuelve "reprogramada" aunque la nueva fecha sea futura', () => {
      const t = tarea({ estado: 'atrasada', fecha_planificada: MANANA });
      expect(resolverEstadoReprogramacion(t, HOY)).toBe('reprogramada');
    });
  });

  // ── Regla 2: pendiente con fecha_planificada === hoy → reprogramada ───────
  // Semántica: si estaba planeada para hoy y la mueves, es una reprogramación.

  describe('tarea pendiente con fecha hoy', () => {
    it('devuelve "reprogramada" cuando fecha_planificada === hoyYmd', () => {
      const t = tarea({ estado: 'pendiente', fecha_planificada: HOY });
      expect(resolverEstadoReprogramacion(t, HOY)).toBe('reprogramada');
    });
  });

  // ── Regla 3: pendiente con fecha futura → pendiente ───────────────────────

  describe('tarea pendiente con fecha futura', () => {
    it('devuelve "pendiente" cuando fecha_planificada > hoy', () => {
      const t = tarea({ estado: 'pendiente', fecha_planificada: MANANA });
      expect(resolverEstadoReprogramacion(t, HOY)).toBe('pendiente');
    });

    it('devuelve "pendiente" cuando fecha_planificada es null', () => {
      const t = tarea({ estado: 'pendiente', fecha_planificada: null });
      expect(resolverEstadoReprogramacion(t, HOY)).toBe('pendiente');
    });
  });

  // ── Regla 3 (continuación): otros estados → pendiente ────────────────────
  // Si se arrastra una tarea en_progreso/bloqueada (casos edge), el estado
  // resultante es pendiente — no reprogramada (no aplica la regla 1).

  describe('otros estados', () => {
    it('devuelve "pendiente" para tarea en_progreso', () => {
      const t = tarea({ estado: 'en_progreso', fecha_planificada: AYER });
      expect(resolverEstadoReprogramacion(t, HOY)).toBe('pendiente');
    });

    it('devuelve "pendiente" para tarea bloqueada', () => {
      const t = tarea({ estado: 'bloqueada', fecha_planificada: AYER });
      expect(resolverEstadoReprogramacion(t, HOY)).toBe('pendiente');
    });
  });
});
