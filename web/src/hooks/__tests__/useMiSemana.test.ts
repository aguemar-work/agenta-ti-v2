/**
 * src/hooks/__tests__/useMiSemana.test.ts
 * Datos y mutaciones base de Mi Semana.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useMiSemanaData, useMiSemanaMutations } from '@/hooks/useMiSemana';
import { wrapWithQueryClient } from '@/test/helpers';
import { useWorkspaceStore } from '@/store/workspaceStore';

const mockGetTareasSemana = vi.fn();
const mockGetEventosSemana = vi.fn();
const mockCrearTareaPlanificada = vi.fn();

vi.mock('@/api/semana', () => ({
  getTareasSemana: (id: string, sem: string) => mockGetTareasSemana(id, sem),
  getEventosSemana: (id: string, lunes: Date) => mockGetEventosSemana(id, lunes),
  crearTareaPlanificada: (input: unknown) => mockCrearTareaPlanificada(input),
  actualizarTarea: vi.fn(), cambiarEstadoTarea: vi.fn(), completarTareaConResumen: vi.fn(),
  crearEventoUsuario: vi.fn(), eliminarEvento: vi.fn(), eliminarTareaConMotivo: vi.fn(),
  moverTareaADia: vi.fn(), moverTareaEntreDias: vi.fn(), actualizarEvento: vi.fn(),
}));

vi.mock('@/api/tablero', () => ({ moverTareaColumna: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  useWorkspaceStore.setState({ workspaceActivo: { id: 'ws-1', organizacion_id: 'o1', nombre: 'WS', activo: true } });
});

describe('useMiSemanaData', () => {
  it('sin usuarioId, no dispara ningún fetch', () => {
    const { result } = renderHook(() => useMiSemanaData(undefined, '202618', new Date('2026-04-27')), { wrapper: wrapWithQueryClient() });

    expect(result.current.tareasPlan).toEqual([]);
    expect(result.current.eventos).toEqual([]);
    expect(mockGetTareasSemana).not.toHaveBeenCalled();
  });

  it('con usuarioId, dispara ambos fetches (tareas y eventos)', async () => {
    mockGetTareasSemana.mockResolvedValue([]);
    mockGetEventosSemana.mockResolvedValue([]);
    const { result } = renderHook(() => useMiSemanaData('u1', '202618', new Date('2026-04-27')), { wrapper: wrapWithQueryClient() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockGetTareasSemana).toHaveBeenCalledWith('u1', '202618');
    expect(mockGetEventosSemana).toHaveBeenCalled();
  });
});

describe('useMiSemanaMutations', () => {
  it('crearPlan invoca la API y no lanza al invalidar sin usuarioId (guard interno)', async () => {
    mockCrearTareaPlanificada.mockResolvedValue({ id: 't1' });
    const { result } = renderHook(() => useMiSemanaMutations(undefined), { wrapper: wrapWithQueryClient() });

    await act(async () => {
      await result.current.crearPlan({
        titulo: 'Nueva', prioridad: 'media', fecha_planificada: '2026-04-29', creado_por: 'u1',
      });
    });

    expect(mockCrearTareaPlanificada).toHaveBeenCalled();
  });

  it('isPending refleja cuando alguna mutación está en curso', async () => {
    mockCrearTareaPlanificada.mockImplementation(() => new Promise(() => {})); // nunca resuelve
    const { result } = renderHook(() => useMiSemanaMutations('u1'), { wrapper: wrapWithQueryClient() });

    act(() => { void result.current.crearPlan({ titulo: 'X', prioridad: 'media', fecha_planificada: '2026-04-29', creado_por: 'u1' }); });

    await waitFor(() => expect(result.current.isPending).toBe(true));
  });
});
