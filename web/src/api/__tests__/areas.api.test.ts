/**
 * src/api/__tests__/areas.api.test.ts
 * Tests de integración de api/areas.ts — catálogo de áreas (CRUD + soft-delete).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useWorkspaceStore } from '@/store/workspaceStore';

const WS_ID = 'aaaaaaaa-0000-4000-a000-000000000001';
const AREA_ID = 'aaaaaaaa-0000-4000-a000-000000000002';

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

function areaRow(overrides: Record<string, unknown> = {}) {
  return { id: AREA_ID, workspace_id: WS_ID, nombre: 'Sistemas', activo: true, created_at: '2026-01-01T00:00:00Z', ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  queryCalls.insert.length = 0;
  queryCalls.update.length = 0;
  queryCalls.eq.length = 0;
  queryResult.current = { data: null, error: null };
  useWorkspaceStore.setState({ workspaceActivo: null });
});

describe('getAreas', () => {
  it('descarta filas inválidas en silencio', async () => {
    queryResult.current = { data: [areaRow(), { id: 'no-es-uuid' }], error: null };
    const { getAreas } = await import('@/api/areas');

    await expect(getAreas()).resolves.toEqual([areaRow()]);
  });
});

describe('crearArea', () => {
  it('sin workspace activo, rechaza antes de tocar la BD', async () => {
    const { crearArea } = await import('@/api/areas');

    await expect(crearArea({ nombre: 'Sistemas' })).rejects.toThrow('Sin workspace activo');
    expect(queryCalls.insert).toHaveLength(0);
  });

  it('con workspace activo, recorta el nombre e inserta con el workspace_id correcto', async () => {
    useWorkspaceStore.setState({ workspaceActivo: { id: WS_ID, organizacion_id: 'x', nombre: 'WS', activo: true } });
    queryResult.current = { data: areaRow(), error: null };
    const { crearArea } = await import('@/api/areas');

    await crearArea({ nombre: '  Sistemas  ' });

    expect(queryCalls.insert[0]).toEqual({ nombre: 'Sistemas', workspace_id: WS_ID });
  });

  it('respuesta inválida de la BD lanza error explícito en vez de devolver basura', async () => {
    useWorkspaceStore.setState({ workspaceActivo: { id: WS_ID, organizacion_id: 'x', nombre: 'WS', activo: true } });
    queryResult.current = { data: { id: 'no-es-uuid' }, error: null };
    const { crearArea } = await import('@/api/areas');

    await expect(crearArea({ nombre: 'X' })).rejects.toThrow(/inválida/i);
  });
});

describe('desactivarArea', () => {
  it('hace soft-delete (activo=false), no DELETE', async () => {
    const { desactivarArea } = await import('@/api/areas');

    await desactivarArea(AREA_ID);

    expect(queryCalls.update).toEqual([{ activo: false }]);
    expect(queryCalls.eq).toContainEqual(['id', AREA_ID]);
  });
});
