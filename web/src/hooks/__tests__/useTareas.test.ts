/**
 * src/hooks/__tests__/useTareas.test.ts
 *
 * useMarcarAtrasadasAlMontar tiene throttle por sessionStorage (máx. 1 vez
 * cada 30 min) para evitar un UPDATE masivo en cada navegación — es la pieza
 * de mayor riesgo silencioso: si el throttle se rompe, cada visita a /semana
 * dispara un UPDATE completo de tareas atrasadas del equipo.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMarcarAtrasadasAlMontar, useTareasHoy } from '@/hooks/useTareas';
import { wrapWithQueryClient } from '@/test/helpers';
import { useWorkspaceStore } from '@/store/workspaceStore';

const mockMarcarAtrasadasEquipo = vi.fn();
const mockGetTareasHoyUsuario = vi.fn();

vi.mock('@/api/semana', () => ({
  marcarAtrasadasEquipo: () => mockMarcarAtrasadasEquipo(),
  getTareasHoyUsuario: (asignadoA: string, hoy: string) => mockGetTareasHoyUsuario(asignadoA, hoy),
  reprogramarTareaConLog: vi.fn(),
}));

vi.mock('@/api/usuarios', () => ({
  getUsuariosParaSelector: vi.fn().mockResolvedValue([]),
}));

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  useWorkspaceStore.setState({ workspaceActivo: { id: 'ws-1', organizacion_id: 'o1', nombre: 'WS', activo: true } });
  mockMarcarAtrasadasEquipo.mockResolvedValue(undefined);
});

describe('useMarcarAtrasadasAlMontar', () => {
  it('primera vez en la sesión, ejecuta el RPC', async () => {
    renderHook(() => useMarcarAtrasadasAlMontar('u1'), { wrapper: wrapWithQueryClient() });

    await waitFor(() => expect(mockMarcarAtrasadasEquipo).toHaveBeenCalledTimes(1));
  });

  it('sin asignadoA, no ejecuta el RPC', () => {
    renderHook(() => useMarcarAtrasadasAlMontar(undefined), { wrapper: wrapWithQueryClient() });

    expect(mockMarcarAtrasadasEquipo).not.toHaveBeenCalled();
  });

  it('ya ejecutado hace poco (dentro del throttle de 30 min), NO vuelve a ejecutar', async () => {
    sessionStorage.setItem('sgtd-marcar-atrasadas-ts', String(Date.now() - 5 * 60 * 1000)); // hace 5 min
    renderHook(() => useMarcarAtrasadasAlMontar('u1'), { wrapper: wrapWithQueryClient() });

    // Da tiempo a que un posible efecto async se dispare, si lo hiciera.
    await new Promise((r) => setTimeout(r, 20));
    expect(mockMarcarAtrasadasEquipo).not.toHaveBeenCalled();
  });

  it('la última ejecución fue hace más de 30 min, vuelve a ejecutar', async () => {
    sessionStorage.setItem('sgtd-marcar-atrasadas-ts', String(Date.now() - 31 * 60 * 1000)); // hace 31 min
    renderHook(() => useMarcarAtrasadasAlMontar('u1'), { wrapper: wrapWithQueryClient() });

    await waitFor(() => expect(mockMarcarAtrasadasEquipo).toHaveBeenCalledTimes(1));
  });
});

describe('useTareasHoy', () => {
  it('sin asignadoA, no dispara el fetch', () => {
    const { result } = renderHook(() => useTareasHoy(undefined), { wrapper: wrapWithQueryClient() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGetTareasHoyUsuario).not.toHaveBeenCalled();
  });

  it('con asignadoA y workspace activo, dispara el fetch', async () => {
    mockGetTareasHoyUsuario.mockResolvedValue([]);
    const { result } = renderHook(() => useTareasHoy('u1'), { wrapper: wrapWithQueryClient() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetTareasHoyUsuario).toHaveBeenCalledWith('u1', expect.any(String));
  });
});
