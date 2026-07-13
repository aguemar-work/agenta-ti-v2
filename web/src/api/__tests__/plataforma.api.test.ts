/**
 * src/api/__tests__/plataforma.api.test.ts
 *
 * Tests de integración de api/plataforma.ts — operaciones de dueño de plataforma
 * (alto privilegio: eliminar usuarios, desactivar organizaciones, activar módulos).
 * Cubre las reglas con más riesgo silencioso: el cacheo por sesión de
 * fetchEsPlataformaOwnerCached (si dedupe mal, se re-consulta de más o se cachea
 * un resultado de OTRO usuario), la normalización de `orgs` cuando la RPC la
 * devuelve como string JSON en vez de array, y que una respuesta corrupta de RPC
 * falle explícito en vez de propagar datos inválidos.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/store/authStore';
import type { Usuario } from '@/types';

const ORG_ID = 'aaaaaaaa-0000-4000-a000-000000000001';
const WS_ID  = 'aaaaaaaa-0000-4000-a000-000000000002';
const USR_ID = 'aaaaaaaa-0000-4000-a000-000000000003';

const { mockRpc, mockInvoke } = vi.hoisted(() => ({
  mockRpc:    vi.fn(),
  mockInvoke: vi.fn(),
}));

vi.mock('@/lib/insforge', () => ({
  getInsforge: () => ({
    database:  { rpc: mockRpc },
    functions: { invoke: mockInvoke },
  }),
}));

function makeUsuario(overrides: Partial<Usuario> = {}): Usuario {
  return {
    id: USR_ID, nombre: 'Ana', email: 'ana@nufago.com', rol: 'miembro',
    activo: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  queryClient.clear();
  useAuthStore.setState({ authUser: null, usuario: null, isLoading: false });
});

// ---------------------------------------------------------------------------
// fetchEsPlataformaOwner
// ---------------------------------------------------------------------------

describe('fetchEsPlataformaOwner', () => {
  it('respuesta no-booleana de la RPC se trata como false (no lanza)', async () => {
    mockRpc.mockResolvedValue({ data: 'no-es-booleano', error: null });
    const { fetchEsPlataformaOwner } = await import('@/api/plataforma');

    await expect(fetchEsPlataformaOwner()).resolves.toBe(false);
  });

  it('propaga el error del RPC', async () => {
    const dbError = new Error('permission denied');
    mockRpc.mockResolvedValue({ data: null, error: dbError });
    const { fetchEsPlataformaOwner } = await import('@/api/plataforma');

    await expect(fetchEsPlataformaOwner()).rejects.toBe(dbError);
  });
});

// ---------------------------------------------------------------------------
// fetchEsPlataformaOwnerCached — dedupe por usuario vía TanStack Query
// ---------------------------------------------------------------------------

describe('fetchEsPlataformaOwnerCached', () => {
  it('sin usuario en sesión, devuelve false SIN llamar al RPC', async () => {
    const { fetchEsPlataformaOwnerCached } = await import('@/api/plataforma');

    await expect(fetchEsPlataformaOwnerCached()).resolves.toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('con usuario en sesión, llama al RPC y devuelve el resultado', async () => {
    useAuthStore.setState({ usuario: makeUsuario() });
    mockRpc.mockResolvedValue({ data: true, error: null });
    const { fetchEsPlataformaOwnerCached } = await import('@/api/plataforma');

    await expect(fetchEsPlataformaOwnerCached()).resolves.toBe(true);
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('llamadas repetidas para el MISMO usuario deduplican (no repiten el RPC)', async () => {
    useAuthStore.setState({ usuario: makeUsuario() });
    mockRpc.mockResolvedValue({ data: true, error: null });
    const { fetchEsPlataformaOwnerCached } = await import('@/api/plataforma');

    await fetchEsPlataformaOwnerCached();
    await fetchEsPlataformaOwnerCached();
    await fetchEsPlataformaOwnerCached();

    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('cambiar de usuario en sesión invalida el cache anterior (no arrastra el resultado del otro usuario)', async () => {
    useAuthStore.setState({ usuario: makeUsuario({ id: USR_ID }) });
    mockRpc.mockResolvedValue({ data: true, error: null });
    const { fetchEsPlataformaOwnerCached } = await import('@/api/plataforma');
    await expect(fetchEsPlataformaOwnerCached()).resolves.toBe(true);

    useAuthStore.setState({ usuario: makeUsuario({ id: 'bbbbbbbb-0000-4000-a000-000000000099' }) });
    mockRpc.mockResolvedValue({ data: false, error: null });

    await expect(fetchEsPlataformaOwnerCached()).resolves.toBe(false);
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// fetchUsuariosPlataforma — normalización de `orgs` (array | string JSON | corrupto)
// ---------------------------------------------------------------------------

describe('fetchUsuariosPlataforma', () => {
  const ORG_MEMBRESIA = {
    organizacion_id: ORG_ID, organizacion_nombre: 'Nufago',
    workspace_id: WS_ID, rol: 'jefe',
  };

  it('acepta `orgs` ya como array', async () => {
    mockRpc.mockResolvedValue({
      data: [{
        usuario_id: USR_ID, nombre: 'Ana', email: 'ana@nufago.com', activo: true,
        created_at: '2026-01-01T00:00:00Z', orgs: [ORG_MEMBRESIA],
      }],
      error: null,
    });
    const { fetchUsuariosPlataforma } = await import('@/api/plataforma');

    const result = await fetchUsuariosPlataforma();

    expect(result).toHaveLength(1);
    expect(result[0].orgs).toEqual([ORG_MEMBRESIA]);
  });

  it('acepta `orgs` como string JSON serializado (RPC lo devuelve así en algunos casos)', async () => {
    mockRpc.mockResolvedValue({
      data: [{
        usuario_id: USR_ID, nombre: 'Ana', email: 'ana@nufago.com', activo: true,
        created_at: '2026-01-01T00:00:00Z', orgs: JSON.stringify([ORG_MEMBRESIA]),
      }],
      error: null,
    });
    const { fetchUsuariosPlataforma } = await import('@/api/plataforma');

    const result = await fetchUsuariosPlataforma();

    expect(result[0].orgs).toEqual([ORG_MEMBRESIA]);
  });

  it('`orgs` con JSON corrupto se normaliza a [] en vez de lanzar', async () => {
    mockRpc.mockResolvedValue({
      data: [{
        usuario_id: USR_ID, nombre: 'Ana', email: 'ana@nufago.com', activo: true,
        created_at: '2026-01-01T00:00:00Z', orgs: '{esto no es JSON válido',
      }],
      error: null,
    });
    const { fetchUsuariosPlataforma } = await import('@/api/plataforma');

    const result = await fetchUsuariosPlataforma();

    expect(result[0].orgs).toEqual([]);
  });

  it('descarta silenciosamente filas de usuario que no cumplen el schema', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { usuario_id: 'no-es-uuid', nombre: 'Corrupto' }, // fila inválida
      ],
      error: null,
    });
    const { fetchUsuariosPlataforma } = await import('@/api/plataforma');

    await expect(fetchUsuariosPlataforma()).resolves.toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// asignarUsuarioAOrg (deprecated pero aún activo) / fetchModulosOrg / setModuloOrg
// ---------------------------------------------------------------------------

describe('asignarUsuarioAOrg', () => {
  it('invoca el RPC con los parámetros correctos y devuelve la asignación parseada', async () => {
    mockRpc.mockResolvedValue({
      data: { usuario_id: USR_ID, organizacion_id: ORG_ID, workspace_id: WS_ID, rol: 'jefe' },
      error: null,
    });
    const { asignarUsuarioAOrg } = await import('@/api/plataforma');

    const result = await asignarUsuarioAOrg(USR_ID, ORG_ID, 'jefe');

    expect(mockRpc).toHaveBeenCalledWith('sgtd_asignar_usuario_a_organizacion', {
      p_usuario_id: USR_ID, p_organizacion_id: ORG_ID, p_rol: 'jefe',
    });
    expect(result.rol).toBe('jefe');
  });

  it('con respuesta de forma inesperada, lanza error explícito', async () => {
    mockRpc.mockResolvedValue({ data: { algo: 'distinto' }, error: null });
    const { asignarUsuarioAOrg } = await import('@/api/plataforma');

    await expect(asignarUsuarioAOrg(USR_ID, ORG_ID, 'jefe')).rejects.toThrow(/respuesta inesperada/i);
  });
});

describe('fetchModulosOrg', () => {
  it('descarta filas de módulo inválidas y conserva las válidas', async () => {
    mockRpc.mockResolvedValue({
      data: [{ modulo: 'areas', activo: true }, { modulo: 123, activo: 'no-booleano' }],
      error: null,
    });
    const { fetchModulosOrg } = await import('@/api/plataforma');

    await expect(fetchModulosOrg(ORG_ID)).resolves.toEqual([{ modulo: 'areas', activo: true }]);
  });
});

describe('setModuloOrg', () => {
  it('invoca el RPC con los parámetros correctos', async () => {
    mockRpc.mockResolvedValue({
      data: { organizacion_id: ORG_ID, workspace_id: WS_ID, modulo: 'areas', activo: true },
      error: null,
    });
    const { setModuloOrg } = await import('@/api/plataforma');

    await setModuloOrg(ORG_ID, 'areas', true);

    expect(mockRpc).toHaveBeenCalledWith('sgtd_set_modulo_organizacion', {
      p_organizacion_id: ORG_ID, p_modulo: 'areas', p_activo: true,
    });
  });

  it('con respuesta de forma inesperada, lanza error explícito', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    const { setModuloOrg } = await import('@/api/plataforma');

    await expect(setModuloOrg(ORG_ID, 'areas', true)).rejects.toThrow(/respuesta inesperada/i);
  });
});

// ---------------------------------------------------------------------------
// Soft-delete de organización — desactivarOrg / reactivarOrg / fetchOrgsDesactivadas
// ---------------------------------------------------------------------------

describe('desactivarOrg / reactivarOrg', () => {
  it('desactivarOrg con respuesta válida la devuelve parseada', async () => {
    mockRpc.mockResolvedValue({
      data: { organizacion_id: ORG_ID, nombre: 'Nufago', desactivada_en: '2026-01-01T00:00:00Z', purga_en: '2026-02-01T00:00:00Z' },
      error: null,
    });
    const { desactivarOrg } = await import('@/api/plataforma');

    await expect(desactivarOrg(ORG_ID)).resolves.toEqual(expect.objectContaining({ organizacion_id: ORG_ID }));
  });

  it('reactivarOrg con respuesta de forma inesperada, lanza error explícito', async () => {
    mockRpc.mockResolvedValue({ data: { organizacion_id: ORG_ID }, error: null }); // falta "nombre"
    const { reactivarOrg } = await import('@/api/plataforma');

    await expect(reactivarOrg(ORG_ID)).rejects.toThrow(/respuesta inesperada/i);
  });

  it('fetchOrgsDesactivadas descarta filas inválidas', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { id: ORG_ID, nombre: 'Nufago', slug: 'nufago', desactivada_en: '2026-01-01T00:00:00Z', purga_en: '2026-02-01T00:00:00Z' },
        { id: 'no-es-uuid' },
      ],
      error: null,
    });
    const { fetchOrgsDesactivadas } = await import('@/api/plataforma');

    const result = await fetchOrgsDesactivadas();

    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// eliminarUsuario — edge function, error de transporte vs error de negocio
// ---------------------------------------------------------------------------

describe('eliminarUsuario', () => {
  it('con éxito, no lanza', async () => {
    mockInvoke.mockResolvedValue({ data: { data: null }, error: null });
    const { eliminarUsuario } = await import('@/api/plataforma');

    await expect(eliminarUsuario(USR_ID)).resolves.toBeUndefined();
    expect(mockInvoke).toHaveBeenCalledWith('delete-user', { body: { usuario_id: USR_ID } });
  });

  it('propaga el error de transporte de la edge function', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('function crashed') });
    const { eliminarUsuario } = await import('@/api/plataforma');

    await expect(eliminarUsuario(USR_ID)).rejects.toThrow('function crashed');
  });

  it('sin error de transporte pero con error de negocio en el body, lo lanza (p. ej. auto-eliminación)', async () => {
    mockInvoke.mockResolvedValue({ data: { error: 'No puedes eliminar tu propio usuario' }, error: null });
    const { eliminarUsuario } = await import('@/api/plataforma');

    await expect(eliminarUsuario(USR_ID)).rejects.toThrow('No puedes eliminar tu propio usuario');
  });
});
