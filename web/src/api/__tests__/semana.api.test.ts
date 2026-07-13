/**
 * src/api/__tests__/semana.api.test.ts
 *
 * Tests de integración de api/semana.ts — capa de datos de Mi Semana (índice de la app).
 * Cubre las reglas de negocio con más riesgo silencioso: validación de justificación,
 * scoping personal/organización de eventos, y construcción de parámetros de RPC.
 * Patrón de mock: igual que tablero.api.test.ts / recurrencia.api.test.ts.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { MOCK_IDS } from '@/mocks/handlers';

// ---------------------------------------------------------------------------
// IDs adicionales con formato UUID válido (TareaSchema/EventoSchema exigen .uuid()).
// ---------------------------------------------------------------------------

const IDS = {
  tareaCritica: 'aaaaaaaa-1000-4000-a000-000000000101',
  tareaAlta:    'aaaaaaaa-1000-4000-a000-000000000102',
  tareaMedia:   'aaaaaaaa-1000-4000-a000-000000000103',
  tareaBaja:    'aaaaaaaa-1000-4000-a000-000000000104',
  eventoDentro: 'aaaaaaaa-2000-4000-a000-000000000201',
  eventoFuera:  'aaaaaaaa-2000-4000-a000-000000000202',
  otroJefe:     'aaaaaaaa-3000-4000-a000-000000000301',
  workspace1:   'aaaaaaaa-4000-4000-a000-000000000401',
} as const;

// ---------------------------------------------------------------------------
// Mock del cliente InsForge — query builder encadenable + rpc
// ---------------------------------------------------------------------------

const { mockRpc, queryResponse, queryCalls, mockPublicarEventoEquipo } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  queryResponse: { current: { data: [] as unknown, error: null as unknown } },
  queryCalls: {
    eq:     [] as unknown[][],
    or:     [] as unknown[][],
    lt:     [] as unknown[][],
    gt:     [] as unknown[][],
    insert: [] as Record<string, unknown>[],
  },
  mockPublicarEventoEquipo: vi.fn().mockResolvedValue(undefined),
}));

function makeQueryBuilder() {
  const builder = {
    select: vi.fn(() => builder),
    eq:     vi.fn((...args: unknown[]) => { queryCalls.eq.push(args); return builder; }),
    or:     vi.fn((...args: unknown[]) => { queryCalls.or.push(args); return builder; }),
    lt:     vi.fn((...args: unknown[]) => { queryCalls.lt.push(args); return builder; }),
    gt:     vi.fn((...args: unknown[]) => { queryCalls.gt.push(args); return builder; }),
    order:  vi.fn(() => builder),
    insert: vi.fn((rows: Record<string, unknown>[]) => { queryCalls.insert.push(rows[0]); return builder; }),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(queryResponse.current)),
    then:   (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(queryResponse.current).then(resolve, reject),
  };
  return builder;
}

vi.mock('@/lib/insforge', () => ({
  getInsforge: () => ({
    database: {
      rpc:  mockRpc,
      from: () => makeQueryBuilder(),
    },
  }),
}));

vi.mock('@/lib/realtimePublish', () => ({
  publicarEventoEquipo: mockPublicarEventoEquipo,
}));

beforeEach(() => {
  vi.clearAllMocks();
  queryCalls.eq.length = 0;
  queryCalls.or.length = 0;
  queryCalls.lt.length = 0;
  queryCalls.gt.length = 0;
  queryCalls.insert.length = 0;
  queryResponse.current = { data: [], error: null };
  mockRpc.mockResolvedValue({ data: null, error: null });
  mockPublicarEventoEquipo.mockClear().mockResolvedValue(undefined);
  useWorkspaceStore.setState({ workspaceActivo: null, orgActiva: null });
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function mockTareaRow(overrides: Record<string, unknown> = {}) {
  return {
    id:                 MOCK_IDS.tarea1,
    titulo:             'Tarea de prueba',
    descripcion:        null,
    estado:             'pendiente',
    tipo:               'planificada',
    prioridad:          'media',
    fecha_planificada:  '2026-04-29',
    semana_planificada: '202618',
    fecha_completada:   null,
    asignado_a:         MOCK_IDS.miembro,
    objetivo_id:        null,
    creado_por:         MOCK_IDS.miembro,
    es_imprevisto:      false,
    nota_origen_id:     null,
    created_at:         '2026-01-01T00:00:00Z',
    updated_at:         '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function mockEventoRow(overrides: Record<string, unknown> = {}) {
  return {
    id:              MOCK_IDS.evento1,
    titulo:          'Reunión de prueba',
    tipo:            'reunion',
    fecha_inicio:    '2026-04-29T09:00:00.000Z',
    fecha_fin:       '2026-04-29T10:00:00.000Z',
    usuario_id:      MOCK_IDS.miembro,
    organizacion_id: null,
    es_recurrente:   false,
    created_at:      '2026-01-01T00:00:00Z',
    updated_at:      '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getTareasSemana
// ---------------------------------------------------------------------------

describe('getTareasSemana', () => {
  it('filtra por asignado_a, tipo planificada, y (semana actual O atrasada)', async () => {
    const { getTareasSemana } = await import('@/api/semana');
    queryResponse.current = { data: [mockTareaRow()], error: null };

    const result = await getTareasSemana(MOCK_IDS.miembro, '202618');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(MOCK_IDS.tarea1);
    expect(queryCalls.eq).toContainEqual(['asignado_a', MOCK_IDS.miembro]);
    expect(queryCalls.eq).toContainEqual(['tipo', 'planificada']);
    expect(queryCalls.or).toContainEqual(['semana_planificada.eq.202618,situacion.eq.atrasada']);
  });

  it('propaga el error de la BD sin silenciarlo', async () => {
    const { getTareasSemana } = await import('@/api/semana');
    const dbError = new Error('permission denied for table tarea_activa');
    queryResponse.current = { data: null, error: dbError };

    await expect(getTareasSemana(MOCK_IDS.miembro, '202618')).rejects.toBe(dbError);
  });

  it('lanza error si una fila no cumple el schema de Tarea', async () => {
    const { getTareasSemana } = await import('@/api/semana');
    queryResponse.current = { data: [mockTareaRow({ estado: 'estado_invalido' })], error: null };

    await expect(getTareasSemana(MOCK_IDS.miembro, '202618')).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getEventosSemana — scoping personal/organización + solape de semana
// ---------------------------------------------------------------------------

describe('getEventosSemana', () => {
  const LUNES = new Date('2026-04-27T00:00:00');

  it('sin organización activa, no agrega filtro de scoping org/personal', async () => {
    const { getEventosSemana } = await import('@/api/semana');
    queryResponse.current = { data: [mockEventoRow()], error: null };

    await getEventosSemana(MOCK_IDS.miembro, LUNES);

    expect(queryCalls.or).toHaveLength(0);
  });

  it('con organización activa, filtra por evento personal U organizacion_id de la org activa', async () => {
    const { getEventosSemana } = await import('@/api/semana');
    useWorkspaceStore.setState({
      orgActiva: { id: MOCK_IDS.jefe, nombre: 'Org', slug: 'org', activa: true },
    });
    queryResponse.current = { data: [mockEventoRow()], error: null };

    await getEventosSemana(MOCK_IDS.miembro, LUNES);

    expect(queryCalls.or).toContainEqual([`tipo.eq.personal,organizacion_id.eq.${MOCK_IDS.jefe}`]);
  });

  it('descarta eventos que no solapan la semana consultada (filtro de cliente)', async () => {
    const { getEventosSemana } = await import('@/api/semana');
    queryResponse.current = {
      data: [
        mockEventoRow({ id: IDS.eventoDentro, fecha_inicio: '2026-04-28T09:00:00.000Z', fecha_fin: '2026-04-28T10:00:00.000Z' }),
        mockEventoRow({ id: IDS.eventoFuera, fecha_inicio: '2026-05-10T09:00:00.000Z', fecha_fin: '2026-05-10T10:00:00.000Z' }),
      ],
      error: null,
    };

    const result = await getEventosSemana(MOCK_IDS.miembro, LUNES);

    expect(result.map((e) => e.id)).toEqual([IDS.eventoDentro]);
  });
});

// ---------------------------------------------------------------------------
// crearTareaPlanificada
// ---------------------------------------------------------------------------

describe('crearTareaPlanificada', () => {
  beforeEach(() => {
    mockRpc.mockResolvedValue({ data: [mockTareaRow()], error: null });
  });

  it('recorta el título y calcula la semana ISO a partir de fecha_planificada', async () => {
    const { crearTareaPlanificada } = await import('@/api/semana');

    await crearTareaPlanificada({
      titulo:            '  Revisar servidor  ',
      prioridad:         'alta',
      fecha_planificada: '2026-04-29',
      creado_por:        MOCK_IDS.miembro,
    });

    expect(mockRpc).toHaveBeenCalledWith('sgtd_crear_tarea_planificada', expect.objectContaining({
      p_titulo:             'Revisar servidor',
      p_semana_planificada: '202618',
    }));
  });

  it('sin asignado_a explícito, usa creado_por como responsable (resolveAsignadoA)', async () => {
    const { crearTareaPlanificada } = await import('@/api/semana');

    await crearTareaPlanificada({
      titulo:            'Tarea sin asignar',
      prioridad:         'media',
      fecha_planificada: '2026-04-29',
      creado_por:        MOCK_IDS.jefe,
      asignado_a:        null,
    });

    expect(mockRpc).toHaveBeenCalledWith('sgtd_crear_tarea_planificada', expect.objectContaining({
      p_asignado_a: MOCK_IDS.jefe,
      p_creado_por: MOCK_IDS.jefe,
    }));
  });

  it('con asignado_a explícito, respeta el responsable indicado', async () => {
    const { crearTareaPlanificada } = await import('@/api/semana');

    await crearTareaPlanificada({
      titulo:            'Tarea asignada',
      prioridad:         'baja',
      fecha_planificada: '2026-04-29',
      creado_por:        MOCK_IDS.jefe,
      asignado_a:        MOCK_IDS.miembro,
    });

    expect(mockRpc).toHaveBeenCalledWith('sgtd_crear_tarea_planificada', expect.objectContaining({
      p_asignado_a: MOCK_IDS.miembro,
    }));
  });
});

// ---------------------------------------------------------------------------
// cambiarEstadoTarea — justificación obligatoria solo al cancelar
// ---------------------------------------------------------------------------

describe('cambiarEstadoTarea', () => {
  it('a "en_progreso" no requiere justificación', async () => {
    const { cambiarEstadoTarea } = await import('@/api/semana');

    await cambiarEstadoTarea({ tareaId: MOCK_IDS.tarea1, nuevoEstado: 'en_progreso' });

    expect(mockRpc).toHaveBeenCalledWith('sgtd_cambiar_estado_tarea', expect.objectContaining({
      p_nuevo_estado:  'en_progreso',
      p_justificacion: null,
    }));
  });

  it('a "cancelada" sin justificación (o con menos de 10 caracteres) no llama al RPC', async () => {
    const { cambiarEstadoTarea } = await import('@/api/semana');

    await expect(
      cambiarEstadoTarea({ tareaId: MOCK_IDS.tarea1, nuevoEstado: 'cancelada' }),
    ).rejects.toThrow(/al menos 10 caracteres/);
    await expect(
      cambiarEstadoTarea({ tareaId: MOCK_IDS.tarea1, nuevoEstado: 'cancelada', justificacion: 'corta' }),
    ).rejects.toThrow(/al menos 10 caracteres/);

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('a "cancelada" con justificación válida, invoca el RPC con la justificación recortada', async () => {
    const { cambiarEstadoTarea } = await import('@/api/semana');

    await cambiarEstadoTarea({
      tareaId:       MOCK_IDS.tarea1,
      nuevoEstado:   'cancelada',
      justificacion: '  Ya no aplica  ',
    });

    expect(mockRpc).toHaveBeenCalledWith('sgtd_cambiar_estado_tarea', expect.objectContaining({
      p_nuevo_estado:  'cancelada',
      p_justificacion: 'Ya no aplica',
    }));
  });
});

// ---------------------------------------------------------------------------
// eliminarTareaConMotivo / reprogramarTareaConLog — misma regla de 10 caracteres
// ---------------------------------------------------------------------------

describe('eliminarTareaConMotivo', () => {
  it('rechaza motivo menor a 10 caracteres sin llamar al RPC', async () => {
    const { eliminarTareaConMotivo } = await import('@/api/semana');

    await expect(
      eliminarTareaConMotivo({ tareaId: MOCK_IDS.tarea1, usuarioId: MOCK_IDS.miembro, motivo: 'corto' }),
    ).rejects.toThrow(/al menos 10 caracteres/);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('con motivo válido, invoca el RPC', async () => {
    const { eliminarTareaConMotivo } = await import('@/api/semana');

    await eliminarTareaConMotivo({
      tareaId:   MOCK_IDS.tarea1,
      usuarioId: MOCK_IDS.miembro,
      motivo:    'Duplicada por error de carga',
    });

    expect(mockRpc).toHaveBeenCalledWith('sgtd_eliminar_tarea_con_motivo', {
      p_tarea_id:   MOCK_IDS.tarea1,
      p_usuario_id: MOCK_IDS.miembro,
      p_motivo:     'Duplicada por error de carga',
    });
  });
});

describe('reprogramarTareaConLog', () => {
  it('rechaza justificación menor a 10 caracteres sin llamar al RPC', async () => {
    const { reprogramarTareaConLog } = await import('@/api/semana');

    await expect(
      reprogramarTareaConLog({
        tareaId: MOCK_IDS.tarea1, usuarioId: MOCK_IDS.miembro,
        nuevaFecha: '2026-05-01', justificacion: 'corto',
      }),
    ).rejects.toThrow(/al menos 10 caracteres/);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// completarTareaConResumen — RPC + notificación realtime a jefes
// ---------------------------------------------------------------------------

describe('completarTareaConResumen', () => {
  it('sin jefes indicados, no publica ninguna notificación', async () => {
    const { completarTareaConResumen } = await import('@/api/semana');

    await completarTareaConResumen({
      tareaId: MOCK_IDS.tarea1, usuarioId: MOCK_IDS.miembro,
      resumen: 'Resumen de cierre de la tarea',
    });

    expect(mockPublicarEventoEquipo).not.toHaveBeenCalled();
  });

  it('con jefeId único, publica una notificación al canal de ese jefe', async () => {
    const { completarTareaConResumen } = await import('@/api/semana');

    await completarTareaConResumen({
      tareaId: MOCK_IDS.tarea1, usuarioId: MOCK_IDS.miembro,
      resumen: 'Resumen de cierre de la tarea', jefeId: MOCK_IDS.jefe,
    });
    await vi.waitFor(() => expect(mockPublicarEventoEquipo).toHaveBeenCalledTimes(1));

    expect(mockPublicarEventoEquipo).toHaveBeenCalledWith(expect.objectContaining({
      tipo: 'tarea_completada', jefeId: MOCK_IDS.jefe, tareaId: MOCK_IDS.tarea1,
    }));
  });

  it('con jefeIds (equipo multi-jefe), publica una notificación por cada jefe', async () => {
    const { completarTareaConResumen } = await import('@/api/semana');

    await completarTareaConResumen({
      tareaId: MOCK_IDS.tarea1, usuarioId: MOCK_IDS.miembro,
      resumen: 'Resumen de cierre de la tarea', jefeIds: [MOCK_IDS.jefe, IDS.otroJefe],
    });
    await vi.waitFor(() => expect(mockPublicarEventoEquipo).toHaveBeenCalledTimes(2));
  });

  it('si el RPC falla, no intenta notificar', async () => {
    const { completarTareaConResumen } = await import('@/api/semana');
    mockRpc.mockResolvedValue({ data: null, error: new Error('estado inválido') });

    await expect(
      completarTareaConResumen({
        tareaId: MOCK_IDS.tarea1, usuarioId: MOCK_IDS.miembro,
        resumen: 'Resumen de cierre de la tarea', jefeId: MOCK_IDS.jefe,
      }),
    ).rejects.toThrow('estado inválido');
    expect(mockPublicarEventoEquipo).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// crearEventoUsuario — requiere workspace activo + scoping personal/organización
// ---------------------------------------------------------------------------

describe('crearEventoUsuario', () => {
  const INPUT_BASE = {
    titulo:        'Reunión de equipo',
    tipo:          'reunion' as const,
    fecha_dia:     '2026-04-29',
    hora_inicio:   '09:00',
    hora_fin:      '10:00',
    usuario_id:    MOCK_IDS.miembro,
    es_recurrente: false,
  };

  it('sin workspace activo, rechaza antes de tocar la BD', async () => {
    const { crearEventoUsuario } = await import('@/api/semana');

    await expect(crearEventoUsuario(INPUT_BASE)).rejects.toThrow('Sin workspace activo');
    expect(queryCalls.insert).toHaveLength(0);
  });

  it('evento de tipo "personal" se guarda con organizacion_id null aunque haya org activa', async () => {
    useWorkspaceStore.setState({
      workspaceActivo: { id: IDS.workspace1, organizacion_id: MOCK_IDS.jefe, nombre: 'WS', activo: true },
      orgActiva:       { id: MOCK_IDS.jefe, nombre: 'Org', slug: 'org', activa: true },
    });
    queryResponse.current = { data: mockEventoRow({ tipo: 'personal', organizacion_id: null }), error: null };
    const { crearEventoUsuario } = await import('@/api/semana');

    await crearEventoUsuario({ ...INPUT_BASE, tipo: 'personal' });

    expect(queryCalls.insert).toContainEqual(expect.objectContaining({
      tipo: 'personal', organizacion_id: null, workspace_id: IDS.workspace1,
    }));
  });

  it('evento de tipo "reunion" (no personal) se guarda con la organizacion_id activa', async () => {
    useWorkspaceStore.setState({
      workspaceActivo: { id: IDS.workspace1, organizacion_id: MOCK_IDS.jefe, nombre: 'WS', activo: true },
      orgActiva:       { id: MOCK_IDS.jefe, nombre: 'Org', slug: 'org', activa: true },
    });
    queryResponse.current = { data: mockEventoRow(), error: null };
    const { crearEventoUsuario } = await import('@/api/semana');

    await crearEventoUsuario(INPUT_BASE);

    expect(queryCalls.insert).toContainEqual(expect.objectContaining({
      tipo: 'reunion', organizacion_id: MOCK_IDS.jefe,
    }));
  });
});

// ---------------------------------------------------------------------------
// getTareasHoyUsuario — orden por prioridad (crítica > alta > media > baja)
// ---------------------------------------------------------------------------

describe('getTareasHoyUsuario', () => {
  it('ordena el resultado por prioridad, sin importar el orden de llegada', async () => {
    const { getTareasHoyUsuario } = await import('@/api/semana');
    queryResponse.current = {
      data: [
        mockTareaRow({ id: IDS.tareaBaja, prioridad: 'baja' }),
        mockTareaRow({ id: IDS.tareaCritica, prioridad: 'critica' }),
        mockTareaRow({ id: IDS.tareaMedia, prioridad: 'media' }),
        mockTareaRow({ id: IDS.tareaAlta, prioridad: 'alta' }),
      ],
      error: null,
    };

    const result = await getTareasHoyUsuario(MOCK_IDS.miembro, '2026-04-29');

    expect(result.map((t) => t.id)).toEqual([IDS.tareaCritica, IDS.tareaAlta, IDS.tareaMedia, IDS.tareaBaja]);
  });
});
