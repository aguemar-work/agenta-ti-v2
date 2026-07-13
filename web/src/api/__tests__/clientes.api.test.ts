/**
 * src/api/__tests__/clientes.api.test.ts
 * Tests de integración de api/clientes.ts — catálogo de clientes (CRUD + soft-delete).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useWorkspaceStore } from '@/store/workspaceStore';

const WS_ID = 'aaaaaaaa-0000-4000-a000-000000000001';
const CLIENTE_ID = 'aaaaaaaa-0000-4000-a000-000000000002';

const { queryResult, queryCalls } = vi.hoisted(() => ({
  queryResult: { current: { data: null as unknown, error: null as unknown } },
  queryCalls: { insert: [] as unknown[], update: [] as unknown[], eq: [] as unknown[][] },
}));

function builder() {
  const b = {
    select: vi.fn(() => b),
    eq:     vi.fn((...args: unknown[]) => { queryCalls.eq.push(args); return b; }),
    order:  vi.fn(() => b),
    insert: vi.fn((rows: unknown[]) => { queryCalls.insert.push(rows[0]); return b; }),
    update: vi.fn((changes: unknown) => { queryCalls.update.push(changes); return b; }),
    single: vi.fn(() => Promise.resolve(queryResult.current)),
    then:   (resolve: (v: unknown) => unknown) => Promise.resolve(queryResult.current).then(resolve),
  };
  return b;
}

vi.mock('@/lib/insforge', () => ({
  getInsforge: () => ({ database: { from: () => builder() } }),
}));

function clienteRow(overrides: Record<string, unknown> = {}) {
  return { id: CLIENTE_ID, workspace_id: WS_ID, nombre: 'Acme', activo: true, created_at: '2026-01-01T00:00:00Z', ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  queryCalls.insert.length = 0;
  queryCalls.update.length = 0;
  queryCalls.eq.length = 0;
  queryResult.current = { data: null, error: null };
  useWorkspaceStore.setState({ workspaceActivo: null });
});

describe('getClientes', () => {
  it('descarta filas inválidas en silencio', async () => {
    queryResult.current = { data: [clienteRow(), { id: 'no-es-uuid' }], error: null };
    const { getClientes } = await import('@/api/clientes');

    await expect(getClientes()).resolves.toEqual([clienteRow()]);
  });
});

describe('crearCliente', () => {
  it('sin workspace activo, rechaza antes de tocar la BD', async () => {
    const { crearCliente } = await import('@/api/clientes');

    await expect(crearCliente({ nombre: 'Acme' })).rejects.toThrow('Sin workspace activo');
    expect(queryCalls.insert).toHaveLength(0);
  });

  it('con workspace activo, recorta el nombre e inserta con el workspace_id correcto', async () => {
    useWorkspaceStore.setState({ workspaceActivo: { id: WS_ID, organizacion_id: 'x', nombre: 'WS', activo: true } });
    queryResult.current = { data: clienteRow(), error: null };
    const { crearCliente } = await import('@/api/clientes');

    await crearCliente({ nombre: '  Acme  ' });

    expect(queryCalls.insert[0]).toEqual({ nombre: 'Acme', workspace_id: WS_ID });
  });
});

describe('desactivarCliente', () => {
  it('hace soft-delete (activo=false), no DELETE', async () => {
    const { desactivarCliente } = await import('@/api/clientes');

    await desactivarCliente(CLIENTE_ID);

    expect(queryCalls.update).toEqual([{ activo: false }]);
    expect(queryCalls.eq).toContainEqual(['id', CLIENTE_ID]);
  });
});
