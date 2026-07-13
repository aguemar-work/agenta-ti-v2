/**
 * src/api/__tests__/usuarios.api.test.ts
 * Tests de integración de api/usuarios.ts — listas de usuarios para selectores.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockEq, mockOrder, queryResult } = vi.hoisted(() => ({
  mockEq: vi.fn(),
  mockOrder: vi.fn(),
  queryResult: { current: { data: [] as unknown, error: null as unknown } },
}));

function builder() {
  const b = {
    select: vi.fn(() => b),
    eq:     vi.fn((...args: unknown[]) => { mockEq(...args); return b; }),
    order:  vi.fn((...args: unknown[]) => { mockOrder(...args); return b; }),
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

describe('getUsuariosActivosParaAsignacion', () => {
  it('filtra por activo=true y ordena por nombre', async () => {
    queryResult.current = { data: [{ id: '1', nombre: 'Ana', email: 'a@x.com' }], error: null };
    const { getUsuariosActivosParaAsignacion } = await import('@/api/usuarios');

    const result = await getUsuariosActivosParaAsignacion();

    expect(result).toEqual([{ id: '1', nombre: 'Ana', email: 'a@x.com' }]);
    expect(mockEq).toHaveBeenCalledWith('activo', true);
    expect(mockOrder).toHaveBeenCalledWith('nombre');
  });

  it('propaga el error de la BD', async () => {
    const dbError = new Error('permission denied');
    queryResult.current = { data: null, error: dbError };
    const { getUsuariosActivosParaAsignacion } = await import('@/api/usuarios');

    await expect(getUsuariosActivosParaAsignacion()).rejects.toBe(dbError);
  });
});

describe('getJefesActivosParaNotificacion', () => {
  it('filtra por activo=true Y rol=jefe', async () => {
    const { getJefesActivosParaNotificacion } = await import('@/api/usuarios');

    await getJefesActivosParaNotificacion();

    expect(mockEq).toHaveBeenCalledWith('activo', true);
    expect(mockEq).toHaveBeenCalledWith('rol', 'jefe');
  });
});
