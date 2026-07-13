/**
 * src/hooks/__tests__/useWorkspaceBootstrap.test.ts
 *
 * Orquesta la carga inicial de org/workspace tras el login — es el hook más
 * crítico del arranque: si esta lógica falla, el usuario queda sin acceso a
 * la app aunque el login haya funcionado. Cubre las ramas principales del
 * árbol de decisión: dueño sin orgs → panel; sin orgs con invitaciones;
 * sin orgs sin invitaciones → error; org+workspace únicos → auto-aplicar;
 * múltiples accesibles → selector; ya inicializado → no vuelve a correr.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useWorkspaceBootstrap } from '@/hooks/useWorkspaceBootstrap';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';

const mockFetchEsPlataformaOwnerCached = vi.fn();
const mockFetchInvitacionesPendientes = vi.fn();
const mockGetModulosDelWorkspace = vi.fn();
const mockGetOrgsDelUsuario = vi.fn();
const mockGetPreferenciaWorkspace = vi.fn();
const mockGetWorkspacesAccesiblesDeOrg = vi.fn();
const mockGuardarPreferenciaWorkspace = vi.fn();

vi.mock('@/api/plataforma', () => ({
  fetchEsPlataformaOwnerCached: () => mockFetchEsPlataformaOwnerCached(),
}));
vi.mock('@/api/invitacion', () => ({
  fetchInvitacionesPendientes: () => mockFetchInvitacionesPendientes(),
}));
vi.mock('@/api/workspace', () => ({
  getModulosDelWorkspace: (id: string) => mockGetModulosDelWorkspace(id),
  getOrgsDelUsuario: () => mockGetOrgsDelUsuario(),
  getPreferenciaWorkspace: () => mockGetPreferenciaWorkspace(),
  getWorkspacesAccesiblesDeOrg: (id: string) => mockGetWorkspacesAccesiblesDeOrg(id),
  guardarPreferenciaWorkspace: (org: string, ws: string) => mockGuardarPreferenciaWorkspace(org, ws),
}));

const USUARIO = { id: 'u1', nombre: 'Ana', email: 'a@x.com', rol: 'miembro' as const, activo: true, created_at: '', updated_at: '' };
const ORG = { id: 'org-1', nombre: 'Nufago', slug: 'nufago', activa: true };
const WS = { id: 'ws-1', organizacion_id: 'org-1', nombre: 'WS', activo: true, rol: 'miembro' as const };

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ authUser: null, usuario: null, isLoading: false });
  useWorkspaceStore.getState().reset();
  mockGetPreferenciaWorkspace.mockResolvedValue(null);
  mockGetModulosDelWorkspace.mockResolvedValue([]);
});

describe('useWorkspaceBootstrap', () => {
  it('ya inicializado, no dispara ningún fetch y devuelve el estado "listo" de inmediato', () => {
    useAuthStore.setState({ usuario: USUARIO });
    useWorkspaceStore.setState({ inicializado: true });

    const { result } = renderHook(() => useWorkspaceBootstrap());

    expect(result.current).toEqual({ necesitaSelector: false, necesitaInvitaciones: false, error: null, reintentar: expect.any(Function) });
    expect(mockGetOrgsDelUsuario).not.toHaveBeenCalled();
  });

  it('sin orgs, siendo dueño de plataforma, entra en modo panel', async () => {
    useAuthStore.setState({ usuario: USUARIO });
    mockGetOrgsDelUsuario.mockResolvedValue([]);
    mockFetchEsPlataformaOwnerCached.mockResolvedValue(true);

    renderHook(() => useWorkspaceBootstrap());

    await waitFor(() => expect(useWorkspaceStore.getState().modoContexto).toBe('panel'));
  });

  it('sin orgs, no dueño, CON invitaciones pendientes → necesitaInvitaciones', async () => {
    useAuthStore.setState({ usuario: USUARIO });
    mockGetOrgsDelUsuario.mockResolvedValue([]);
    mockFetchEsPlataformaOwnerCached.mockResolvedValue(false);
    mockFetchInvitacionesPendientes.mockResolvedValue([
      { workspace_id: 'ws-x', workspace_nombre: 'WS', organizacion_id: 'o1', organizacion_nombre: 'Org', rol: 'miembro', invited_at: '' },
    ]);

    const { result } = renderHook(() => useWorkspaceBootstrap());

    await waitFor(() => expect(result.current.necesitaInvitaciones).toBe(true));
  });

  it('sin orgs, no dueño, SIN invitaciones → error explícito', async () => {
    useAuthStore.setState({ usuario: USUARIO });
    mockGetOrgsDelUsuario.mockResolvedValue([]);
    mockFetchEsPlataformaOwnerCached.mockResolvedValue(false);
    mockFetchInvitacionesPendientes.mockResolvedValue([]);

    const { result } = renderHook(() => useWorkspaceBootstrap());

    await waitFor(() => expect(result.current.error).toBe('No tienes acceso a ninguna organización.'));
  });

  it('una sola org con un solo workspace accesible, aplica el contexto automáticamente', async () => {
    useAuthStore.setState({ usuario: USUARIO });
    mockGetOrgsDelUsuario.mockResolvedValue([ORG]);
    mockGetWorkspacesAccesiblesDeOrg.mockResolvedValue([WS]);

    renderHook(() => useWorkspaceBootstrap());

    await waitFor(() => expect(useWorkspaceStore.getState().inicializado).toBe(true));
    expect(useWorkspaceStore.getState().workspaceActivo?.id).toBe('ws-1');
    expect(mockGuardarPreferenciaWorkspace).toHaveBeenCalledWith('org-1', 'ws-1');
  });

  it('múltiples workspaces accesibles, pide selector en vez de auto-aplicar', async () => {
    useAuthStore.setState({ usuario: USUARIO });
    const org2 = { ...ORG, id: 'org-2' };
    mockGetOrgsDelUsuario.mockResolvedValue([ORG, org2]);
    mockGetWorkspacesAccesiblesDeOrg.mockImplementation((orgId: string) =>
      Promise.resolve(orgId === 'org-1' ? [WS] : [{ ...WS, id: 'ws-2', organizacion_id: 'org-2' }]),
    );

    const { result } = renderHook(() => useWorkspaceBootstrap());

    await waitFor(() => expect(result.current.necesitaSelector).toBe(true));
    expect(useWorkspaceStore.getState().inicializado).toBe(false);
  });

  it('si getModulosDelWorkspace falla al aplicar contexto, no bloquea — módulos quedan en []', async () => {
    useAuthStore.setState({ usuario: USUARIO });
    mockGetOrgsDelUsuario.mockResolvedValue([ORG]);
    mockGetWorkspacesAccesiblesDeOrg.mockResolvedValue([WS]);
    mockGetModulosDelWorkspace.mockRejectedValue(new Error('timeout'));

    renderHook(() => useWorkspaceBootstrap());

    await waitFor(() => expect(useWorkspaceStore.getState().inicializado).toBe(true));
    expect(useWorkspaceStore.getState().modulos).toEqual([]);
  });
});
