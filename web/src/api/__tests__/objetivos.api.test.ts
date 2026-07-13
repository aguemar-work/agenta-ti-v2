/**
 * src/api/__tests__/objetivos.api.test.ts
 * Tests de integración de api/objetivos.ts — objetivos y su vínculo con tareas/OTs.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

const OBJ_ID = 'aaaaaaaa-0000-4000-a000-000000000001';
const USR_ID = 'aaaaaaaa-0000-4000-a000-000000000002';

const { mockRpc, queryResult, queryCalls } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  queryResult: { current: { data: null as unknown, error: null as unknown } },
  queryCalls: { insert: [] as unknown[], eq: [] as unknown[][] },
}));

function builder() {
  const b = {
    select: vi.fn(() => b),
    eq:     vi.fn((...args: unknown[]) => { queryCalls.eq.push(args); return b; }),
    order:  vi.fn(() => b),
    insert: vi.fn((rows: unknown[]) => { queryCalls.insert.push(rows[0]); return b; }),
    single: vi.fn(() => Promise.resolve(queryResult.current)),
    then:   (resolve: (v: unknown) => unknown) => Promise.resolve(queryResult.current).then(resolve),
  };
  return b;
}

vi.mock('@/lib/insforge', () => ({
  getInsforge: () => ({ database: { rpc: mockRpc, from: () => builder() } }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  queryCalls.insert.length = 0;
  queryCalls.eq.length = 0;
  queryResult.current = { data: null, error: null };
  mockRpc.mockResolvedValue({ data: null, error: null });
});

describe('crearObjetivo', () => {
  it('recorta título/descripción y usa "activo" como estado por defecto', async () => {
    queryResult.current = { data: { id: OBJ_ID, titulo: 'Objetivo' }, error: null };
    const { crearObjetivo } = await import('@/api/objetivos');

    await crearObjetivo({
      titulo: '  Reducir incidencias  ', descripcion: '  meta trimestral  ',
      creado_por: USR_ID, responsable_id: USR_ID,
    });

    expect(queryCalls.insert[0]).toEqual(expect.objectContaining({
      titulo: 'Reducir incidencias', descripcion: 'meta trimestral', estado: 'activo',
    }));
  });
});

describe('completarObjetivo', () => {
  it('invoca el RPC con los parámetros correctos', async () => {
    const { completarObjetivo } = await import('@/api/objetivos');

    await completarObjetivo({ objetivoId: OBJ_ID, usuarioId: USR_ID });

    expect(mockRpc).toHaveBeenCalledWith('sgtd_completar_objetivo', {
      p_objetivo_id: OBJ_ID, p_usuario_id: USR_ID,
    });
  });
});

describe('getOTsPorObjetivo', () => {
  it('filtra por objetivo_id', async () => {
    const { getOTsPorObjetivo } = await import('@/api/objetivos');

    await getOTsPorObjetivo(OBJ_ID);

    expect(queryCalls.eq).toContainEqual(['objetivo_id', OBJ_ID]);
  });
});

describe('eliminarObjetivo', () => {
  it('rechaza motivo menor a 10 caracteres sin llamar al RPC', async () => {
    const { eliminarObjetivo } = await import('@/api/objetivos');

    await expect(
      eliminarObjetivo({ objetivoId: OBJ_ID, usuarioId: USR_ID, motivo: 'corto' }),
    ).rejects.toThrow(/al menos 10 caracteres/);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('con motivo válido, invoca el RPC con el motivo recortado', async () => {
    const { eliminarObjetivo } = await import('@/api/objetivos');

    await eliminarObjetivo({ objetivoId: OBJ_ID, usuarioId: USR_ID, motivo: '  Ya no aplica  ' });

    expect(mockRpc).toHaveBeenCalledWith('sgtd_eliminar_objetivo', {
      p_objetivo_id: OBJ_ID, p_usuario_id: USR_ID, p_motivo: 'Ya no aplica',
    });
  });
});
