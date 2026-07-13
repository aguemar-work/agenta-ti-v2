/**
 * src/api/__tests__/metricas.api.test.ts
 * Tests de integración de api/metricas.ts — conteo de OTs por estado en un rango.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

const { queryResult, mockGte, mockLte } = vi.hoisted(() => ({
  queryResult: { current: { data: [] as unknown, error: null as unknown } },
  mockGte: vi.fn(),
  mockLte: vi.fn(),
}));

function builder() {
  const b = {
    select: vi.fn(() => b),
    gte:    vi.fn((...args: unknown[]) => { mockGte(...args); return b; }),
    lte:    vi.fn((...args: unknown[]) => { mockLte(...args); return b; }),
    then:   (resolve: (v: unknown) => unknown) => Promise.resolve(queryResult.current).then(resolve),
  };
  return b;
}

vi.mock('@/lib/insforge', () => ({
  getInsforge: () => ({ database: { from: () => builder() } }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  queryResult.current = { data: [], error: null };
});

describe('getOtEstadoCounts', () => {
  it('cuenta las OTs agrupadas por estado dentro del rango indicado', async () => {
    queryResult.current = {
      data: [{ estado: 'pendiente' }, { estado: 'pendiente' }, { estado: 'aprobada' }],
      error: null,
    };
    const { getOtEstadoCounts } = await import('@/api/metricas');

    const result = await getOtEstadoCounts('2026-04-01', '2026-04-30');

    expect(result).toEqual({ pendiente: 2, aprobada: 1 });
    expect(mockGte).toHaveBeenCalledWith('created_at', '2026-04-01T00:00:00.000Z');
    expect(mockLte).toHaveBeenCalledWith('created_at', '2026-04-30T23:59:59.999Z');
  });

  it('sin OTs en el rango, devuelve un objeto vacío (no undefined ni null)', async () => {
    queryResult.current = { data: [], error: null };
    const { getOtEstadoCounts } = await import('@/api/metricas');

    await expect(getOtEstadoCounts('2026-04-01', '2026-04-30')).resolves.toEqual({});
  });

  it('propaga el error de la BD', async () => {
    const dbError = new Error('permission denied');
    queryResult.current = { data: null, error: dbError };
    const { getOtEstadoCounts } = await import('@/api/metricas');

    await expect(getOtEstadoCounts('2026-04-01', '2026-04-30')).rejects.toBe(dbError);
  });
});
