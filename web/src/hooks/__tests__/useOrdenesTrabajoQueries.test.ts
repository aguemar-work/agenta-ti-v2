/**
 * src/hooks/__tests__/useOrdenesTrabajoQueries.test.ts
 * Orquestador de queries de OT — el jefe ve todas las OTs, el miembro solo las suyas.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useOrdenesTrabajoQueries } from '@/hooks/useOrdenesTrabajoQueries';
import { wrapWithQueryClient } from '@/test/helpers';
import { useWorkspaceStore } from '@/store/workspaceStore';

const mockGetOrdenesTrabajoMiembro = vi.fn();
const mockGetOrdenesTrabajoTodas = vi.fn();
const mockGetTiposTrabajoOT = vi.fn();
const mockGetTareasVinculablesOT = vi.fn();
const mockGetBorradorOTUsuario = vi.fn();

vi.mock('@/api/ordenTrabajo', () => ({
  getOrdenesTrabajoMiembro: (id: string) => mockGetOrdenesTrabajoMiembro(id),
  getOrdenesTrabajoTodas: () => mockGetOrdenesTrabajoTodas(),
  getTiposTrabajoOT: () => mockGetTiposTrabajoOT(),
  getTareasVinculablesOT: (id: string) => mockGetTareasVinculablesOT(id),
  getBorradorOTUsuario: (id: string) => mockGetBorradorOTUsuario(id),
}));

beforeEach(() => {
  vi.clearAllMocks();
  useWorkspaceStore.setState({ workspaceActivo: { id: 'ws-1', organizacion_id: 'o1', nombre: 'WS', activo: true } });
  mockGetTiposTrabajoOT.mockResolvedValue([]);
  mockGetTareasVinculablesOT.mockResolvedValue([]);
});

describe('useOrdenesTrabajoQueries', () => {
  it('jefe: usa getOrdenesTrabajoTodas, no getOrdenesTrabajoMiembro', async () => {
    mockGetOrdenesTrabajoTodas.mockResolvedValue([]);
    renderHook(
      () => useOrdenesTrabajoQueries({ usuarioId: 'u1', esJefe: true, borradorModalAbierto: false, editandoOT: false }),
      { wrapper: wrapWithQueryClient() },
    );

    await waitFor(() => expect(mockGetOrdenesTrabajoTodas).toHaveBeenCalledTimes(1));
    expect(mockGetOrdenesTrabajoMiembro).not.toHaveBeenCalled();
  });

  it('miembro: usa getOrdenesTrabajoMiembro con su propio id', async () => {
    mockGetOrdenesTrabajoMiembro.mockResolvedValue([]);
    renderHook(
      () => useOrdenesTrabajoQueries({ usuarioId: 'u1', esJefe: false, borradorModalAbierto: false, editandoOT: false }),
      { wrapper: wrapWithQueryClient() },
    );

    await waitFor(() => expect(mockGetOrdenesTrabajoMiembro).toHaveBeenCalledWith('u1'));
  });

  it('borrador servidor solo se consulta con el modal abierto y sin estar editando otra OT', async () => {
    mockGetOrdenesTrabajoMiembro.mockResolvedValue([]);
    const { rerender } = renderHook(
      ({ modalAbierto }) => useOrdenesTrabajoQueries({ usuarioId: 'u1', esJefe: false, borradorModalAbierto: modalAbierto, editandoOT: false }),
      { wrapper: wrapWithQueryClient(), initialProps: { modalAbierto: false } },
    );

    expect(mockGetBorradorOTUsuario).not.toHaveBeenCalled();

    mockGetBorradorOTUsuario.mockResolvedValue(null);
    rerender({ modalAbierto: true });

    await waitFor(() => expect(mockGetBorradorOTUsuario).toHaveBeenCalledWith('u1'));
  });

  it('editando una OT existente, NO consulta el borrador aunque el modal esté abierto', async () => {
    mockGetOrdenesTrabajoMiembro.mockResolvedValue([]);
    renderHook(
      () => useOrdenesTrabajoQueries({ usuarioId: 'u1', esJefe: false, borradorModalAbierto: true, editandoOT: true }),
      { wrapper: wrapWithQueryClient() },
    );

    await new Promise((r) => setTimeout(r, 20));
    expect(mockGetBorradorOTUsuario).not.toHaveBeenCalled();
  });
});
