/**
 * src/hooks/__tests__/useOrdenesTrabajoQueries.test.ts
 * Orquestador de queries de OT — el jefe ve todas las OTs, el miembro solo las
 * suyas. Desde 2026-07-18 la lista es paginada (useInfiniteQuery + OT_PAGE_SIZE)
 * y el filtro se resuelve en servidor; el resumen usa count head:true.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useOrdenesTrabajoQueries } from '@/hooks/useOrdenesTrabajoQueries';
import { wrapWithQueryClient } from '@/test/helpers';
import { useWorkspaceStore } from '@/store/workspaceStore';

const mockGetOrdenesTrabajoMiembro = vi.fn();
const mockGetOrdenesTrabajoTodas = vi.fn();
const mockGetResumenOTs = vi.fn();
const mockGetTiposTrabajoOT = vi.fn();
const mockGetTareasVinculablesOT = vi.fn();
const mockGetBorradorOTUsuario = vi.fn();

const PAGE_SIZE = 100; // debe coincidir con OT_PAGE_SIZE del módulo real

vi.mock('@/api/ordenTrabajo', () => ({
  OT_PAGE_SIZE: 100,
  getOrdenesTrabajoMiembro: (id: string, filtro: string, offset: number) =>
    mockGetOrdenesTrabajoMiembro(id, filtro, offset),
  getOrdenesTrabajoTodas: (filtro: string, offset: number) =>
    mockGetOrdenesTrabajoTodas(filtro, offset),
  getResumenOTs: (creadoPor?: string) => mockGetResumenOTs(creadoPor),
  getTiposTrabajoOT: () => mockGetTiposTrabajoOT(),
  getTareasVinculablesOT: (id: string) => mockGetTareasVinculablesOT(id),
  getBorradorOTUsuario: (id: string) => mockGetBorradorOTUsuario(id),
}));

function otMin(id: string) {
  return { id, estado: 'pendiente', prioridad: 'normal' };
}

beforeEach(() => {
  vi.clearAllMocks();
  useWorkspaceStore.setState({ workspaceActivo: { id: 'ws-1', organizacion_id: 'o1', nombre: 'WS', activo: true } });
  mockGetResumenOTs.mockResolvedValue({ activas: 0, pendientes: 0, urgentes: 0, vencidas: 0 });
  mockGetTiposTrabajoOT.mockResolvedValue([]);
  mockGetTareasVinculablesOT.mockResolvedValue([]);
});

describe('useOrdenesTrabajoQueries', () => {
  it('jefe: usa getOrdenesTrabajoTodas (filtro + offset 0), no getOrdenesTrabajoMiembro', async () => {
    mockGetOrdenesTrabajoTodas.mockResolvedValue([]);
    renderHook(
      () => useOrdenesTrabajoQueries({ usuarioId: 'u1', esJefe: true, borradorModalAbierto: false, editandoOT: false }),
      { wrapper: wrapWithQueryClient() },
    );

    await waitFor(() => expect(mockGetOrdenesTrabajoTodas).toHaveBeenCalledWith('todos', 0));
    expect(mockGetOrdenesTrabajoMiembro).not.toHaveBeenCalled();
  });

  it('miembro: usa getOrdenesTrabajoMiembro con su propio id', async () => {
    mockGetOrdenesTrabajoMiembro.mockResolvedValue([]);
    renderHook(
      () => useOrdenesTrabajoQueries({ usuarioId: 'u1', esJefe: false, borradorModalAbierto: false, editandoOT: false }),
      { wrapper: wrapWithQueryClient() },
    );

    await waitFor(() => expect(mockGetOrdenesTrabajoMiembro).toHaveBeenCalledWith('u1', 'todos', 0));
  });

  it('el filtro viaja al servidor (no se filtra en cliente)', async () => {
    mockGetOrdenesTrabajoTodas.mockResolvedValue([]);
    renderHook(
      () => useOrdenesTrabajoQueries({ usuarioId: 'u1', esJefe: true, borradorModalAbierto: false, editandoOT: false, filtro: 'vencidas' }),
      { wrapper: wrapWithQueryClient() },
    );

    await waitFor(() => expect(mockGetOrdenesTrabajoTodas).toHaveBeenCalledWith('vencidas', 0));
  });

  it('página llena → hayMas; cargarMas pide la siguiente con el offset acumulado', async () => {
    const paginaLlena = Array.from({ length: PAGE_SIZE }, (_, i) => otMin(`ot-${i}`));
    mockGetOrdenesTrabajoTodas.mockResolvedValueOnce(paginaLlena).mockResolvedValueOnce([otMin('ot-final')]);

    const { result } = renderHook(
      () => useOrdenesTrabajoQueries({ usuarioId: 'u1', esJefe: true, borradorModalAbierto: false, editandoOT: false }),
      { wrapper: wrapWithQueryClient() },
    );

    await waitFor(() => expect(result.current.ordenes).toHaveLength(PAGE_SIZE));
    expect(result.current.hayMas).toBe(true);

    await act(async () => { await result.current.cargarMas(); });

    await waitFor(() => expect(result.current.ordenes).toHaveLength(PAGE_SIZE + 1));
    expect(mockGetOrdenesTrabajoTodas).toHaveBeenLastCalledWith('todos', PAGE_SIZE);
    expect(result.current.hayMas).toBe(false);
  });

  it('página incompleta → no hay más páginas', async () => {
    mockGetOrdenesTrabajoTodas.mockResolvedValue([otMin('ot-1')]);
    const { result } = renderHook(
      () => useOrdenesTrabajoQueries({ usuarioId: 'u1', esJefe: true, borradorModalAbierto: false, editandoOT: false }),
      { wrapper: wrapWithQueryClient() },
    );

    await waitFor(() => expect(result.current.ordenes).toHaveLength(1));
    expect(result.current.hayMas).toBe(false);
  });

  it('resumen: jefe consulta el equipo (sin creadoPor); miembro solo lo suyo', async () => {
    mockGetOrdenesTrabajoTodas.mockResolvedValue([]);
    mockGetOrdenesTrabajoMiembro.mockResolvedValue([]);
    mockGetResumenOTs.mockResolvedValue({ activas: 2, pendientes: 1, urgentes: 1, vencidas: 0 });

    const { result } = renderHook(
      () => useOrdenesTrabajoQueries({ usuarioId: 'u1', esJefe: true, borradorModalAbierto: false, editandoOT: false }),
      { wrapper: wrapWithQueryClient() },
    );
    await waitFor(() => expect(mockGetResumenOTs).toHaveBeenCalledWith(undefined));
    await waitFor(() => expect(result.current.resumen.activas).toBe(2));

    renderHook(
      () => useOrdenesTrabajoQueries({ usuarioId: 'u2', esJefe: false, borradorModalAbierto: false, editandoOT: false }),
      { wrapper: wrapWithQueryClient() },
    );
    await waitFor(() => expect(mockGetResumenOTs).toHaveBeenCalledWith('u2'));
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
