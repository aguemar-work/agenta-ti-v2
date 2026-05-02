import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import {
  parseTarea,
  parseEvento,
  parseNota,
  parseUsuario,
  TareaSchema,
  EventoSchema,
  NotaBitacoraSchema,
  UsuarioSchema,
  SchemaParseError,
} from '@/lib/schemas';

// ---------------------------------------------------------------------------
// Fixtures — filas válidas tal como llegan de InsForge (Record<string, unknown>)
// ---------------------------------------------------------------------------

const UUID_A = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const UUID_B = 'b2c3d4e5-f6a7-8901-bcde-f01234567891';

const ROW_TAREA_VALIDA: Record<string, unknown> = {
  id:                 UUID_A,
  titulo:             'Revisar informe mensual',
  descripcion:        'Descripción de prueba',
  estado:             'pendiente',
  tipo:               'planificada',
  prioridad:          'alta',
  fecha_planificada:  '2026-04-29',
  semana_planificada: '202618',
  fecha_completada:   null,
  asignado_a:         UUID_B,
  objetivo_id:        null,
  creado_por:         UUID_B,
  es_imprevisto:      false,
  created_at:         '2026-01-01T00:00:00Z',
  updated_at:         '2026-04-29T10:00:00Z',
};

const ROW_EVENTO_VALIDO: Record<string, unknown> = {
  id:            UUID_A,
  titulo:        'Reunión de equipo',
  tipo:          'reunion',
  fecha_inicio:  '2026-04-29T09:00:00Z',
  fecha_fin:     '2026-04-29T10:00:00Z',
  usuario_id:    UUID_B,
  es_recurrente: false,
  created_at:    '2026-01-01T00:00:00Z',
  updated_at:    '2026-04-29T10:00:00Z',
};

const ROW_NOTA_VALIDA: Record<string, unknown> = {
  id:            UUID_A,
  contenido:     'Nota de prueba',
  usuario_id:    UUID_B,
  objetivo_id:   null,
  visibilidad:   'todos',
  convertida_en: null,
  usuario:       { nombre: 'Juan Pérez' },
  created_at:    '2026-01-01T00:00:00Z',
  updated_at:    '2026-04-29T10:00:00Z',
};

const ROW_USUARIO_VALIDO: Record<string, unknown> = {
  id:         UUID_A,
  nombre:     'María García',
  email:      'maria@empresa.com',
  rol:        'miembro',
  activo:     true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-04-29T10:00:00Z',
};

// ---------------------------------------------------------------------------
// Helper: silencia console.warn en tests donde esperamos que falle el parse
// ---------------------------------------------------------------------------
function silenceWarn() {
  const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  return spy;
}

// ---------------------------------------------------------------------------

describe('parseTarea', () => {

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('parsea una fila válida correctamente', () => {
    const result = parseTarea(ROW_TAREA_VALIDA);
    expect(result.id).toBe(UUID_A);
    expect(result.titulo).toBe('Revisar informe mensual');
    expect(result.estado).toBe('pendiente');
    expect(result.tipo).toBe('planificada');
    expect(result.prioridad).toBe('alta');
    expect(result.es_imprevisto).toBe(false);
    expect(result.asignado_a).toBe(UUID_B);
  });

  it('acepta todos los estados válidos', () => {
    const estados = ['pendiente', 'en_progreso', 'reprogramada', 'completada', 'bloqueada', 'atrasada', 'cancelada'] as const;
    for (const estado of estados) {
      const result = parseTarea({ ...ROW_TAREA_VALIDA, estado });
      expect(result.estado).toBe(estado);
    }
  });

  it('acepta todos los tipos válidos', () => {
    const tipos = ['planificada', 'no_planificada', 'libre'] as const;
    for (const tipo of tipos) {
      const result = parseTarea({ ...ROW_TAREA_VALIDA, tipo });
      expect(result.tipo).toBe(tipo);
    }
  });

  it('acepta todas las prioridades válidas', () => {
    for (const prioridad of ['alta', 'media', 'baja'] as const) {
      const result = parseTarea({ ...ROW_TAREA_VALIDA, prioridad });
      expect(result.prioridad).toBe(prioridad);
    }
  });

  it('acepta campos nullables como null', () => {
    const result = parseTarea({
      ...ROW_TAREA_VALIDA,
      descripcion:        null,
      fecha_planificada:  null,
      semana_planificada: null,
      fecha_completada:   null,
      objetivo_id:        null,
    });
    expect(result.descripcion).toBeNull();
    expect(result.fecha_planificada).toBeNull();
    expect(result.objetivo_id).toBeNull();
  });

  // ── Campos inválidos — lanzan SchemaParseError (fallback eliminado) ────────

  describe('con campo inválido lanza SchemaParseError', () => {

    it('estado inválido — lanza SchemaParseError', () => {
      const rowInvalido = { ...ROW_TAREA_VALIDA, estado: 'inexistente' };
      expect(() => parseTarea(rowInvalido)).toThrow(SchemaParseError);
    });

    it('el mensaje incluye el label "Tarea"', () => {
      const rowInvalido = { ...ROW_TAREA_VALIDA, estado: 'inexistente' };
      expect(() => parseTarea(rowInvalido)).toThrow(/Tarea/);
    });

    it('el error expone el campo que falló (issues.path)', () => {
      const rowInvalido = { ...ROW_TAREA_VALIDA, estado: 'inexistente' };
      try {
        parseTarea(rowInvalido);
        expect.fail('Debería haber lanzado');
      } catch (e) {
        expect(e).toBeInstanceOf(SchemaParseError);
        const err = e as SchemaParseError;
        expect(err.issues.some((i) => i.path.includes('estado'))).toBe(true);
      }
    });

    it('tipo inválido — lanza SchemaParseError', () => {
      const rowInvalido = { ...ROW_TAREA_VALIDA, tipo: 'tipo_que_no_existe' };
      expect(() => parseTarea(rowInvalido)).toThrow(SchemaParseError);
    });

    it('id con formato incorrecto — lanza SchemaParseError', () => {
      const rowInvalido = { ...ROW_TAREA_VALIDA, id: 'no-es-un-uuid' };
      expect(() => parseTarea(rowInvalido)).toThrow(SchemaParseError);
    });
  });

  // ── TareaSchema directo (Zod) ────────────────────────────────────────────

  describe('TareaSchema.safeParse', () => {
    it('falla con error descriptivo cuando estado es inválido', () => {
      const result = TareaSchema.safeParse({ ...ROW_TAREA_VALIDA, estado: 'invalido' });
      expect(result.success).toBe(false);
      if (!result.success) {
        const fields = result.error.flatten().fieldErrors;
        expect(fields).toHaveProperty('estado');
      }
    });

    it('falla cuando falta un campo requerido', () => {
      const { titulo: _titulo, ...sinTitulo } = ROW_TAREA_VALIDA;
      const result = TareaSchema.safeParse(sinTitulo);
      expect(result.success).toBe(false);
    });

    it('falla cuando id no es UUID válido', () => {
      const result = TareaSchema.safeParse({ ...ROW_TAREA_VALIDA, id: '1234' });
      expect(result.success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------

describe('parseEvento', () => {

  it('parsea una fila válida correctamente', () => {
    const result = parseEvento(ROW_EVENTO_VALIDO);
    expect(result.id).toBe(UUID_A);
    expect(result.titulo).toBe('Reunión de equipo');
    expect(result.tipo).toBe('reunion');
    expect(result.es_recurrente).toBe(false);
  });

  it('acepta todos los tipos de evento válidos', () => {
    for (const tipo of ['reunion', 'entrega', 'personal', 'otro'] as const) {
      const result = parseEvento({ ...ROW_EVENTO_VALIDO, tipo });
      expect(result.tipo).toBe(tipo);
    }
  });

  it('acepta evento recurrente', () => {
    const result = parseEvento({ ...ROW_EVENTO_VALIDO, es_recurrente: true });
    expect(result.es_recurrente).toBe(true);
  });

  describe('EventoSchema.safeParse', () => {
    it('falla con tipo de evento inválido', () => {
      const result = EventoSchema.safeParse({ ...ROW_EVENTO_VALIDO, tipo: 'videollamada' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors).toHaveProperty('tipo');
      }
    });

    it('falla si fecha_inicio está ausente', () => {
      const { fecha_inicio: _fi, ...sinFecha } = ROW_EVENTO_VALIDO;
      const result = EventoSchema.safeParse(sinFecha);
      expect(result.success).toBe(false);
    });

    it('falla si usuario_id no es UUID', () => {
      const result = EventoSchema.safeParse({ ...ROW_EVENTO_VALIDO, usuario_id: 'no-uuid' });
      expect(result.success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------

describe('parseNota', () => {

  it('parsea una fila válida con usuario join', () => {
    const result = parseNota(ROW_NOTA_VALIDA);
    expect(result.id).toBe(UUID_A);
    expect(result.contenido).toBe('Nota de prueba');
    expect(result.visibilidad).toBe('todos');
    expect(result.usuario?.nombre).toBe('Juan Pérez');
  });

  it('acepta todas las visibilidades válidas', () => {
    for (const visibilidad of ['todos', 'solo_jefe', 'privado'] as const) {
      const result = parseNota({ ...ROW_NOTA_VALIDA, visibilidad });
      expect(result.visibilidad).toBe(visibilidad);
    }
  });

  it('acepta convertida_en como "tarea"', () => {
    const result = parseNota({ ...ROW_NOTA_VALIDA, convertida_en: 'tarea' });
    expect(result.convertida_en).toBe('tarea');
  });

  it('acepta convertida_en como "evento"', () => {
    const result = parseNota({ ...ROW_NOTA_VALIDA, convertida_en: 'evento' });
    expect(result.convertida_en).toBe('evento');
  });

  it('acepta convertida_en como null', () => {
    const result = parseNota({ ...ROW_NOTA_VALIDA, convertida_en: null });
    expect(result.convertida_en).toBeNull();
  });

  it('acepta usuario como null (sin join)', () => {
    const result = parseNota({ ...ROW_NOTA_VALIDA, usuario: null });
    expect(result.usuario).toBeNull();
  });

  it('acepta usuario como undefined (join no incluido)', () => {
    const { usuario: _u, ...sinUsuario } = ROW_NOTA_VALIDA;
    const result = parseNota(sinUsuario);
    expect(result.usuario).toBeUndefined();
  });

  describe('NotaBitacoraSchema.safeParse', () => {
    it('falla con visibilidad inválida', () => {
      const result = NotaBitacoraSchema.safeParse({ ...ROW_NOTA_VALIDA, visibilidad: 'publica' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors).toHaveProperty('visibilidad');
      }
    });

    it('falla con convertida_en inválido', () => {
      const result = NotaBitacoraSchema.safeParse({ ...ROW_NOTA_VALIDA, convertida_en: 'objetivo' });
      expect(result.success).toBe(false);
    });

    it('falla si contenido está ausente', () => {
      const { contenido: _c, ...sinContenido } = ROW_NOTA_VALIDA;
      const result = NotaBitacoraSchema.safeParse(sinContenido);
      expect(result.success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------

describe('parseUsuario', () => {

  it('parsea una fila válida correctamente', () => {
    const result = parseUsuario(ROW_USUARIO_VALIDO);
    expect(result.id).toBe(UUID_A);
    expect(result.nombre).toBe('María García');
    expect(result.email).toBe('maria@empresa.com');
    expect(result.rol).toBe('miembro');
    expect(result.activo).toBe(true);
  });

  it('acepta rol "jefe"', () => {
    const result = parseUsuario({ ...ROW_USUARIO_VALIDO, rol: 'jefe' });
    expect(result.rol).toBe('jefe');
  });

  it('acepta activo = false', () => {
    const result = parseUsuario({ ...ROW_USUARIO_VALIDO, activo: false });
    expect(result.activo).toBe(false);
  });

  describe('UsuarioSchema.safeParse', () => {
    it('falla con rol inválido', () => {
      const result = UsuarioSchema.safeParse({ ...ROW_USUARIO_VALIDO, rol: 'admin' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors).toHaveProperty('rol');
      }
    });

    it('falla con email inválido', () => {
      const result = UsuarioSchema.safeParse({ ...ROW_USUARIO_VALIDO, email: 'no-es-email' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors).toHaveProperty('email');
      }
    });

    it('falla si nombre está ausente', () => {
      const { nombre: _n, ...sinNombre } = ROW_USUARIO_VALIDO;
      const result = UsuarioSchema.safeParse(sinNombre);
      expect(result.success).toBe(false);
    });

    it('falla si id no es UUID válido', () => {
      const result = UsuarioSchema.safeParse({ ...ROW_USUARIO_VALIDO, id: 'abc123' });
      expect(result.success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Test transversal: SchemaParseError en todos los parsers
// Verifica que ningún parser deja pasar datos corruptos silenciosamente.
// ---------------------------------------------------------------------------

describe('SchemaParseError — comportamiento transversal', () => {

  it('parseTarea con campo extra desconocido — Zod lo ignora, parse exitoso', () => {
    // Zod hace strip de campos extra por defecto — no lanza
    const result = parseTarea({ ...ROW_TAREA_VALIDA, campo_extra: 'valor' });
    expect(result.id).toBe(UUID_A);
  });

  it('parseTarea con estado inválido — lanza SchemaParseError', () => {
    expect(() => parseTarea({ ...ROW_TAREA_VALIDA, estado: 'estado_inventado' }))
      .toThrow(SchemaParseError);
  });

  it('parseEvento con tipo inválido — lanza SchemaParseError', () => {
    expect(() => parseEvento({ ...ROW_EVENTO_VALIDO, tipo: 'zoom_call' }))
      .toThrow(SchemaParseError);
  });

  it('parseNota con visibilidad inválida — lanza SchemaParseError', () => {
    expect(() => parseNota({ ...ROW_NOTA_VALIDA, visibilidad: 'publica' }))
      .toThrow(SchemaParseError);
  });

  it('parseUsuario con rol inválido — lanza SchemaParseError', () => {
    expect(() => parseUsuario({ ...ROW_USUARIO_VALIDO, rol: 'superadmin' }))
      .toThrow(SchemaParseError);
  });

  it('SchemaParseError tiene name="SchemaParseError"', () => {
    try {
      parseTarea({ ...ROW_TAREA_VALIDA, estado: 'mal' });
      expect.fail('Debería haber lanzado');
    } catch (e) {
      expect(e).toBeInstanceOf(SchemaParseError);
      expect((e as SchemaParseError).name).toBe('SchemaParseError');
    }
  });

  it('SchemaParseError expone .label y .issues', () => {
    try {
      parseUsuario({ ...ROW_USUARIO_VALIDO, rol: 'superadmin' });
      expect.fail('Debería haber lanzado');
    } catch (e) {
      const err = e as SchemaParseError;
      expect(err.label).toBe('Usuario');
      expect(Array.isArray(err.issues)).toBe(true);
      expect(err.issues.length).toBeGreaterThan(0);
    }
  });
});