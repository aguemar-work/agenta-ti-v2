/**
 * src/api/__tests__/proyectos.api.test.ts
 * Tests de integración de api/proyectos.ts — catálogo de proyectos (CRUD + archivado).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useWorkspaceStore } from '@/store/workspaceStore';

const WS_ID = 'aaaaaaaa-0000-4000-a000-000000000001';
const PROYECTO_ID = 'aaaaaaaa-0000-4000-a000-000000000002';

const { queryResult, queryCalls } = vi.hoisted(() => ({
  queryResult: { current: { data: null as unknown, error: null as unknown } },
  queryCalls: { insert: [] as unknown[], update: [] as unknown[], eq: [] as unknown[][], neq: [] as unknown[][] },
}));

function builder() {
  const b = {
    select: vi.fn(() => b),
    eq:     vi.fn((...args: unknown[]) => { queryCalls.eq.push(args); return b; }),
    neq:    vi.fn((...args: unknown[]) => { queryCalls.neq.push(args); return b; }),
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

function proyectoRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PROYECTO_ID, workspace_id: WS_ID, cliente_id: null, nombre: 'Migración ERP',
    descripcion: null, estado: 'activo', created_at: '2026-01-01T00:00:00Z', ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  queryCalls.insert.length = 0;
  queryCalls.update.length = 0;
  queryCalls.eq.length = 0;
  queryCalls.neq.length = 0;
  queryResult.current = { data: null, error: null };
  useWorkspaceStore.setState({ workspaceActivo: null });
});

describe('getProyectos', () => {
  it('excluye archivados (neq estado=archivado) y descarta filas inválidas', async () => {
    queryResult.current = { data: [proyectoRow(), { id: 'no-es-uuid' }], error: null };
    const { getProyectos } = await import('@/api/proyectos');

    const result = await getProyectos();

    expect(result).toEqual([proyectoRow()]);
    expect(queryCalls.neq).toContainEqual(['estado', 'archivado']);
  });
});

describe('crearProyecto', () => {
  it('sin workspace activo, rechaza antes de tocar la BD', async () => {
    const { crearProyecto } = await import('@/api/proyectos');

    await expect(
      crearProyecto({ nombre: 'Migración ERP', cliente_id: null }),
    ).rejects.toThrow('Sin workspace activo');
    expect(queryCalls.insert).toHaveLength(0);
  });

  it('descripción vacía tras trim se guarda como null (no string vacío)', async () => {
    useWorkspaceStore.setState({ workspaceActivo: { id: WS_ID, organizacion_id: 'x', nombre: 'WS', activo: true } });
    queryResult.current = { data: proyectoRow(), error: null };
    const { crearProyecto } = await import('@/api/proyectos');

    await crearProyecto({ nombre: 'Migración ERP', descripcion: '   ', cliente_id: null });

    expect(queryCalls.insert[0]).toEqual(expect.objectContaining({ descripcion: null, estado: 'activo' }));
  });
});

describe('archivarProyecto', () => {
  it('cambia el estado a "archivado" (no DELETE)', async () => {
    const { archivarProyecto } = await import('@/api/proyectos');

    await archivarProyecto(PROYECTO_ID);

    expect(queryCalls.update).toEqual([{ estado: 'archivado' }]);
  });
});
