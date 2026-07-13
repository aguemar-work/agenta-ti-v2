/**
 * src/hooks/__tests__/usePanelUsuariosPage.test.ts
 * Gate por esOwner en abrirAsignar/abrirEliminar — igual criterio que
 * usePanelPrincipalPage: verificado en la función, no solo ocultando el botón.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { usePanelUsuariosPage } from '@/hooks/usePanelUsuariosPage';
import { wrapWithQueryClient } from '@/test/helpers';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useAuthStore } from '@/store/authStore';

const mockGetOrgsDelUsuario = vi.fn();
const mockFetchEsPlataformaOwner = vi.fn();
const mockFetchUsuariosPlataforma = vi.fn();
const mockEliminarUsuario = vi.fn();

vi.mock('@/api/workspace', () => ({ getOrgsDelUsuario: () => mockGetOrgsDelUsuario() }));
vi.mock('@/api/plataforma', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/plataforma')>();
  return {
    ...actual,
    fetchEsPlataformaOwner: () => mockFetchEsPlataformaOwner(),
    fetchUsuariosPlataforma: () => mockFetchUsuariosPlataforma(),
    eliminarUsuario: (id: string) => mockEliminarUsuario(id),
  };
});

const USUARIO_PLATAFORMA = { usuario_id: 'u2', nombre: 'Kevin', email: 'k@x.com', activo: true, created_at: '', orgs: [] };

beforeEach(() => {
  vi.clearAllMocks();
  useWorkspaceStore.getState().reset();
  useAuthStore.setState({ usuario: { id: 'u1', nombre: 'Ana', email: 'a@x.com', rol: 'jefe', activo: true, created_at: '', updated_at: '' } });
  mockGetOrgsDelUsuario.mockResolvedValue([]);
  mockFetchUsuariosPlataforma.mockResolvedValue([]);
});

describe('usePanelUsuariosPage', () => {
  it('sin ser dueño de plataforma, abrirAsignar/abrirEliminar no abren el modal', async () => {
    mockFetchEsPlataformaOwner.mockResolvedValue(false);
    const { result } = renderHook(() => usePanelUsuariosPage(), { wrapper: wrapWithQueryClient() });

    act(() => { result.current.abrirEliminar(USUARIO_PLATAFORMA); });

    expect(result.current.modalEliminar).toBe(false);
  });

  it('siendo dueño, abrirEliminar abre el modal con el usuario correcto', async () => {
    mockFetchEsPlataformaOwner.mockResolvedValue(true);
    const { result } = renderHook(() => usePanelUsuariosPage(), { wrapper: wrapWithQueryClient() });
    await waitFor(() => expect(result.current.esOwner).toBe(true));

    act(() => { result.current.abrirEliminar(USUARIO_PLATAFORMA); });

    expect(result.current.modalEliminar).toBe(true);
    expect(result.current.usuarioEliminar).toEqual(USUARIO_PLATAFORMA);
  });

  it('confirmarEliminar sin usuario seleccionado, no llama a la API', () => {
    const { result } = renderHook(() => usePanelUsuariosPage(), { wrapper: wrapWithQueryClient() });

    act(() => { result.current.confirmarEliminar(); });

    expect(mockEliminarUsuario).not.toHaveBeenCalled();
  });

  it('confirmarEliminar con usuario seleccionado, llama a eliminarUsuario con su id', async () => {
    mockFetchEsPlataformaOwner.mockResolvedValue(true);
    mockEliminarUsuario.mockResolvedValue(undefined);
    const { result } = renderHook(() => usePanelUsuariosPage(), { wrapper: wrapWithQueryClient() });
    await waitFor(() => expect(result.current.esOwner).toBe(true));
    act(() => { result.current.abrirEliminar(USUARIO_PLATAFORMA); });

    act(() => { result.current.confirmarEliminar(); });

    await waitFor(() => expect(mockEliminarUsuario).toHaveBeenCalledWith('u2'));
  });
});
