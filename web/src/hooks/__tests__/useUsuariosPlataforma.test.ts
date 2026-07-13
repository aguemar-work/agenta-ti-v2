/**
 * src/hooks/__tests__/useUsuariosPlataforma.test.ts
 * Lista de usuarios de plataforma — gate doble: sesión activa Y ser dueño de
 * plataforma (useEsPlataformaOwner). Un gate mal puesto expondría el listado
 * completo de usuarios del sistema a cualquier usuario autenticado.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useUsuariosPlataforma, useEliminarUsuario, USUARIOS_PLATAFORMA_QUERY_KEY } from '@/hooks/useUsuariosPlataforma';
import { wrapWithQueryClient } from '@/test/helpers';
import { useAuthStore } from '@/store/authStore';

const mockFetchEsPlataformaOwner = vi.fn();
const mockFetchUsuariosPlataforma = vi.fn();
const mockEliminarUsuario = vi.fn();

vi.mock('@/api/plataforma', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/plataforma')>();
  return {
    ...actual,
    fetchEsPlataformaOwner: () => mockFetchEsPlataformaOwner(),
    fetchUsuariosPlataforma: () => mockFetchUsuariosPlataforma(),
    eliminarUsuario: (id: string) => mockEliminarUsuario(id),
  };
});

const USUARIO = { id: 'u1', nombre: 'Ana', email: 'a@x.com', rol: 'jefe' as const, activo: true, created_at: '', updated_at: '' };

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ authUser: null, usuario: null, isLoading: false });
});

describe('useUsuariosPlataforma', () => {
  it('sin usuario en sesión, no dispara el fetch', () => {
    const { result } = renderHook(() => useUsuariosPlataforma(), { wrapper: wrapWithQueryClient() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchUsuariosPlataforma).not.toHaveBeenCalled();
  });

  it('con sesión pero NO siendo dueño de plataforma, no dispara el fetch de usuarios', async () => {
    useAuthStore.setState({ usuario: USUARIO });
    mockFetchEsPlataformaOwner.mockResolvedValue(false);
    const { result } = renderHook(() => useUsuariosPlataforma(), { wrapper: wrapWithQueryClient() });

    await new Promise((r) => setTimeout(r, 20));
    expect(mockFetchUsuariosPlataforma).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });

  it('con sesión y siendo dueño de plataforma, dispara el fetch', async () => {
    useAuthStore.setState({ usuario: USUARIO });
    mockFetchEsPlataformaOwner.mockResolvedValue(true);
    mockFetchUsuariosPlataforma.mockResolvedValue([{ usuario_id: 'u2', nombre: 'Kevin', email: 'k@x.com', activo: true, created_at: '', orgs: [] }]);
    const { result } = renderHook(() => useUsuariosPlataforma(), { wrapper: wrapWithQueryClient() });

    await waitFor(() => expect(result.current.data).toHaveLength(1));
  });
});

describe('useEliminarUsuario', () => {
  it('al eliminar con éxito, invalida la query de usuarios y llama onSuccess', async () => {
    mockEliminarUsuario.mockResolvedValue(undefined);
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useEliminarUsuario(onSuccess), { wrapper: wrapWithQueryClient() });

    act(() => { result.current.mutate('u2'); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockEliminarUsuario).toHaveBeenCalledWith('u2');
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('la queryKey de usuarios de plataforma es estable', () => {
    expect(USUARIOS_PLATAFORMA_QUERY_KEY).toEqual(['plataforma', 'usuarios']);
  });
});
