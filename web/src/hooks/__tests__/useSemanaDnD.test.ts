import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import {
  SEMANA_DND_POINTER_ACTIVATION,
  SEMANA_DND_TOUCH_ACTIVATION,
  useSemanaDnD,
} from '@/hooks/useSemanaDnD';
import { makeTarea, FECHAS } from '@/test/helpers';
import type { DragEndEvent, DragOverEvent } from '@dnd-kit/core';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/hooks/useTareas', () => ({
  reprogramarTareaConLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/tareaEstado', () => ({
  resolverEstadoReprogramacion: vi.fn().mockReturnValue('reprogramada'),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ---------------------------------------------------------------------------

const TAREA_PLAN = makeTarea({
  id:                'uuid-tarea-plan',
  tipo:              'planificada',
  estado:            'pendiente',
  fecha_planificada: FECHAS.HOY,
});

const TAREA_IMP = makeTarea({
  id:     'uuid-tarea-imp',
  tipo:   'no_planificada',
  estado: 'pendiente',
});

function makeOnMoverDia() {
  return vi.fn().mockResolvedValue(undefined);
}

function makeDragEnd(activeId: string, overId: string): DragEndEvent {
  return {
    active: { id: activeId, data: { current: {} }, rect: { current: { initial: null, translated: null } } },
    over:   { id: overId,   data: { current: {} }, rect: { width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0 } },
    delta:  { x: 0, y: 0 },
    activatorEvent: new PointerEvent('pointerdown'),
    collisions: [],
  } as unknown as DragEndEvent;
}

function makeDragOver(over: DragOverEvent['over']): DragOverEvent {
  return {
    active: { id: 'tarea-x', data: { current: {} }, rect: { current: { initial: null, translated: null } } },
    over,
    collisions: [],
    delta: { x: 0, y: 0 },
  } as unknown as DragOverEvent;
}

// ---------------------------------------------------------------------------

describe('configuración DnD táctil (M-01)', () => {
  it('PointerSensor: distance 8px', () => {
    expect(SEMANA_DND_POINTER_ACTIVATION).toEqual({ distance: 8 });
  });

  it('TouchSensor: delay 250ms y tolerance 5', () => {
    expect(SEMANA_DND_TOUCH_ACTIVATION).toEqual({ delay: 250, tolerance: 5 });
  });
});

describe('useSemanaDnD', () => {

  beforeEach(() => { vi.clearAllMocks(); });

  // ── Estado inicial ────────────────────────────────────────────────────────

  it('activeDragId inicia en null', () => {
    const { result } = renderHook(() =>
      useSemanaDnD({ tareasPlan: [], hoyYmd: FECHAS.HOY, usuarioId: 'u1', onMoverDia: makeOnMoverDia() }),
    );
    expect(result.current.activeDragId).toBeNull();
  });

  it('activeTareaDrag inicia en null', () => {
    const { result } = renderHook(() =>
      useSemanaDnD({ tareasPlan: [], hoyYmd: FECHAS.HOY, usuarioId: 'u1', onMoverDia: makeOnMoverDia() }),
    );
    expect(result.current.activeTareaDrag).toBeNull();
  });

  // ── setActiveDragId ───────────────────────────────────────────────────────

  it('setActiveDragId actualiza activeDragId', () => {
    const { result } = renderHook(() =>
      useSemanaDnD({ tareasPlan: [TAREA_PLAN], hoyYmd: FECHAS.HOY, usuarioId: 'u1', onMoverDia: makeOnMoverDia() }),
    );
    act(() => { result.current.setActiveDragId('tarea-uuid-tarea-plan'); });
    expect(result.current.activeDragId).toBe('tarea-uuid-tarea-plan');
  });

  it('activeTareaDrag resuelve la tarea por ID al arrastrar', () => {
    const { result } = renderHook(() =>
      useSemanaDnD({ tareasPlan: [TAREA_PLAN], hoyYmd: FECHAS.HOY, usuarioId: 'u1', onMoverDia: makeOnMoverDia() }),
    );
    act(() => { result.current.setActiveDragId('tarea-uuid-tarea-plan'); });
    expect(result.current.activeTareaDrag?.id).toBe('uuid-tarea-plan');
  });

  // ── onDragEnd ─────────────────────────────────────────────────────────────

  it('onDragEnd limpia activeDragId', async () => {
    const onMoverDia = makeOnMoverDia();
    const { result } = renderHook(() =>
      useSemanaDnD({ tareasPlan: [TAREA_IMP], hoyYmd: FECHAS.HOY, usuarioId: 'u1', onMoverDia }),
    );
    act(() => { result.current.setActiveDragId('tarea-uuid-tarea-imp'); });
    await act(async () => {
      await result.current.onDragEnd(makeDragEnd('tarea-uuid-tarea-imp', `day-${FECHAS.MANANA}`));
    });
    expect(result.current.activeDragId).toBeNull();
  });

  it('onDragEnd llama onMoverDia para tarea no_planificada', async () => {
    const onMoverDia = makeOnMoverDia();
    const { result } = renderHook(() =>
      useSemanaDnD({ tareasPlan: [TAREA_IMP], hoyYmd: FECHAS.HOY, usuarioId: 'u1', onMoverDia }),
    );
    await act(async () => {
      await result.current.onDragEnd(makeDragEnd('tarea-uuid-tarea-imp', `day-${FECHAS.MANANA}`));
    });
    expect(onMoverDia).toHaveBeenCalledWith(
      expect.objectContaining({ tareaId: 'uuid-tarea-imp', fecha: FECHAS.MANANA }),
    );
  });

  it('onDragEnd abre modal de reprogramación para tarea planificada que cambia de día', async () => {
    const onMoverDia = makeOnMoverDia();
    const { result } = renderHook(() =>
      useSemanaDnD({ tareasPlan: [TAREA_PLAN], hoyYmd: FECHAS.HOY, usuarioId: 'u1', onMoverDia }),
    );
    await act(async () => {
      await result.current.onDragEnd(makeDragEnd('tarea-uuid-tarea-plan', `day-${FECHAS.MANANA}`));
    });
    // NO llama onMoverDia directamente — abre el modal de reprogramación
    expect(onMoverDia).not.toHaveBeenCalled();
    expect(result.current.reprDragTarea).not.toBeNull();
    expect(result.current.reprDragTarea?.tarea.id).toBe('uuid-tarea-plan');
    expect(result.current.reprDragTarea?.fecha).toBe(FECHAS.MANANA);
  });

  it('onDragEnd no hace nada si no hay over', async () => {
    const onMoverDia = makeOnMoverDia();
    const { result } = renderHook(() =>
      useSemanaDnD({ tareasPlan: [TAREA_PLAN], hoyYmd: FECHAS.HOY, usuarioId: 'u1', onMoverDia }),
    );
    await act(async () => {
      await result.current.onDragEnd({
        ...makeDragEnd('tarea-uuid-tarea-plan', ''),
        over: null,
      } as unknown as DragEndEvent);
    });
    expect(onMoverDia).not.toHaveBeenCalled();
  });

  it('onDragEnd no hace nada si el over no es un día', async () => {
    const onMoverDia = makeOnMoverDia();
    const { result } = renderHook(() =>
      useSemanaDnD({ tareasPlan: [TAREA_PLAN], hoyYmd: FECHAS.HOY, usuarioId: 'u1', onMoverDia }),
    );
    await act(async () => {
      await result.current.onDragEnd(makeDragEnd('tarea-uuid-tarea-plan', 'kanban-col-pendiente'));
    });
    expect(onMoverDia).not.toHaveBeenCalled();
  });

  // ── onDragOver ────────────────────────────────────────────────────────────

  it('onDragOver actualiza overId', () => {
    const { result } = renderHook(() =>
      useSemanaDnD({ tareasPlan: [], hoyYmd: FECHAS.HOY, usuarioId: 'u1', onMoverDia: makeOnMoverDia() }),
    );
    act(() => {
      result.current.onDragOver(
        makeDragOver({ id: `day-${FECHAS.MANANA}`, data: { current: {} }, rect: {} } as DragOverEvent['over']),
      );
    });
    expect(result.current.overId).toBe(`day-${FECHAS.MANANA}`);
  });

  it('onDragOver limpia overId cuando over es null', () => {
    const { result } = renderHook(() =>
      useSemanaDnD({ tareasPlan: [], hoyYmd: FECHAS.HOY, usuarioId: 'u1', onMoverDia: makeOnMoverDia() }),
    );
    act(() => {
      result.current.onDragOver(makeDragOver(null));
    });
    expect(result.current.overId).toBeNull();
  });
});