/**
 * src/hooks/__tests__/useResumenSlaJefe.test.ts
 * Resumen SLA — gate por rol jefe + workspace activo; useSlaAlertCount delega
 * en contarAlertasSla y devuelve 0 mientras no hay datos (no undefined/null).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useResumenSlaJefe, useSlaAlertCount } from '@/hooks/useResumenSlaJefe';
import { wrapWithQueryClient } from '@/test/helpers';
import { useWorkspaceStore } from '@/store/workspaceStore';

const mockGetResumenSlaJefe = vi.fn();

vi.mock('@/api/sla', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/sla')>();
  return { ...actual, getResumenSlaJefe: () => mockGetResumenSlaJefe() };
});

beforeEach(() => {
  vi.clearAllMocks();
  useWorkspaceStore.getState().reset();
});

function setJefeConWorkspace() {
  useWorkspaceStore.setState({
    rolActivo: 'jefe',
    workspaceActivo: { id: 'ws-1', organizacion_id: 'o1', nombre: 'WS', activo: true },
  });
}

describe('useResumenSlaJefe', () => {
  it('rol miembro (no jefe), no dispara el fetch aunque haya workspace activo', () => {
    useWorkspaceStore.setState({
      rolActivo: 'miembro',
      workspaceActivo: { id: 'ws-1', organizacion_id: 'o1', nombre: 'WS', activo: true },
    });
    const { result } = renderHook(() => useResumenSlaJefe(), { wrapper: wrapWithQueryClient() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGetResumenSlaJefe).not.toHaveBeenCalled();
  });

  it('jefe con workspace activo, dispara el fetch', async () => {
    setJefeConWorkspace();
    mockGetResumenSlaJefe.mockResolvedValue({ atrasadas_activas: 2, atrasadas_nuevas_24h: 1, bloqueadas_criticas: 0, fecha: '2026-04-29' });
    const { result } = renderHook(() => useResumenSlaJefe(), { wrapper: wrapWithQueryClient() });

    await waitFor(() => expect(result.current.data?.atrasadas_activas).toBe(2));
  });
});

describe('useSlaAlertCount', () => {
  it('mientras no hay datos (query aún cargando), devuelve 0 en vez de undefined', () => {
    const { result } = renderHook(() => useSlaAlertCount(), { wrapper: wrapWithQueryClient() });

    expect(result.current).toBe(0);
  });

  it('con datos cargados, delega en contarAlertasSla (atrasadas_nuevas_24h)', async () => {
    setJefeConWorkspace();
    mockGetResumenSlaJefe.mockResolvedValue({ atrasadas_activas: 5, atrasadas_nuevas_24h: 3, bloqueadas_criticas: 0, fecha: '2026-04-29' });
    const { result } = renderHook(() => useSlaAlertCount(), { wrapper: wrapWithQueryClient() });

    await waitFor(() => expect(result.current).toBe(3));
  });
});
