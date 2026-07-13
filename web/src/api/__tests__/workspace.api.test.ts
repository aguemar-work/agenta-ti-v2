/**
 * src/api/__tests__/workspace.api.test.ts
 *
 * Tests de integración de api/workspace.ts — resolución de organización/workspace
 * accesible del usuario (V5 multi-tenant). Cubre las reglas con más riesgo silencioso:
 * el fallback propietario-vs-membresía en getWorkspacesAccesiblesDeOrg, el filtrado
 * defensivo por organización/actividad en parseWorkspacesConRol, y el manejo de las
 * dos formas en que PostgREST puede embeber el workspace relacionado.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

const ORG_ID    = 'aaaaaaaa-0000-4000-a000-000000000001';
const OTRA_ORG  = 'aaaaaaaa-0000-4000-a000-000000000099';
const USER_ID   = 'bbbbbbbb-0000-4000-a000-000000000002';
const WS_ID     = 'cccccccc-0000-4000-a000-000000000003';
const WS_ID_2   = 'cccccccc-0000-4000-a000-000000000004';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockGetCurrentUser, mockFetchEsPlataformaOwnerCached, tableResponses, queryCalls } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockFetchEsPlataformaOwnerCached: vi.fn(),
  tableResponses: {} as Record<string, { data: unknown; error: unknown }>,
  queryCalls: {
    eq:     [] as { table: string; args: unknown[] }[],
    upsert: [] as { table: string; row: Record<string, unknown> }[],
  },
}));

function makeQueryBuilder(table: string) {
  const response = () => tableResponses[table] ?? { data: [], error: null };
  const builder = {
    select:      vi.fn(() => builder),
    eq:          vi.fn((...args: unknown[]) => { queryCalls.eq.push({ table, args }); return builder; }),
    order:       vi.fn(() => builder),
    not:         vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(response())),
    upsert:      vi.fn((rows: Record<string, unknown>[]) => {
      queryCalls.upsert.push({ table, row: rows[0] });
      return Promise.resolve(response());
    }),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(response()).then(resolve, reject),
  };
  return builder;
}

vi.mock('@/lib/insforge', () => ({
  getInsforge: () => ({
    database: { from: (table: string) => makeQueryBuilder(table) },
    auth:     { getCurrentUser: mockGetCurrentUser },
  }),
}));

vi.mock('@/api/plataforma', () => ({
  fetchEsPlataformaOwnerCached: mockFetchEsPlataformaOwnerCached,
}));

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(tableResponses)) delete tableResponses[k];
  queryCalls.eq.length = 0;
  queryCalls.upsert.length = 0;
  mockGetCurrentUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  mockFetchEsPlataformaOwnerCached.mockResolvedValue(false);
});

// ---------------------------------------------------------------------------
// getOrgsDelUsuario
// ---------------------------------------------------------------------------

describe('getOrgsDelUsuario', () => {
  it('sin sesión activa, rechaza antes de consultar la BD', async () => {
    mockGetCurrentUser.mockResolvedValue({ data: { user: null }, error: null });
    const { getOrgsDelUsuario } = await import('@/api/workspace');

    await expect(getOrgsDelUsuario()).rejects.toThrow('Sin sesión activa');
    expect(queryCalls.eq).toHaveLength(0);
  });

  it('filtra únicamente organizaciones activas y descarta filas inválidas en silencio', async () => {
    tableResponses.organizacion = {
      data: [
        { id: ORG_ID, nombre: 'Nufago', slug: 'nufago', activa: true },
        { id: 'no-es-uuid', nombre: 'Corrupta', slug: 'x', activa: true }, // fila inválida
      ],
      error: null,
    };
    const { getOrgsDelUsuario } = await import('@/api/workspace');

    const result = await getOrgsDelUsuario();

    expect(result).toEqual([{ id: ORG_ID, nombre: 'Nufago', slug: 'nufago', activa: true }]);
    expect(queryCalls.eq).toContainEqual({ table: 'organizacion', args: ['activa', true] });
  });
});

// ---------------------------------------------------------------------------
// getWorkspacesDelUsuario — dual embed shape + filtrado defensivo
// ---------------------------------------------------------------------------

describe('getWorkspacesDelUsuario', () => {
  it('acepta el embed como clave "workspace"', async () => {
    tableResponses.workspace_member = {
      data: [{ rol: 'jefe', workspace: { id: WS_ID, organizacion_id: ORG_ID, nombre: 'WS', activo: true } }],
      error: null,
    };
    const { getWorkspacesDelUsuario } = await import('@/api/workspace');

    const result = await getWorkspacesDelUsuario(ORG_ID);

    expect(result).toEqual([{ id: WS_ID, organizacion_id: ORG_ID, nombre: 'WS', activo: true, rol: 'jefe' }]);
  });

  it('acepta el embed como objeto anidado en "workspace_id" (forma alterna de PostgREST)', async () => {
    tableResponses.workspace_member = {
      data: [{ rol: 'miembro', workspace_id: { id: WS_ID, organizacion_id: ORG_ID, nombre: 'WS', activo: true } }],
      error: null,
    };
    const { getWorkspacesDelUsuario } = await import('@/api/workspace');

    const result = await getWorkspacesDelUsuario(ORG_ID);

    expect(result).toEqual([{ id: WS_ID, organizacion_id: ORG_ID, nombre: 'WS', activo: true, rol: 'miembro' }]);
  });

  it('descarta silenciosamente un workspace de OTRA organización (defensa multi-tenant)', async () => {
    tableResponses.workspace_member = {
      data: [{ rol: 'jefe', workspace: { id: WS_ID, organizacion_id: OTRA_ORG, nombre: 'WS ajeno', activo: true } }],
      error: null,
    };
    const { getWorkspacesDelUsuario } = await import('@/api/workspace');

    const result = await getWorkspacesDelUsuario(ORG_ID);

    expect(result).toEqual([]);
  });

  it('descarta silenciosamente un workspace inactivo', async () => {
    tableResponses.workspace_member = {
      data: [{ rol: 'jefe', workspace: { id: WS_ID, organizacion_id: ORG_ID, nombre: 'WS', activo: false } }],
      error: null,
    };
    const { getWorkspacesDelUsuario } = await import('@/api/workspace');

    const result = await getWorkspacesDelUsuario(ORG_ID);

    expect(result).toEqual([]);
  });

  it('propaga el error de la BD sin silenciarlo', async () => {
    const dbError = new Error('permission denied');
    tableResponses.workspace_member = { data: null, error: dbError };
    const { getWorkspacesDelUsuario } = await import('@/api/workspace');

    await expect(getWorkspacesDelUsuario(ORG_ID)).rejects.toBe(dbError);
  });
});

// ---------------------------------------------------------------------------
// getWorkspacesDeOrg — lectura directa (dueño superadmin), fuerza rol 'jefe'
// ---------------------------------------------------------------------------

describe('getWorkspacesDeOrg', () => {
  it('devuelve los workspaces activos de la org con rol forzado a "jefe"', async () => {
    tableResponses.workspace = {
      data: [{ id: WS_ID, organizacion_id: ORG_ID, nombre: 'WS', activo: true }],
      error: null,
    };
    const { getWorkspacesDeOrg } = await import('@/api/workspace');

    const result = await getWorkspacesDeOrg(ORG_ID);

    expect(result).toEqual([{ id: WS_ID, organizacion_id: ORG_ID, nombre: 'WS', activo: true, rol: 'jefe' }]);
  });
});

// ---------------------------------------------------------------------------
// getWorkspacesAccesiblesDeOrg — fallback membresía → dueño de plataforma → []
// ---------------------------------------------------------------------------

describe('getWorkspacesAccesiblesDeOrg', () => {
  it('con membresía propia, la devuelve y NO consulta si es dueño de plataforma', async () => {
    tableResponses.workspace_member = {
      data: [{ rol: 'miembro', workspace: { id: WS_ID, organizacion_id: ORG_ID, nombre: 'WS', activo: true } }],
      error: null,
    };
    const { getWorkspacesAccesiblesDeOrg } = await import('@/api/workspace');

    const result = await getWorkspacesAccesiblesDeOrg(ORG_ID);

    expect(result).toHaveLength(1);
    expect(mockFetchEsPlataformaOwnerCached).not.toHaveBeenCalled();
  });

  it('sin membresía propia pero siendo dueño de plataforma, cae a los workspaces de la org', async () => {
    tableResponses.workspace_member = { data: [], error: null };
    tableResponses.workspace = {
      data: [{ id: WS_ID_2, organizacion_id: ORG_ID, nombre: 'WS Org', activo: true }],
      error: null,
    };
    mockFetchEsPlataformaOwnerCached.mockResolvedValue(true);
    const { getWorkspacesAccesiblesDeOrg } = await import('@/api/workspace');

    const result = await getWorkspacesAccesiblesDeOrg(ORG_ID);

    expect(result).toEqual([{ id: WS_ID_2, organizacion_id: ORG_ID, nombre: 'WS Org', activo: true, rol: 'jefe' }]);
  });

  it('sin membresía propia y sin ser dueño de plataforma, no expone ningún workspace', async () => {
    tableResponses.workspace_member = { data: [], error: null };
    mockFetchEsPlataformaOwnerCached.mockResolvedValue(false);
    const { getWorkspacesAccesiblesDeOrg } = await import('@/api/workspace');

    const result = await getWorkspacesAccesiblesDeOrg(ORG_ID);

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getPreferenciaWorkspace / guardarPreferenciaWorkspace
// ---------------------------------------------------------------------------

describe('getPreferenciaWorkspace', () => {
  it('sin fila guardada, devuelve null', async () => {
    tableResponses.usuario_preferencia = { data: null, error: null };
    const { getPreferenciaWorkspace } = await import('@/api/workspace');

    await expect(getPreferenciaWorkspace()).resolves.toBeNull();
  });

  it('con fila guardada, devuelve la preferencia parseada', async () => {
    tableResponses.usuario_preferencia = {
      data: { ultima_org_id: ORG_ID, ultima_workspace_id: WS_ID },
      error: null,
    };
    const { getPreferenciaWorkspace } = await import('@/api/workspace');

    await expect(getPreferenciaWorkspace()).resolves.toEqual({
      ultima_org_id: ORG_ID, ultima_workspace_id: WS_ID,
    });
  });
});

describe('guardarPreferenciaWorkspace', () => {
  it('hace upsert con usuario_id de la sesión y los ids indicados', async () => {
    const { guardarPreferenciaWorkspace } = await import('@/api/workspace');

    await guardarPreferenciaWorkspace(ORG_ID, WS_ID);

    expect(queryCalls.upsert).toHaveLength(1);
    expect(queryCalls.upsert[0].table).toBe('usuario_preferencia');
    expect(queryCalls.upsert[0].row).toEqual(expect.objectContaining({
      usuario_id: USER_ID, ultima_org_id: ORG_ID, ultima_workspace_id: WS_ID,
    }));
  });
});

// ---------------------------------------------------------------------------
// getModulosDelWorkspace — no requiere sesión propia (RLS lo filtra en servidor)
// ---------------------------------------------------------------------------

describe('getModulosDelWorkspace', () => {
  it('devuelve solo las claves de módulos activos, sin exigir sesión', async () => {
    mockGetCurrentUser.mockResolvedValue({ data: { user: null }, error: new Error('no session') });
    tableResponses.workspace_modulo = {
      data: [{ modulo: 'areas' }, { modulo: 'clientes' }],
      error: null,
    };
    const { getModulosDelWorkspace } = await import('@/api/workspace');

    const result = await getModulosDelWorkspace(WS_ID);

    expect(result).toEqual(['areas', 'clientes']);
  });
});
