/**
 * src/hooks/__tests__/useSemanaModales.test.ts
 *
 * Estado y handlers de los modales de Mi Semana. Casos de mayor riesgo
 * silencioso: quién recibe la notificación al completar tarea (jefeIds solo
 * si el actor NO es jefe), el fallback de responsable al crear tarea desde
 * modal, y que "Deshacer" en el toast de iniciar realmente revierta el estado.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSemanaModales } from '@/hooks/useSemanaModales';
import { wrapWithQueryClient } from '@/test/helpers';
import { makeJefe, makeUsuario, makeTarea, setRolActivoTest } from '@/test/helpers';

const mockCambiarEstadoTarea = vi.fn();
const mockReprogramarTareaConLog = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock('@/api/semana', () => ({
  cambiarEstadoTarea: (...a: unknown[]) => mockCambiarEstadoTarea(...a),
  reprogramarTareaConLog: (...a: unknown[]) => mockReprogramarTareaConLog(...a),
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...a: unknown[]) => mockToastSuccess(...a),
    error: (...a: unknown[]) => mockToastError(...a),
  },
}));

function makeMut(overrides: Record<string, unknown> = {}) {
  return {
    crearPlan: vi.fn().mockResolvedValue(undefined),
    moverDia: vi.fn().mockResolvedValue(undefined),
    moverEntre: vi.fn().mockResolvedValue(undefined),
    editarTarea: vi.fn().mockResolvedValue(undefined),
    eliminarTarea: vi.fn().mockResolvedValue(undefined),
    cancelarTarea: vi.fn().mockResolvedValue(undefined),
    completarTareaConResumen: vi.fn().mockResolvedValue(undefined),
    iniciarTarea: vi.fn().mockResolvedValue(undefined),
    crearEvento: vi.fn().mockResolvedValue(undefined),
    actualizarEvento: vi.fn().mockResolvedValue(undefined),
    eliminarEvento: vi.fn().mockResolvedValue(undefined),
    isPending: false,
    completarPendingId: null,
    iniciarPendingId: null,
    eliminarPendingId: null,
    cancelarPendingId: null,
    ...overrides,
  } as unknown as Parameters<typeof useSemanaModales>[0]['mut'];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('confirmarCompletar', () => {
  it('miembro con jefes a notificar: incluye jefeIds', async () => {
    setRolActivoTest('miembro');
    const mut = makeMut();
    const jefes = [{ id: 'jefe-1' }, { id: 'jefe-2' }];
    const { result } = renderHook(
      () => useSemanaModales({ tareasPlan: [], hoyYmd: '2026-04-29', usuario: makeUsuario(), jefesNotificacion: jefes, mut }),
      { wrapper: wrapWithQueryClient() },
    );

    await act(async () => { await result.current.confirmarCompletar({ tareaId: 'uuid-tarea', resumen: 'Listo' }); });

    expect(mut.completarTareaConResumen).toHaveBeenCalledWith(expect.objectContaining({
      jefeIds: ['jefe-1', 'jefe-2'],
    }));
  });

  it('jefe (esJefe=true): NO incluye jefeIds aunque haya jefesNotificacion', async () => {
    setRolActivoTest('jefe');
    const mut = makeMut();
    const { result } = renderHook(
      () => useSemanaModales({ tareasPlan: [], hoyYmd: '2026-04-29', usuario: makeJefe(), jefesNotificacion: [{ id: 'otro-jefe' }], mut }),
      { wrapper: wrapWithQueryClient() },
    );

    await act(async () => { await result.current.confirmarCompletar({ tareaId: 'uuid-tarea', resumen: 'Listo' }); });

    expect(mut.completarTareaConResumen).toHaveBeenCalledWith(expect.not.objectContaining({ jefeIds: expect.anything() }));
  });
});

describe('crearTareaDesdeModal', () => {
  it('sin asignado_a (o solo espacios), usa el usuario actual como responsable', async () => {
    setRolActivoTest('miembro');
    const mut = makeMut();
    const usuario = makeUsuario({ id: 'uuid-actor' });
    const { result } = renderHook(
      () => useSemanaModales({ tareasPlan: [], hoyYmd: '2026-04-29', usuario, jefesNotificacion: [], mut }),
      { wrapper: wrapWithQueryClient() },
    );
    act(() => { result.current.setModal({ fecha: '2026-04-30' }); });

    await act(async () => {
      await result.current.crearTareaDesdeModal({
        titulo: 'Nueva', prioridad: 'media', descripcion: '', asignado_a: '   ',
      });
    });

    expect(mut.crearPlan).toHaveBeenCalledWith(expect.objectContaining({ asignado_a: 'uuid-actor' }));
  });
});

describe('iniciarDesdeDetalle', () => {
  it('al deshacer desde el toast, revierte al estado previo de la tarea', async () => {
    setRolActivoTest('miembro');
    const mut = makeMut();
    mockCambiarEstadoTarea.mockResolvedValue(undefined);
    const { result } = renderHook(
      () => useSemanaModales({ tareasPlan: [], hoyYmd: '2026-04-29', usuario: makeUsuario(), jefesNotificacion: [], mut }),
      { wrapper: wrapWithQueryClient() },
    );
    const tarea = makeTarea({ id: 'uuid-tarea', estado: 'pendiente' });

    await act(async () => { await result.current.iniciarDesdeDetalle(tarea); });

    expect(mockToastSuccess).toHaveBeenCalledWith('Tarea en progreso', expect.objectContaining({
      action: expect.objectContaining({ label: 'Deshacer' }),
    }));
    const undoOnClick = mockToastSuccess.mock.calls[0]![1].action.onClick as () => Promise<void>;

    await act(async () => { await undoOnClick(); });

    expect(mockCambiarEstadoTarea).toHaveBeenCalledWith({ tareaId: 'uuid-tarea', nuevoEstado: 'pendiente' });
  });
});

describe('eliminarDesdeDetalle / cancelarDesdeDetalle — manejo de error', () => {
  it('si mut.eliminarTarea falla, muestra toast de error y NO limpia detalleTareaId', async () => {
    const mut = makeMut({ eliminarTarea: vi.fn().mockRejectedValue(new Error('RLS')) });
    const { result } = renderHook(
      () => useSemanaModales({ tareasPlan: [], hoyYmd: '2026-04-29', usuario: makeUsuario(), jefesNotificacion: [], mut }),
      { wrapper: wrapWithQueryClient() },
    );
    act(() => { result.current.setDetalleTareaId('uuid-tarea'); });

    await act(async () => { await result.current.eliminarDesdeDetalle({ tareaId: 'uuid-tarea', motivo: 'Duplicada, error de carga' }); });

    expect(mockToastError).toHaveBeenCalled();
    expect(result.current.detalleTareaId).toBe('uuid-tarea');
  });
});
