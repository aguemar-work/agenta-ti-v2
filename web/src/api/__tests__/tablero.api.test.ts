/**
 * src/api/__tests__/tablero.api.test.ts
 *
 * Tests de la capa de API de tablero.ts — solo las funciones que orquestan
 * red (getTareasTablero, snapTareaFechaAlPorHacer, moverTareaColumna).
 *
 * NOTA: agruparTareasTablero es lógica de lib pura (sin red), ya cubierta
 * exhaustivamente en src/lib/__tests__/tablero.test.ts. No se duplica aquí.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { makeTarea, FECHAS, TEST_IDS } from '@/test/helpers';

// ---------------------------------------------------------------------------
// Mock del cliente InsForge
// ---------------------------------------------------------------------------

const mockRpc    = vi.fn();
const mockOrder  = vi.fn();
const mockSelect = vi.fn();
const mockEq     = vi.fn();
const mockFrom   = vi.fn();

vi.mock('@/lib/insforge', () => ({
  getInsforge: () => ({
    database: {
      from: mockFrom,
      rpc:  mockRpc,
    },
  }),
}));

vi.mock('@/lib/schemas', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/lib/schemas')>();
  return { ...orig, parseTarea: (r: unknown) => r };
});

vi.mock('@/lib/fecha', () => ({
  fechaLocalYmd: () => FECHAS.HOY,
}));

// Helpers para configurar cadenas de llamadas fluidas del builder
function setupSelectChain(data: unknown[], error: unknown = null) {
  mockOrder.mockResolvedValue({ data, error });
  mockSelect.mockReturnValue({ order: mockOrder });
  mockFrom.mockReturnValue({ select: mockSelect });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRpc.mockResolvedValue({ data: null, error: null });
});

// ---------------------------------------------------------------------------
// getTareasTablero
// ---------------------------------------------------------------------------

describe('getTareasTablero', () => {

  it('dado un resultado con tareas canceladas, cuando se obtienen las tareas, entonces las filtra del resultado', async () => {
    const { getTareasTablero } = await import('@/api/tablero');
    setupSelectChain([
      makeTarea({ id: 'id-1', estado: 'pendiente' }),
      makeTarea({ id: 'id-2', estado: 'cancelada' }),
    ]);

    const result = await getTareasTablero({
      usuarioId: 'todos', objetivoId: 'todos', mostrarCompletadas: false,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.estado).toBe('pendiente');
  });

  it('dado mostrarCompletadas=false, cuando hay tareas completadas, entonces también las filtra', async () => {
    const { getTareasTablero } = await import('@/api/tablero');
    setupSelectChain([
      makeTarea({ id: 'id-1', estado: 'pendiente' }),
      makeTarea({ id: 'id-2', estado: 'completada', fecha_completada: FECHAS.HOY + 'T00:00:00Z' }),
    ]);

    const result = await getTareasTablero({
      usuarioId: 'todos', objetivoId: 'todos', mostrarCompletadas: false,
    });

    expect(result.every((t) => t.estado !== 'completada')).toBe(true);
  });

  it('dado error del servidor, cuando se solicitan tareas, entonces la función relanza el error', async () => {
    const { getTareasTablero } = await import('@/api/tablero');
    setupSelectChain([], new Error('connection refused'));

    await expect(
      getTareasTablero({ usuarioId: 'todos', objetivoId: 'todos', mostrarCompletadas: false }),
    ).rejects.toThrow('connection refused');
  });

  it('dado filtro por usuarioId, cuando no es "todos", entonces aplica la restricción al query', async () => {
    const { getTareasTablero } = await import('@/api/tablero');

    // Necesitamos que .eq() se encadene antes del .order()
    mockOrder.mockResolvedValue({ data: [], error: null });
    const mockEqChain = { order: mockOrder };
    mockEq.mockReturnValue(mockEqChain);
    const mockSelectWithEq = { order: mockOrder, eq: mockEq };
    mockSelect.mockReturnValue(mockSelectWithEq);
    mockFrom.mockReturnValue({ select: mockSelect });

    await getTareasTablero({
      usuarioId:          TEST_IDS.miembro,
      objetivoId:         'todos',
      mostrarCompletadas: false,
    });

    expect(mockEq).toHaveBeenCalledWith('asignado_a', TEST_IDS.miembro);
  });
});

// ---------------------------------------------------------------------------
// snapTareaFechaAlPorHacer
// ---------------------------------------------------------------------------

describe('snapTareaFechaAlPorHacer', () => {

  it('dado tareaId y fecha de hoy, cuando se llama, entonces el RPC sgtd_snap_tarea_hoy se invoca con semana calculada', async () => {
    const { snapTareaFechaAlPorHacer } = await import('@/api/tablero');

    await expect(
      snapTareaFechaAlPorHacer(TEST_IDS.tarea1, FECHAS.HOY),
    ).resolves.toBeUndefined();

    expect(mockRpc).toHaveBeenCalledWith('sgtd_snap_tarea_hoy', {
      p_tarea_id: TEST_IDS.tarea1,
      p_hoy:      FECHAS.HOY,
      p_semana:   expect.stringMatching(/^\d{6}$/), // formato YYYYWW
    });
  });

  it('dado error del RPC, cuando se llama, entonces relanza el error', async () => {
    const { snapTareaFechaAlPorHacer } = await import('@/api/tablero');
    mockRpc.mockResolvedValue({ data: null, error: new Error('RLS violation') });

    await expect(
      snapTareaFechaAlPorHacer(TEST_IDS.tarea1, FECHAS.HOY),
    ).rejects.toThrow('RLS violation');
  });
});

// ---------------------------------------------------------------------------
// moverTareaColumna
// ---------------------------------------------------------------------------

describe('moverTareaColumna', () => {

  it('dado nueva columna "en_progreso" sin justificación, cuando se mueve, entonces el RPC se invoca con p_justificacion null', async () => {
    const { moverTareaColumna } = await import('@/api/tablero');

    await expect(
      moverTareaColumna(TEST_IDS.tarea1, 'en_progreso', TEST_IDS.miembro),
    ).resolves.toBeUndefined();

    expect(mockRpc).toHaveBeenCalledWith('sgtd_mover_tarea_columna', {
      p_tarea_id:      TEST_IDS.tarea1,
      p_nuevo_estado:  'en_progreso',
      p_usuario_id:    TEST_IDS.miembro,
      p_justificacion: null,
    });
  });

  it('dado cancelación con justificación, cuando se mueve, entonces el RPC recibe la justificación', async () => {
    const { moverTareaColumna } = await import('@/api/tablero');
    const justificacion = 'Ya no aplica al cierre del proyecto';

    await moverTareaColumna(TEST_IDS.tarea1, 'cancelada', TEST_IDS.miembro, justificacion);

    expect(mockRpc).toHaveBeenCalledWith('sgtd_mover_tarea_columna', expect.objectContaining({
      p_nuevo_estado:  'cancelada',
      p_justificacion: justificacion,
    }));
  });

  it('dado error del RPC, cuando se mueve, entonces relanza el error', async () => {
    const { moverTareaColumna } = await import('@/api/tablero');
    mockRpc.mockResolvedValue({ data: null, error: new Error('permission denied') });

    await expect(
      moverTareaColumna(TEST_IDS.tarea1, 'cancelada', TEST_IDS.miembro, 'justificación válida con diez'),
    ).rejects.toThrow('permission denied');
  });
});
