/**
 * src/api/__tests__/recurrencia.api.test.ts
 *
 * Tests de integración de la capa api/recurrencia.ts (mock de InsForge, patrón tablero.api.test.ts).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TEST_IDS } from '@/test/helpers';
import type { CrearRecurrenciaEventoInput } from '@/api/recurrencia';

// ---------------------------------------------------------------------------
// Mock del cliente InsForge
// ---------------------------------------------------------------------------

const { mockRpc, deleteCalls, deleteFailError } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  deleteCalls: [] as { table: string; column: string; value: string }[],
  deleteFailError: { current: null as Error | null },
}));

vi.mock('@/lib/insforge', () => ({
  getInsforge: () => ({
    database: {
      rpc: mockRpc,
      from: (table: string) => ({
        delete: () => ({
          eq: (column: string, value: string) => {
            deleteCalls.push({ table, column, value });
            if (deleteFailError.current) {
              return Promise.resolve({ error: deleteFailError.current });
            }
            return Promise.resolve({ error: null });
          },
        }),
      }),
    },
  }),
}));

const INPUT_VALIDO: CrearRecurrenciaEventoInput = {
  titulo:        '  Daily standup  ',
  tipo:          'reunion',
  hora_inicio:   '09:00',
  hora_fin:      '09:30',
  usuario_id:    TEST_IDS.miembro,
  dias_semana:   [1, 3, 5],
  fecha_inicio:  '2026-05-01',
  fecha_fin:     '2026-12-31',
  meses:         2,
};

const RECURRENCIA_ID = '99999999-0000-4000-a000-000000000099';
const EVENTO_ID     = '88888888-0000-4000-a000-000000000088';

beforeEach(() => {
  vi.clearAllMocks();
  deleteCalls.length = 0;
  deleteFailError.current = null;
  mockRpc.mockResolvedValue({ data: RECURRENCIA_ID, error: null });
});

// ---------------------------------------------------------------------------
// validarCrearRecurrenciaEventoInput
// ---------------------------------------------------------------------------

describe('validarCrearRecurrenciaEventoInput', () => {
  it('acepta un input válido', async () => {
    const { validarCrearRecurrenciaEventoInput } = await import('@/api/recurrencia');
    expect(() => validarCrearRecurrenciaEventoInput(INPUT_VALIDO)).not.toThrow();
  });

  it('rechaza fecha_fin anterior a fecha_inicio', async () => {
    const { validarCrearRecurrenciaEventoInput, RecurrenciaValidationError } =
      await import('@/api/recurrencia');

    expect(() =>
      validarCrearRecurrenciaEventoInput({
        ...INPUT_VALIDO,
        fecha_inicio: '2026-06-01',
        fecha_fin:    '2026-05-01',
      }),
    ).toThrow(RecurrenciaValidationError);

    expect(() =>
      validarCrearRecurrenciaEventoInput({
        ...INPUT_VALIDO,
        fecha_inicio: '2026-06-01',
        fecha_fin:    '2026-05-01',
      }),
    ).toThrow(/fecha de fin/i);
  });

  it('rechaza recurrencia sin días de semana', async () => {
    const { validarCrearRecurrenciaEventoInput, RecurrenciaValidationError } =
      await import('@/api/recurrencia');

    expect(() =>
      validarCrearRecurrenciaEventoInput({ ...INPUT_VALIDO, dias_semana: [] }),
    ).toThrow(RecurrenciaValidationError);

    expect(() =>
      validarCrearRecurrenciaEventoInput({ ...INPUT_VALIDO, dias_semana: [] }),
    ).toThrow(/día de la semana/i);
  });

  it('rechaza hora_fin anterior o igual a hora_inicio', async () => {
    const { validarCrearRecurrenciaEventoInput, RecurrenciaValidationError } =
      await import('@/api/recurrencia');

    expect(() =>
      validarCrearRecurrenciaEventoInput({
        ...INPUT_VALIDO,
        hora_inicio: '10:00',
        hora_fin:    '09:00',
      }),
    ).toThrow(RecurrenciaValidationError);
  });
});

// ---------------------------------------------------------------------------
// crearRecurrenciaEvento
// ---------------------------------------------------------------------------

describe('crearRecurrenciaEvento', () => {
  it('con input válido invoca el RPC con parámetros correctos', async () => {
    const { crearRecurrenciaEvento } = await import('@/api/recurrencia');

    const id = await crearRecurrenciaEvento(INPUT_VALIDO);

    expect(id).toBe(RECURRENCIA_ID);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('sgtd_crear_recurrencia_evento', {
      p_titulo:       'Daily standup',
      p_tipo:         'reunion',
      p_hora_inicio:  '09:00',
      p_hora_fin:     '09:30',
      p_usuario_id:   TEST_IDS.miembro,
      p_dias_semana:  [1, 3, 5],
      p_fecha_inicio: '2026-05-01',
      p_fecha_fin:    '2026-12-31',
      p_meses:        2,
    });
  });

  it('con fecha_fin inválida no llama al RPC', async () => {
    const { crearRecurrenciaEvento, RecurrenciaValidationError } =
      await import('@/api/recurrencia');

    await expect(
      crearRecurrenciaEvento({
        ...INPUT_VALIDO,
        fecha_inicio: '2026-06-15',
        fecha_fin:    '2026-06-01',
      }),
    ).rejects.toBeInstanceOf(RecurrenciaValidationError);

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('sin días de semana no llama al RPC', async () => {
    const { crearRecurrenciaEvento, RecurrenciaValidationError } =
      await import('@/api/recurrencia');

    await expect(
      crearRecurrenciaEvento({ ...INPUT_VALIDO, dias_semana: [] }),
    ).rejects.toBeInstanceOf(RecurrenciaValidationError);

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('propaga el error del RPC sin silenciarlo', async () => {
    const { crearRecurrenciaEvento } = await import('@/api/recurrencia');
    const dbError = Object.assign(new Error('violates check constraint'), {
      code: '23514',
    });
    mockRpc.mockResolvedValue({ data: null, error: dbError });

    await expect(crearRecurrenciaEvento(INPUT_VALIDO)).rejects.toBe(dbError);
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// eliminarEventoRecurrente
// ---------------------------------------------------------------------------

describe('eliminarEventoRecurrente', () => {
  it('alcance solo_este elimina únicamente la instancia indicada', async () => {
    const { eliminarEventoRecurrente } = await import('@/api/recurrencia');

    await eliminarEventoRecurrente({
      eventoId:      EVENTO_ID,
      recurrenciaId: RECURRENCIA_ID,
      alcance:       'solo_este',
    });

    expect(deleteCalls).toEqual([
      { table: 'evento', column: 'id', value: EVENTO_ID },
    ]);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('alcance toda_serie elimina instancias y la regla de recurrencia', async () => {
    const { eliminarEventoRecurrente } = await import('@/api/recurrencia');

    await eliminarEventoRecurrente({
      eventoId:      EVENTO_ID,
      recurrenciaId: RECURRENCIA_ID,
      alcance:       'toda_serie',
    });

    expect(deleteCalls).toEqual([
      { table: 'evento', column: 'recurrencia_id', value: RECURRENCIA_ID },
      { table: 'recurrencia_evento', column: 'id', value: RECURRENCIA_ID },
    ]);
  });

  it('toda_serie sin recurrencia_id falla antes de borrar', async () => {
    const { eliminarEventoRecurrente, RecurrenciaValidationError } =
      await import('@/api/recurrencia');

    await expect(
      eliminarEventoRecurrente({
        eventoId:      EVENTO_ID,
        recurrenciaId: null,
        alcance:       'toda_serie',
      }),
    ).rejects.toBeInstanceOf(RecurrenciaValidationError);

    expect(deleteCalls).toHaveLength(0);
  });

  it('propaga error de BD al eliminar sin silenciarlo', async () => {
    const { eliminarEventoRecurrente } = await import('@/api/recurrencia');
    deleteFailError.current = new Error('RLS policy violation');

    await expect(
      eliminarEventoRecurrente({
        eventoId:      EVENTO_ID,
        recurrenciaId: RECURRENCIA_ID,
        alcance:       'solo_este',
      }),
    ).rejects.toThrow('RLS policy violation');
  });
});
