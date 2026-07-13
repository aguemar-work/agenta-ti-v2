/**
 * src/hooks/__tests__/useObjetivosMetricas.test.ts
 * Wrappers de TanStack Query sobre api/objetivosMetricas.ts — gate por workspace/fechas.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useObjetivosProgreso, useKpisUsuario, useKpisRangoYSemana, useKpisComparativa } from '@/hooks/useObjetivosMetricas';
import { wrapWithQueryClient } from '@/test/helpers';
import { useWorkspaceStore } from '@/store/workspaceStore';

const mockGetObjetivosConProgreso = vi.fn();
const mockGetKpisUsuario = vi.fn();
const mockGetKpisRangoYSemana = vi.fn();
const mockGetKpisComparativa = vi.fn();

vi.mock('@/api/objetivosMetricas', () => ({
  getObjetivosConProgreso: () => mockGetObjetivosConProgreso(),
  getKpisUsuario: (id: string) => mockGetKpisUsuario(id),
  getKpisRangoYSemana: (d: string, h: string, u?: string) => mockGetKpisRangoYSemana(d, h, u),
  getKpisComparativa: (d: string, h: string) => mockGetKpisComparativa(d, h),
}));

beforeEach(() => {
  vi.clearAllMocks();
  useWorkspaceStore.getState().reset();
});

describe('useObjetivosProgreso', () => {
  it('sin workspace activo, no dispara el fetch', () => {
    const { result } = renderHook(() => useObjetivosProgreso(), { wrapper: wrapWithQueryClient() });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('con workspace activo, dispara el fetch', async () => {
    useWorkspaceStore.setState({ workspaceActivo: { id: 'ws-1', organizacion_id: 'o1', nombre: 'WS', activo: true } });
    mockGetObjetivosConProgreso.mockResolvedValue([]);
    const { result } = renderHook(() => useObjetivosProgreso(), { wrapper: wrapWithQueryClient() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useKpisUsuario', () => {
  it('sin usuarioId, no dispara el fetch', () => {
    useWorkspaceStore.setState({ workspaceActivo: { id: 'ws-1', organizacion_id: 'o1', nombre: 'WS', activo: true } });
    const { result } = renderHook(() => useKpisUsuario(undefined), { wrapper: wrapWithQueryClient() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGetKpisUsuario).not.toHaveBeenCalled();
  });
});

describe('useKpisRangoYSemana', () => {
  it('con fechas vacías, no dispara el fetch', () => {
    useWorkspaceStore.setState({ workspaceActivo: { id: 'ws-1', organizacion_id: 'o1', nombre: 'WS', activo: true } });
    const { result } = renderHook(() => useKpisRangoYSemana('', ''), { wrapper: wrapWithQueryClient() });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useKpisComparativa', () => {
  it('enabled=false anula el gate aunque haya fechas y workspace', () => {
    useWorkspaceStore.setState({ workspaceActivo: { id: 'ws-1', organizacion_id: 'o1', nombre: 'WS', activo: true } });
    const { result } = renderHook(() => useKpisComparativa('2026-04-01', '2026-04-30', false), { wrapper: wrapWithQueryClient() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGetKpisComparativa).not.toHaveBeenCalled();
  });
});
