/**
 * src/hooks/__tests__/useWorkspaceSelectorPage.test.ts
 *
 * Selector de organización/workspace en el onboarding. Con una sola org y
 * workspaces ya precargados en el store, evita re-consultar el backend
 * (atajo de rendimiento) — vale la pena verificarlo explícitamente.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useWorkspaceSelectorPage } from '@/hooks/useWorkspaceSelectorPage';
import { useWorkspaceStore } from '@/store/workspaceStore';

const mockGetWorkspacesAccesiblesDeOrg = vi.fn();
const mockGetModulosDelWorkspace = vi.fn();
const mockGuardarPreferenciaWorkspace = vi.fn();

vi.mock('@/api/workspace', () => ({
  getWorkspacesAccesiblesDeOrg: (id: string) => mockGetWorkspacesAccesiblesDeOrg(id),
  getModulosDelWorkspace: (id: string) => mockGetModulosDelWorkspace(id),
  guardarPreferenciaWorkspace: (org: string, ws: string) => mockGuardarPreferenciaWorkspace(org, ws),
}));

const ORG = { id: 'org-1', nombre: 'Nufago', slug: 'nufago', activa: true };
const WS  = { id: 'ws-1', organizacion_id: 'org-1', nombre: 'WS', activo: true, rol: 'miembro' as const };

beforeEach(() => {
  vi.clearAllMocks();
  useWorkspaceStore.getState().reset();
  mockGuardarPreferenciaWorkspace.mockResolvedValue(undefined);
  mockGetModulosDelWorkspace.mockResolvedValue([]);
});

describe('useWorkspaceSelectorPage', () => {
  it('una sola org con workspaces ya en el store, NO vuelve a consultar el backend', () => {
    useWorkspaceStore.setState({ orgs: [ORG], workspaces: [WS] });

    const { result } = renderHook(() => useWorkspaceSelectorPage());

    expect(result.current.workspaces).toEqual([WS]);
    expect(result.current.workspaceId).toBe('ws-1');
    expect(mockGetWorkspacesAccesiblesDeOrg).not.toHaveBeenCalled();
  });

  it('múltiples orgs, consulta los workspaces accesibles de la org elegida', async () => {
    const org2 = { ...ORG, id: 'org-2' };
    useWorkspaceStore.setState({ orgs: [ORG, org2], workspaces: [] });
    mockGetWorkspacesAccesiblesDeOrg.mockResolvedValue([WS]);

    const { result } = renderHook(() => useWorkspaceSelectorPage());
    act(() => { result.current.setOrgId('org-1'); });

    await waitFor(() => expect(result.current.workspaces).toEqual([WS]));
    expect(mockGetWorkspacesAccesiblesDeOrg).toHaveBeenCalledWith('org-1');
  });

  it('puedeConfirmar exige org Y workspace seleccionados, y que no esté cargando', () => {
    useWorkspaceStore.setState({ orgs: [ORG], workspaces: [] });

    const { result } = renderHook(() => useWorkspaceSelectorPage());

    expect(result.current.puedeConfirmar).toBe(false); // sin workspace aún
  });

  it('confirmar guarda la preferencia y marca inicializado=true', async () => {
    useWorkspaceStore.setState({ orgs: [ORG], workspaces: [WS] });
    const { result } = renderHook(() => useWorkspaceSelectorPage());
    await waitFor(() => expect(result.current.puedeConfirmar).toBe(true));

    await act(async () => { await result.current.confirmar(); });

    expect(mockGuardarPreferenciaWorkspace).toHaveBeenCalledWith('org-1', 'ws-1');
    expect(useWorkspaceStore.getState().inicializado).toBe(true);
  });

  it('si getModulosDelWorkspace falla al confirmar, no bloquea — módulos quedan en []', async () => {
    useWorkspaceStore.setState({ orgs: [ORG], workspaces: [WS] });
    mockGetModulosDelWorkspace.mockRejectedValue(new Error('timeout'));
    const { result } = renderHook(() => useWorkspaceSelectorPage());
    await waitFor(() => expect(result.current.puedeConfirmar).toBe(true));

    await act(async () => { await result.current.confirmar(); });

    expect(useWorkspaceStore.getState().inicializado).toBe(true);
    expect(useWorkspaceStore.getState().modulos).toEqual([]);
  });
});
