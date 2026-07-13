/**
 * src/api/__tests__/ordenTrabajo.api.test.ts
 *
 * Tests de integración de api/ordenTrabajo.ts — flujo de Órdenes de Trabajo
 * (borrador -> pendiente -> aprobada -> completada). Cubre las reglas con más
 * riesgo silencioso: qué estado se preserva al editar una OT, el dedupe de
 * "última OT por tarea" cuando hay varias vinculadas, el patrón RPC + re-fetch
 * de enviarOTAlJefe, y el recorte/normalización de campos antes de enviarlos.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MOCK_IDS } from '@/mocks/handlers';

const OT_ID_1 = 'aaaaaaaa-0000-4000-a000-000000000101';
const OT_ID_2 = 'aaaaaaaa-0000-4000-a000-000000000102';
const TAREA_A = 'aaaaaaaa-0000-4000-a000-000000000201';
const TAREA_B = 'aaaaaaaa-0000-4000-a000-000000000202';

// ---------------------------------------------------------------------------
// Mock del cliente InsForge — query builder encadenable por tabla + rpc
// ---------------------------------------------------------------------------

const { mockRpc, tableResponses, queryCalls } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  tableResponses: {} as Record<string, { data: unknown; error: unknown }>,
  queryCalls: {
    insert: [] as { table: string; row: Record<string, unknown> }[],
    update: [] as { table: string; changes: Record<string, unknown> }[],
    eq:     [] as { table: string; args: unknown[] }[],
  },
}));

function makeQueryBuilder(table: string) {
  const response = () => tableResponses[table] ?? { data: [], error: null };
  const builder = {
    select:      vi.fn(() => builder),
    eq:          vi.fn((...args: unknown[]) => { queryCalls.eq.push({ table, args }); return builder; }),
    in:          vi.fn(() => builder),
    order:       vi.fn(() => builder),
    limit:       vi.fn(() => builder),
    single:      vi.fn(() => Promise.resolve(response())),
    maybeSingle: vi.fn(() => Promise.resolve(response())),
    insert:      vi.fn((rows: Record<string, unknown>[]) => { queryCalls.insert.push({ table, row: rows[0] }); return builder; }),
    update:      vi.fn((changes: Record<string, unknown>) => { queryCalls.update.push({ table, changes }); return builder; }),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(response()).then(resolve, reject),
  };
  return builder;
}

vi.mock('@/lib/insforge', () => ({
  getInsforge: () => ({
    database: { rpc: mockRpc, from: (table: string) => makeQueryBuilder(table) },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(tableResponses)) delete tableResponses[k];
  queryCalls.insert.length = 0;
  queryCalls.update.length = 0;
  queryCalls.eq.length = 0;
  mockRpc.mockResolvedValue({ data: null, error: null });
});

// ---------------------------------------------------------------------------
// Fixture — reutiliza mockOT() de mocks/handlers.ts (shape completo válido)
// ---------------------------------------------------------------------------

function otRow(overrides: Record<string, unknown> = {}) {
  return {
    id:                   OT_ID_1,
    numero:               'OT-2026-001',
    creado_por:           MOCK_IDS.miembro,
    tipo_trabajo_id:      null,
    tarea_id:             null,
    objetivo_id:          null,
    estado:               'borrador',
    prioridad:            'normal',
    descripcion:          'Descripción de prueba',
    area_destino:         'Sistemas',
    ubicacion:            null,
    modalidad:            'presencial',
    fecha_estimada:       '2026-04-30',
    hora_inicio_est:      null,
    duracion_est_min:     null,
    equipos_materiales:   null,
    observaciones:        null,
    aprobado_por:         null,
    fecha_aprobacion:     null,
    motivo_rechazo:       null,
    fecha_inicio_real:    null,
    fecha_fin_real:       null,
    observaciones_cierre: null,
    receptor_nombre:      null,
    receptor_dni:         null,
    receptor_cargo:       null,
    created_at:           '2026-01-01T00:00:00Z',
    updated_at:           '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// crearTipoTrabajoOT — normalización a MAYÚSCULAS + trim
// ---------------------------------------------------------------------------

describe('crearTipoTrabajoOT', () => {
  it('recorta y pasa el nombre a mayúsculas antes de insertar', async () => {
    tableResponses.tipo_trabajo_ot = {
      data: { id: OT_ID_1, nombre: 'MANTENIMIENTO', activo: true, created_at: '2026-01-01T00:00:00Z' },
      error: null,
    };
    const { crearTipoTrabajoOT } = await import('@/api/ordenTrabajo');

    await crearTipoTrabajoOT('  mantenimiento  ');

    expect(queryCalls.insert).toEqual([
      { table: 'tipo_trabajo_ot', row: { nombre: 'MANTENIMIENTO' } },
    ]);
  });
});

// ---------------------------------------------------------------------------
// crearOrdenTrabajo — siempre nace en "borrador", defaults y trim
// ---------------------------------------------------------------------------

describe('crearOrdenTrabajo', () => {
  beforeEach(() => {
    tableResponses.orden_trabajo = { data: otRow(), error: null };
  });

  it('nace en estado "borrador" y prioridad "normal" por defecto, con campos recortados', async () => {
    const { crearOrdenTrabajo } = await import('@/api/ordenTrabajo');

    await crearOrdenTrabajo({
      creado_por:     MOCK_IDS.miembro,
      descripcion:    '  Reparar switch  ',
      area_destino:   '  Sistemas  ',
      modalidad:      'presencial',
      fecha_estimada: '2026-04-30',
    });

    expect(queryCalls.insert[0].row).toEqual(expect.objectContaining({
      estado: 'borrador', prioridad: 'normal',
      descripcion: 'Reparar switch', area_destino: 'Sistemas',
    }));
  });

  it('respeta prioridad "urgente" cuando se indica explícitamente', async () => {
    const { crearOrdenTrabajo } = await import('@/api/ordenTrabajo');

    await crearOrdenTrabajo({
      creado_por: MOCK_IDS.miembro, descripcion: 'Urgente', area_destino: 'Sistemas',
      modalidad: 'remoto', fecha_estimada: '2026-04-30', prioridad: 'urgente',
    });

    expect(queryCalls.insert[0].row).toEqual(expect.objectContaining({ prioridad: 'urgente' }));
  });
});

// ---------------------------------------------------------------------------
// actualizarOrdenTrabajo — el estado se preserva SOLO si estaba en pendiente,
// cualquier otro estado actual (incl. aprobada/completada) cae a "borrador".
// ---------------------------------------------------------------------------

describe('actualizarOrdenTrabajo', () => {
  beforeEach(() => {
    tableResponses.orden_trabajo = { data: otRow({ estado: 'pendiente' }), error: null };
  });

  const INPUT_BASE = {
    otId: OT_ID_1, descripcion: 'Editada', area_destino: 'Sistemas',
    modalidad: 'presencial' as const, fecha_estimada: '2026-05-01',
  };

  it('si estadoActual es "pendiente", el update preserva "pendiente"', async () => {
    const { actualizarOrdenTrabajo } = await import('@/api/ordenTrabajo');

    await actualizarOrdenTrabajo({ ...INPUT_BASE, estadoActual: 'pendiente' });

    expect(queryCalls.update[0].changes).toEqual(expect.objectContaining({ estado: 'pendiente' }));
  });

  it('si estadoActual es "borrador", el update mantiene "borrador"', async () => {
    const { actualizarOrdenTrabajo } = await import('@/api/ordenTrabajo');

    await actualizarOrdenTrabajo({ ...INPUT_BASE, estadoActual: 'borrador' });

    expect(queryCalls.update[0].changes).toEqual(expect.objectContaining({ estado: 'borrador' }));
  });

  it('cualquier otro estadoActual (p. ej. "aprobada") cae a "borrador" — documenta el comportamiento actual', async () => {
    const { actualizarOrdenTrabajo } = await import('@/api/ordenTrabajo');

    await actualizarOrdenTrabajo({ ...INPUT_BASE, estadoActual: 'aprobada' });

    expect(queryCalls.update[0].changes).toEqual(expect.objectContaining({ estado: 'borrador' }));
  });
});

// ---------------------------------------------------------------------------
// enviarOTAlJefe — RPC (asigna número) + re-fetch de la fila actualizada
// ---------------------------------------------------------------------------

describe('enviarOTAlJefe', () => {
  it('si el RPC falla, no intenta el re-fetch', async () => {
    const rpcError = new Error('OT no está en borrador');
    mockRpc.mockResolvedValue({ data: null, error: rpcError });
    const { enviarOTAlJefe } = await import('@/api/ordenTrabajo');

    await expect(enviarOTAlJefe(OT_ID_1, MOCK_IDS.miembro)).rejects.toBe(rpcError);
  });

  it('con RPC exitoso, re-consulta la OT y devuelve la fila ya con número asignado', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    tableResponses.orden_trabajo = { data: otRow({ estado: 'pendiente', numero: 'OT-TI-0007' }), error: null };
    const { enviarOTAlJefe } = await import('@/api/ordenTrabajo');

    const result = await enviarOTAlJefe(OT_ID_1, MOCK_IDS.miembro);

    expect(mockRpc).toHaveBeenCalledWith('sgtd_enviar_ot', { p_ot_id: OT_ID_1, p_usuario_id: MOCK_IDS.miembro });
    expect(result.numero).toBe('OT-TI-0007');
  });

  it('si el RPC funciona pero el re-fetch falla, propaga el error del re-fetch', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    const fetchError = new Error('registro no encontrado');
    tableResponses.orden_trabajo = { data: null, error: fetchError };
    const { enviarOTAlJefe } = await import('@/api/ordenTrabajo');

    await expect(enviarOTAlJefe(OT_ID_1, MOCK_IDS.miembro)).rejects.toBe(fetchError);
  });
});

// ---------------------------------------------------------------------------
// rechazarOT / completarOT — recorte de campos de texto antes del RPC
// ---------------------------------------------------------------------------

describe('rechazarOT', () => {
  it('recorta el motivo antes de enviarlo', async () => {
    const { rechazarOT } = await import('@/api/ordenTrabajo');

    await rechazarOT(OT_ID_1, MOCK_IDS.jefe, '  Faltan datos  ');

    expect(mockRpc).toHaveBeenCalledWith('sgtd_rechazar_ot', {
      p_ot_id: OT_ID_1, p_usuario_id: MOCK_IDS.jefe, p_motivo: 'Faltan datos',
    });
  });
});

describe('completarOT', () => {
  it('recorta receptor y observaciones; observaciones ausentes se envían como null', async () => {
    const { completarOT } = await import('@/api/ordenTrabajo');

    await completarOT({
      otId: OT_ID_1, usuarioId: MOCK_IDS.miembro,
      receptorNombre: '  Juan Pérez  ', receptorDni: '  12345678  ', receptorCargo: '  Jefe de Sistemas  ',
    });

    expect(mockRpc).toHaveBeenCalledWith('sgtd_completar_ot', {
      p_ot_id: OT_ID_1, p_usuario_id: MOCK_IDS.miembro,
      p_receptor_nombre: 'Juan Pérez', p_receptor_dni: '12345678', p_receptor_cargo: 'Jefe de Sistemas',
      p_observaciones_cierre: null,
    });
  });
});

// ---------------------------------------------------------------------------
// getOrdenesPorTareaIds — dedup: solo la OT más reciente por tarea_id
// ---------------------------------------------------------------------------

describe('getOrdenesPorTareaIds', () => {
  it('sin ids, no consulta la BD y devuelve un Map vacío', async () => {
    const { getOrdenesPorTareaIds } = await import('@/api/ordenTrabajo');

    const result = await getOrdenesPorTareaIds([]);

    expect(result.size).toBe(0);
  });

  it('con varias OTs para la misma tarea, conserva solo la más reciente (orden created_at desc)', async () => {
    tableResponses.orden_trabajo = {
      data: [
        otRow({ id: OT_ID_2, tarea_id: TAREA_A, numero: 'OT-TI-0002', created_at: '2026-04-02T00:00:00Z' }),
        otRow({ id: OT_ID_1, tarea_id: TAREA_A, numero: 'OT-TI-0001', created_at: '2026-04-01T00:00:00Z' }),
        otRow({ id: 'aaaaaaaa-0000-4000-a000-000000000103', tarea_id: TAREA_B, numero: 'OT-TI-0003' }),
      ],
      error: null,
    };
    const { getOrdenesPorTareaIds } = await import('@/api/ordenTrabajo');

    const result = await getOrdenesPorTareaIds([TAREA_A, TAREA_B]);

    expect(result.size).toBe(2);
    expect(result.get(TAREA_A)?.numero).toBe('OT-TI-0002'); // la primera en llegar (más reciente)
    expect(result.get(TAREA_B)?.numero).toBe('OT-TI-0003');
  });
});

// ---------------------------------------------------------------------------
// getBorradorOTUsuario
// ---------------------------------------------------------------------------

describe('getBorradorOTUsuario', () => {
  it('sin borrador existente, devuelve null', async () => {
    tableResponses.orden_trabajo = { data: null, error: null };
    const { getBorradorOTUsuario } = await import('@/api/ordenTrabajo');

    await expect(getBorradorOTUsuario(MOCK_IDS.miembro)).resolves.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// crearOtDesdeTarea — defaults de prioridad y tipo/fecha opcionales
// ---------------------------------------------------------------------------

describe('crearOtDesdeTarea', () => {
  it('sin prioridad indicada, usa "normal" por defecto', async () => {
    mockRpc.mockResolvedValue({ data: OT_ID_1, error: null });
    const { crearOtDesdeTarea } = await import('@/api/ordenTrabajo');

    const id = await crearOtDesdeTarea({ tareaId: TAREA_A });

    expect(id).toBe(OT_ID_1);
    expect(mockRpc).toHaveBeenCalledWith('sgtd_crear_ot_desde_tarea', {
      p_tarea_id: TAREA_A, p_tipo_trabajo_id: null, p_fecha_estimada: null, p_prioridad: 'normal',
    });
  });
});
