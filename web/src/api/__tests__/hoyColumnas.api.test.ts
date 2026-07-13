/**
 * src/api/__tests__/hoyColumnas.api.test.ts
 *
 * Tests de integración de api/hoyColumnas.ts — vista HOY (incidencias + bitácora).
 * Cubre el orden de notas de bitácora (no convertidas primero, luego por fecha
 * desc) y el patrón RPC+re-fetch de crearIncidencia.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockRpc, tableResponses } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  tableResponses: {} as Record<string, { data: unknown; error: unknown }>,
}));

function builder(table: string) {
  const response = () => tableResponses[table] ?? { data: [], error: null };
  const b = {
    select: vi.fn(() => b),
    eq:     vi.fn(() => b),
    in:     vi.fn(() => b),
    gte:    vi.fn(() => b),
    lte:    vi.fn(() => b),
    order:  vi.fn(() => b),
    limit:  vi.fn(() => b),
    insert: vi.fn(() => b),
    single: vi.fn(() => Promise.resolve(response())),
    then:   (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(response()).then(resolve, reject),
  };
  return b;
}

vi.mock('@/lib/insforge', () => ({
  getInsforge: () => ({ database: { rpc: mockRpc, from: (table: string) => builder(table) } }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(tableResponses)) delete tableResponses[k];
  mockRpc.mockResolvedValue({ data: null, error: null });
});

function notaRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'aaaaaaaa-0000-4000-a000-000000000090', contenido: 'nota',
    usuario_id: 'aaaaaaaa-0000-4000-a000-000000000002', objetivo_id: null,
    visibilidad: 'privado', convertida_en: null,
    created_at: '2026-04-29T00:00:00Z', updated_at: '2026-04-29T00:00:00Z',
    ...overrides,
  };
}

function tareaRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'aaaaaaaa-0000-4000-a000-000000000001', titulo: 'Tarea', descripcion: null,
    estado: 'pendiente', tipo: 'planificada', prioridad: 'media',
    fecha_planificada: '2026-04-29', semana_planificada: '202618', fecha_completada: null,
    asignado_a: 'aaaaaaaa-0000-4000-a000-000000000002', objetivo_id: null,
    creado_por: 'aaaaaaaa-0000-4000-a000-000000000002', es_imprevisto: true, nota_origen_id: null,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getNotasBitacoraRecientes — orden: no convertidas primero, luego más reciente
// ---------------------------------------------------------------------------

describe('getNotasBitacoraRecientes', () => {
  const ID_VIEJA_CONVERTIDA    = 'aaaaaaaa-0000-4000-a000-000000000091';
  const ID_NUEVA_SIN_CONVERTIR = 'aaaaaaaa-0000-4000-a000-000000000092';
  const ID_VIEJA_SIN_CONVERTIR = 'aaaaaaaa-0000-4000-a000-000000000093';

  it('ordena las notas no convertidas antes que las convertidas, y por fecha descendente dentro de cada grupo', async () => {
    tableResponses.nota_bitacora = {
      data: [
        notaRow({ id: ID_VIEJA_CONVERTIDA, convertida_en: 'tarea', created_at: '2026-04-01T00:00:00Z' }),
        notaRow({ id: ID_NUEVA_SIN_CONVERTIR, convertida_en: null, created_at: '2026-04-10T00:00:00Z' }),
        notaRow({ id: ID_VIEJA_SIN_CONVERTIR, convertida_en: null, created_at: '2026-04-05T00:00:00Z' }),
      ],
      error: null,
    };
    const { getNotasBitacoraRecientes } = await import('@/api/hoyColumnas');

    const result = await getNotasBitacoraRecientes('u1');

    expect(result.map((n) => n.id)).toEqual([ID_NUEVA_SIN_CONVERTIR, ID_VIEJA_SIN_CONVERTIR, ID_VIEJA_CONVERTIDA]);
  });
});

// ---------------------------------------------------------------------------
// getIncidenciasAbiertas — solo estados activos + imprevistos
// ---------------------------------------------------------------------------

describe('getIncidenciasAbiertas', () => {
  it('descarta filas que no cumplen el schema de Tarea', async () => {
    tableResponses.tarea_activa = { data: [tareaRow({ estado: 'estado_invalido' })], error: null };
    const { getIncidenciasAbiertas } = await import('@/api/hoyColumnas');

    await expect(getIncidenciasAbiertas('u1')).rejects.toThrow();
  });

  it('con datos válidos, los devuelve parseados', async () => {
    tableResponses.tarea_activa = { data: [tareaRow()], error: null };
    const { getIncidenciasAbiertas } = await import('@/api/hoyColumnas');

    await expect(getIncidenciasAbiertas('u1')).resolves.toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// crearIncidencia — RPC (devuelve UUID) + re-fetch de la tarea completa
// ---------------------------------------------------------------------------

describe('crearIncidencia', () => {
  it('si el RPC falla, no intenta el re-fetch', async () => {
    const rpcError = new Error('datos inválidos');
    mockRpc.mockResolvedValue({ data: null, error: rpcError });
    const { crearIncidencia } = await import('@/api/hoyColumnas');

    await expect(crearIncidencia({
      titulo: 'Falla de red', prioridad: 'alta', fecha_planificada: '2026-04-29', ya_resuelta: false,
    })).rejects.toBe(rpcError);
  });

  it('con RPC exitoso, re-consulta la tarea creada por su id', async () => {
    mockRpc.mockResolvedValue({ data: tareaRow().id, error: null });
    tableResponses.tarea_activa = { data: tareaRow(), error: null };
    const { crearIncidencia } = await import('@/api/hoyColumnas');

    const result = await crearIncidencia({
      titulo: 'Falla de red', prioridad: 'alta', fecha_planificada: '2026-04-29', ya_resuelta: false,
    });

    expect(result.id).toBe(tareaRow().id);
  });

  it('recorta el título y calcula la semana ISO antes de invocar el RPC', async () => {
    mockRpc.mockResolvedValue({ data: tareaRow().id, error: null });
    tableResponses.tarea_activa = { data: tareaRow(), error: null };
    const { crearIncidencia } = await import('@/api/hoyColumnas');

    await crearIncidencia({
      titulo: '  Falla de red  ', prioridad: 'alta', fecha_planificada: '2026-04-29', ya_resuelta: true,
    });

    expect(mockRpc).toHaveBeenCalledWith('sgtd_crear_incidencia', expect.objectContaining({
      p_titulo: 'Falla de red', p_semana: '202618', p_ya_resuelta: true,
    }));
  });
});

// ---------------------------------------------------------------------------
// convertirNotaEnTarea / convertirNotaEnEvento
// ---------------------------------------------------------------------------

describe('convertirNotaEnTarea', () => {
  it('descripción ausente se envía como string vacío (no null/undefined)', async () => {
    mockRpc.mockResolvedValue({ data: 'nueva-tarea-id', error: null });
    const { convertirNotaEnTarea } = await import('@/api/hoyColumnas');

    await convertirNotaEnTarea({
      notaId: 'n1', titulo: 'Título', prioridad: 'media',
      fecha_planificada: '2026-04-29', asignado_a: 'u1', creado_por: 'u1',
    });

    expect(mockRpc).toHaveBeenCalledWith('sgtd_convertir_nota_en_tarea', expect.objectContaining({
      p_descripcion: '',
    }));
  });
});
