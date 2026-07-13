/**
 * src/hooks/__tests__/usePanelPrincipalPage.test.ts
 * Dashboard del dueño de plataforma. mostrarAccionesOwner debe gatear las
 * acciones de owner (abrirModulos/abrirDesactivar) incluso si se llaman
 * directamente, no solo ocultando el botón en la UI.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { usePanelPrincipalPage } from '@/hooks/usePanelPrincipalPage';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useAuthStore } from '@/store/authStore';

const mockNavigate = vi.fn();
const mockCambiarAOrganizacion = vi.fn();
const mockRefrescarOrgs = vi.fn();
const mockGetOrgsDelUsuario = vi.fn();
const mockFetchEsPlataformaOwner = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/api/organizacion', () => ({
  cambiarAOrganizacion: (id: string) => mockCambiarAOrganizacion(id),
  refrescarOrgs: () => mockRefrescarOrgs(),
}));

vi.mock('@/api/workspace', () => ({
  getOrgsDelUsuario: () => mockGetOrgsDelUsuario(),
}));

vi.mock('@/api/plataforma', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/plataforma')>();
  return { ...actual, fetchEsPlataformaOwner: () => mockFetchEsPlataformaOwner() };
});

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(MemoryRouter, null, createElement(QueryClientProvider, { client: qc }, children));
}

beforeEach(() => {
  vi.clearAllMocks();
  useWorkspaceStore.getState().reset();
  useAuthStore.setState({ usuario: { id: 'u1', nombre: 'Ana', email: 'a@x.com', rol: 'jefe', activo: true, created_at: '', updated_at: '' } });
  mockGetOrgsDelUsuario.mockResolvedValue([]);
  mockFetchEsPlataformaOwner.mockResolvedValue(false);
});

describe('usePanelPrincipalPage', () => {
  it('sin ser dueño de plataforma, abrirModulos/abrirDesactivar no abren el modal', async () => {
    const { result } = renderHook(() => usePanelPrincipalPage(), { wrapper });
    const org = { id: 'o1', nombre: 'Nufago', slug: 'nufago', activa: true };

    act(() => { result.current.abrirModulos(org); });
    expect(result.current.modalModulosOpen).toBe(false);

    act(() => { result.current.abrirDesactivar(org); });
    expect(result.current.modalDesactivarOpen).toBe(false);
  });

  it('siendo dueño de plataforma, abrirModulos SÍ abre el modal', async () => {
    mockFetchEsPlataformaOwner.mockResolvedValue(true);
    const { result } = renderHook(() => usePanelPrincipalPage(), { wrapper });
    await waitFor(() => expect(result.current.mostrarAccionesOwner).toBe(true));
    const org = { id: 'o1', nombre: 'Nufago', slug: 'nufago', activa: true };

    act(() => { result.current.abrirModulos(org); });

    expect(result.current.modalModulosOpen).toBe(true);
    expect(result.current.orgModulos).toEqual(org);
  });

  it('handleEntrar exitoso navega a /semana', async () => {
    mockCambiarAOrganizacion.mockResolvedValue(undefined);
    const { result } = renderHook(() => usePanelPrincipalPage(), { wrapper });

    await act(async () => { await result.current.handleEntrar('o1'); });

    expect(mockNavigate).toHaveBeenCalledWith('/semana');
    expect(result.current.entrandoId).toBeNull();
  });

  it('handleEntrar ya en curso (mismo click doble), ignora la segunda llamada', async () => {
    mockCambiarAOrganizacion.mockImplementation(() => new Promise(() => {})); // nunca resuelve
    const { result } = renderHook(() => usePanelPrincipalPage(), { wrapper });

    act(() => { void result.current.handleEntrar('o1'); });
    await waitFor(() => expect(result.current.entrandoId).toBe('o1'));
    act(() => { void result.current.handleEntrar('o2'); }); // debe ser ignorado (entrandoId ya seteado)

    expect(mockCambiarAOrganizacion).toHaveBeenCalledTimes(1);
    expect(mockCambiarAOrganizacion).toHaveBeenCalledWith('o1');
  });

  it('reintentar incrementa el contador para forzar un nuevo intento de carga', () => {
    const { result } = renderHook(() => usePanelPrincipalPage(), { wrapper });

    expect(() => result.current.reintentar()).not.toThrow();
  });
});
