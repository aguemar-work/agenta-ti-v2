/**
 * src/hooks/__tests__/useHoyColumnas.test.ts
 * Queries de la vista HOY — gate por usuarioId + workspace activo.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useIncidenciasHoy, useIncidenciasDelDia, useNotasBitacoraHoy } from '@/hooks/useHoyColumnas';
import { wrapWithQueryClient } from '@/test/helpers';
import { useWorkspaceStore } from '@/store/workspaceStore';

const mockGetIncidenciasAbiertas = vi.fn();
const mockGetIncidenciasDelDia = vi.fn();
const mockGetNotasBitacoraRecientes = vi.fn();

vi.mock('@/api/hoyColumnas', () => ({
  getIncidenciasAbiertas: (id: string) => mockGetIncidenciasAbiertas(id),
  getIncidenciasDelDia: (id: string, ymd: string) => mockGetIncidenciasDelDia(id, ymd),
  getNotasBitacoraRecientes: (id: string, limit: number) => mockGetNotasBitacoraRecientes(id, limit),
  crearIncidencia: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  useWorkspaceStore.setState({ workspaceActivo: { id: 'ws-1', organizacion_id: 'o1', nombre: 'WS', activo: true } });
});

describe('useIncidenciasHoy', () => {
  it('sin usuarioId, no dispara el fetch', () => {
    const { result } = renderHook(() => useIncidenciasHoy(undefined), { wrapper: wrapWithQueryClient() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGetIncidenciasAbiertas).not.toHaveBeenCalled();
  });
});

describe('useIncidenciasDelDia', () => {
  it('con usuarioId, consulta el día indicado', async () => {
    mockGetIncidenciasDelDia.mockResolvedValue([]);
    renderHook(() => useIncidenciasDelDia('u1', '2026-04-29'), { wrapper: wrapWithQueryClient() });

    await waitFor(() => expect(mockGetIncidenciasDelDia).toHaveBeenCalledWith('u1', '2026-04-29'));
  });
});

describe('useNotasBitacoraHoy', () => {
  it('consulta con límite fijo de 8 notas', async () => {
    mockGetNotasBitacoraRecientes.mockResolvedValue([]);
    renderHook(() => useNotasBitacoraHoy('u1'), { wrapper: wrapWithQueryClient() });

    await waitFor(() => expect(mockGetNotasBitacoraRecientes).toHaveBeenCalledWith('u1', 8));
  });
});
