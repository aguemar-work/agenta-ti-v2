/**
 * lib/__tests__/schemas.test.ts
 * Tests de validación Zod — actualizados para schema v2.
 */

import { describe, expect, it } from 'vitest';
import {
  EventoSchema,
  NotaBitacoraSchema,
  TareaSchema,
  UsuarioSchema,
} from '@/lib/schemas';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const BASE_TAREA = {
  id:                 '11111111-1111-4111-8111-111111111111',
  titulo:             'Tarea de prueba',
  descripcion:        null,
  estado:             'pendiente',
  tipo:               'planificada',
  prioridad:          'media',
  fecha_planificada:  '2026-05-01',
  semana_planificada: '202618',
  fecha_completada:   null,
  asignado_a:         '22222222-2222-4222-8222-222222222222',
  objetivo_id:        null,
  creado_por:         '33333333-3333-4333-8333-333333333333',
  es_imprevisto:      false,
  nota_origen_id:     null,
  created_at:         '2026-01-01T00:00:00Z',
  updated_at:         '2026-01-01T00:00:00Z',
};

// ---------------------------------------------------------------------------
// TareaSchema
// ---------------------------------------------------------------------------
describe('TareaSchema', () => {
  it('acepta tarea planificada válida', () => {
    expect(TareaSchema.safeParse(BASE_TAREA).success).toBe(true);
  });

  it('acepta tarea no_planificada', () => {
    const t = { ...BASE_TAREA, tipo: 'no_planificada', es_imprevisto: true };
    expect(TareaSchema.safeParse(t).success).toBe(true);
  });

  it('acepta nota_origen_id como uuid válido', () => {
    const t = { ...BASE_TAREA, nota_origen_id: '44444444-4444-4444-8444-444444444444' };
    expect(TareaSchema.safeParse(t).success).toBe(true);
  });

  it('acepta nota_origen_id como null', () => {
    const t = { ...BASE_TAREA, nota_origen_id: null };
    expect(TareaSchema.safeParse(t).success).toBe(true);
  });

  it('rechaza tipo libre (eliminado)', () => {
    const t = { ...BASE_TAREA, tipo: 'libre' };
    expect(TareaSchema.safeParse(t).success).toBe(false);
  });

  const estados = ['pendiente', 'en_progreso', 'reprogramada', 'completada', 'bloqueada', 'atrasada', 'cancelada'] as const;
  it.each(estados)('acepta estado %s', (estado) => {
    expect(TareaSchema.safeParse({ ...BASE_TAREA, estado }).success).toBe(true);
  });

  const tipos = ['planificada', 'no_planificada'] as const;
  it.each(tipos)('acepta tipo %s', (tipo) => {
    expect(TareaSchema.safeParse({ ...BASE_TAREA, tipo }).success).toBe(true);
  });

  it('rechaza id inválido', () => {
    expect(TareaSchema.safeParse({ ...BASE_TAREA, id: 'no-es-uuid' }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// EventoSchema
// ---------------------------------------------------------------------------
describe('EventoSchema', () => {
  const BASE_EVENTO = {
    id:            '11111111-1111-4111-8111-111111111111',
    titulo:        'Reunión de prueba',
    tipo:          'reunion',
    fecha_inicio:  '2026-05-01T09:00:00Z',
    fecha_fin:     '2026-05-01T10:00:00Z',
    usuario_id:    '22222222-2222-4222-8222-222222222222',
    es_recurrente: false,
    created_at:    '2026-01-01T00:00:00Z',
    updated_at:    '2026-01-01T00:00:00Z',
  };

  it('acepta evento válido', () => {
    expect(EventoSchema.safeParse(BASE_EVENTO).success).toBe(true);
  });

  const tipos = ['reunion', 'entrega', 'personal', 'otro'] as const;
  it.each(tipos)('acepta tipo %s', (tipo) => {
    expect(EventoSchema.safeParse({ ...BASE_EVENTO, tipo }).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// NotaBitacoraSchema
// ---------------------------------------------------------------------------
describe('NotaBitacoraSchema', () => {
  const BASE_NOTA = {
    id:            '11111111-1111-4111-8111-111111111111',
    contenido:     'Nota de prueba',
    usuario_id:    '22222222-2222-4222-8222-222222222222',
    objetivo_id:   null,
    visibilidad:   'todos',
    convertida_en: null,
    created_at:    '2026-01-01T00:00:00Z',
    updated_at:    '2026-01-01T00:00:00Z',
  };

  it('acepta nota válida', () => {
    expect(NotaBitacoraSchema.safeParse(BASE_NOTA).success).toBe(true);
  });

  it('acepta nota convertida en tarea', () => {
    const n = { ...BASE_NOTA, convertida_en: 'tarea' };
    expect(NotaBitacoraSchema.safeParse(n).success).toBe(true);
  });

  it('acepta nota convertida en evento', () => {
    const n = { ...BASE_NOTA, convertida_en: 'evento' };
    expect(NotaBitacoraSchema.safeParse(n).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// UsuarioSchema
// ---------------------------------------------------------------------------
describe('UsuarioSchema', () => {
  const BASE_USUARIO = {
    id:         '11111111-1111-4111-8111-111111111111',
    nombre:     'Ana García',
    email:      'ana@empresa.com',
    rol:        'miembro',
    activo:     true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  it('acepta usuario válido', () => {
    expect(UsuarioSchema.safeParse(BASE_USUARIO).success).toBe(true);
  });

  it('acepta rol jefe', () => {
    expect(UsuarioSchema.safeParse({ ...BASE_USUARIO, rol: 'jefe' }).success).toBe(true);
  });

  it('rechaza email inválido', () => {
    expect(UsuarioSchema.safeParse({ ...BASE_USUARIO, email: 'no-email' }).success).toBe(false);
  });
});