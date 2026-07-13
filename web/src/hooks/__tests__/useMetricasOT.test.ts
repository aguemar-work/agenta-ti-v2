/**
 * src/hooks/__tests__/useMetricasOT.test.ts
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMetricasOT } from '@/hooks/useMetricasOT';
import { wrapWithQueryClient } from '@/test/helpers';
import { useWorkspaceStore } from '@/store/workspaceStore';

const mockGetOtEstadoCounts = vi.fn();

vi.mock('@/api/metricas', () => ({
  getOtEstadoCounts: (desde: string, hasta: string) => mockGetOtEstadoCounts(desde, hasta),
}));

beforeEach(() => {
  vi.clearAllMocks();
  useWorkspaceStore.setState({ workspaceActivo: { id: 'ws-1', organizacion_id: 'o1', nombre: 'WS', activo: true } });
});

describe('useMetricasOT', () => {
  it('con fechas vacías, no dispara el fetch', () => {
    const { result } = renderHook(() => useMetricasOT('', ''), { wrapper: wrapWithQueryClient() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGetOtEstadoCounts).not.toHaveBeenCalled();
  });

  it('con fechas válidas, dispara el fetch', async () => {
    mockGetOtEstadoCounts.mockResolvedValue({ pendiente: 2 });
    const { result } = renderHook(() => useMetricasOT('2026-04-01', '2026-04-30'), { wrapper: wrapWithQueryClient() });

    await waitFor(() => expect(result.current.data).toEqual({ pendiente: 2 }));
  });

  it('enabled=false anula el gate aunque haya fechas y workspace', () => {
    const { result } = renderHook(() => useMetricasOT('2026-04-01', '2026-04-30', false), { wrapper: wrapWithQueryClient() });

    expect(result.current.fetchStatus).toBe('idle');
  });
});
