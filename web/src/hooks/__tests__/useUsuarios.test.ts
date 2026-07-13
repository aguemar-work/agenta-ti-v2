/**
 * src/hooks/__tests__/useUsuarios.test.ts
 * Selectores compartidos de usuarios/jefes — gate por workspace activo.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useUsuariosActivos, useJefesNotificacion } from '@/hooks/useUsuarios';
import { wrapWithQueryClient } from '@/test/helpers';
import { useWorkspaceStore } from '@/store/workspaceStore';

const mockGetUsuariosActivosParaAsignacion = vi.fn();
const mockGetJefesActivosParaNotificacion = vi.fn();

vi.mock('@/api/usuarios', () => ({
  getUsuariosActivosParaAsignacion: () => mockGetUsuariosActivosParaAsignacion(),
  getJefesActivosParaNotificacion: () => mockGetJefesActivosParaNotificacion(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  useWorkspaceStore.getState().reset();
});

describe('useUsuariosActivos', () => {
  it('sin workspace activo, no dispara el fetch', () => {
    const { result } = renderHook(() => useUsuariosActivos(), { wrapper: wrapWithQueryClient() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGetUsuariosActivosParaAsignacion).not.toHaveBeenCalled();
  });

  it('con workspace activo, dispara el fetch', async () => {
    useWorkspaceStore.setState({ workspaceActivo: { id: 'ws-1', organizacion_id: 'o1', nombre: 'WS', activo: true } });
    mockGetUsuariosActivosParaAsignacion.mockResolvedValue([{ id: 'u1', nombre: 'Ana', email: 'a@x.com' }]);
    const { result } = renderHook(() => useUsuariosActivos(), { wrapper: wrapWithQueryClient() });

    await waitFor(() => expect(result.current.data).toHaveLength(1));
  });

  it('options.enabled=false anula el gate aunque haya workspace activo', () => {
    useWorkspaceStore.setState({ workspaceActivo: { id: 'ws-1', organizacion_id: 'o1', nombre: 'WS', activo: true } });
    const { result } = renderHook(() => useUsuariosActivos({ enabled: false }), { wrapper: wrapWithQueryClient() });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useJefesNotificacion', () => {
  it('sin workspace activo, no dispara el fetch', () => {
    const { result } = renderHook(() => useJefesNotificacion(), { wrapper: wrapWithQueryClient() });

    expect(mockGetJefesActivosParaNotificacion).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });
});
