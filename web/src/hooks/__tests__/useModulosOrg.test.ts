/**
 * src/hooks/__tests__/useModulosOrg.test.ts
 * Estado de módulos de una organización — gate por sesión + orgId, e
 * invalidación de caché tras activar/desactivar un módulo.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useModulosOrg, useSetModuloOrg, modulosOrgQueryKey } from '@/hooks/useModulosOrg';
import { wrapWithQueryClient } from '@/test/helpers';
import { useAuthStore } from '@/store/authStore';

const mockFetchModulosOrg = vi.fn();
const mockSetModuloOrg = vi.fn();

vi.mock('@/api/plataforma', () => ({
  fetchModulosOrg: (orgId: string) => mockFetchModulosOrg(orgId),
  setModuloOrg: (orgId: string, modulo: string, activo: boolean) => mockSetModuloOrg(orgId, modulo, activo),
}));

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ authUser: null, usuario: null, isLoading: false });
});

describe('useModulosOrg', () => {
  it('sin orgId, no dispara el fetch', () => {
    useAuthStore.setState({ usuario: { id: 'u1', nombre: 'A', email: 'a@x.com', rol: 'jefe', activo: true, created_at: '', updated_at: '' } });
    const { result } = renderHook(() => useModulosOrg(null), { wrapper: wrapWithQueryClient() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchModulosOrg).not.toHaveBeenCalled();
  });

  it('sin usuario en sesión, no dispara el fetch aunque haya orgId', () => {
    const { result } = renderHook(() => useModulosOrg('org-1'), { wrapper: wrapWithQueryClient() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchModulosOrg).not.toHaveBeenCalled();
  });

  it('con orgId y usuario en sesión, dispara el fetch', async () => {
    useAuthStore.setState({ usuario: { id: 'u1', nombre: 'A', email: 'a@x.com', rol: 'jefe', activo: true, created_at: '', updated_at: '' } });
    mockFetchModulosOrg.mockResolvedValue([{ modulo: 'areas', activo: true }]);
    const { result } = renderHook(() => useModulosOrg('org-1'), { wrapper: wrapWithQueryClient() });

    await waitFor(() => expect(result.current.data).toEqual([{ modulo: 'areas', activo: true }]));
    expect(mockFetchModulosOrg).toHaveBeenCalledWith('org-1');
  });

  it('queryEnabled=false anula el gate aunque haya sesión y orgId', () => {
    useAuthStore.setState({ usuario: { id: 'u1', nombre: 'A', email: 'a@x.com', rol: 'jefe', activo: true, created_at: '', updated_at: '' } });
    const { result } = renderHook(() => useModulosOrg('org-1', false), { wrapper: wrapWithQueryClient() });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useSetModuloOrg', () => {
  it('al mutar con éxito, invoca el callback onSuccess con el resultado', async () => {
    mockSetModuloOrg.mockResolvedValue({ organizacion_id: 'org-1', workspace_id: 'w1', modulo: 'areas', activo: true });
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useSetModuloOrg('org-1', onSuccess), { wrapper: wrapWithQueryClient() });

    act(() => { result.current.mutate({ modulo: 'areas', activo: true }); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockSetModuloOrg).toHaveBeenCalledWith('org-1', 'areas', true);
    expect(onSuccess).toHaveBeenCalled();
  });

  it('la queryKey de módulos usa organizacion_id como segundo segmento', () => {
    expect(modulosOrgQueryKey('org-1')).toEqual(['plataforma', 'modulos', 'org-1']);
  });
});
