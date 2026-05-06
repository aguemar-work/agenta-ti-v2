/**
 * src/test/helpers.ts
 * Factories y utilidades compartidas entre todos los archivos de test.
 */

import type { Tarea, Usuario } from '@/types';

// ---------------------------------------------------------------------------
// Factory de Tarea — crea una tarea base con los mínimos requeridos.
// Usar con overrides para el campo relevante del test.
// ---------------------------------------------------------------------------
export function makeTarea(overrides: Partial<Tarea> = {}): Tarea {
  return {
    id:                 'uuid-tarea',
    titulo:             'Tarea de prueba',
    descripcion:        null,
    estado:             'pendiente',
    tipo:               'planificada',
    prioridad:          'media',
    fecha_planificada:  null,
    semana_planificada: null,
    fecha_completada:   null,
    asignado_a:         'uuid-miembro',
    objetivo_id:        null,
    creado_por:         'uuid-miembro',
    es_imprevisto:      false,
    nota_origen_id:     null,
    created_at:         '2026-01-01T00:00:00Z',
    updated_at:         '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Factory de Usuario
// ---------------------------------------------------------------------------
export function makeUsuario(overrides: Partial<Usuario> = {}): Usuario {
  return {
    id:         'uuid-miembro',
    nombre:     'Kevin Miembro',
    email:      'kevin@nufago.com',
    rol:        'miembro',
    activo:     true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

export function makeJefe(overrides: Partial<Usuario> = {}): Usuario {
  return makeUsuario({ id: 'uuid-jefe', nombre: 'Alejandro Jefe', rol: 'jefe', ...overrides });
}

// ---------------------------------------------------------------------------
// Fechas fijas para tests deterministas
// ---------------------------------------------------------------------------
export const FECHAS = {
  HOY:    '2026-04-29',
  AYER:   '2026-04-28',
  MANANA: '2026-04-30',
  SEMANA: '2026-W18',
} as const;