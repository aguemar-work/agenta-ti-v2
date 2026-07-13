/**
 * src/hooks/__tests__/useSwipeOTRow.test.ts
 * Revela acciones al deslizar la fila hacia la izquierda (móvil) — umbral de snap.
 */

import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSwipeOTRow } from '@/hooks/useSwipeOTRow';

function fakeTouch(x: number, y: number) {
  return { touches: [{ clientX: x, clientY: y }] } as unknown as React.TouchEvent;
}

describe('useSwipeOTRow', () => {
  it('con enabled:false, los handlers no cambian el estado', () => {
    const { result } = renderHook(() => useSwipeOTRow(false));

    // Cada fase en su propio act(): onTouchEnd lee `offset` de un render ya confirmado
    // (si se agrupan en un solo act(), React 18 batchea los setState y onTouchEnd ve el offset viejo).
    act(() => { result.current.handlers.onTouchStart(fakeTouch(200, 100)); });
    act(() => { result.current.handlers.onTouchMove(fakeTouch(100, 100)); });
    act(() => { result.current.handlers.onTouchEnd(); });

    expect(result.current.open).toBe(false);
    expect(result.current.offset).toBe(0);
  });

  it('deslizar más allá del umbral de snap deja la fila abierta', () => {
    const { result } = renderHook(() => useSwipeOTRow(true));

    act(() => { result.current.handlers.onTouchStart(fakeTouch(200, 100)); });
    act(() => { result.current.handlers.onTouchMove(fakeTouch(100, 100)); }); // dx = -100, offset clamped a -132
    act(() => { result.current.handlers.onTouchEnd(); });

    expect(result.current.open).toBe(true);
    expect(result.current.offset).toBe(-132);
  });

  it('deslizar menos del umbral de snap vuelve a cerrar (close)', () => {
    const { result } = renderHook(() => useSwipeOTRow(true));

    act(() => { result.current.handlers.onTouchStart(fakeTouch(200, 100)); });
    act(() => { result.current.handlers.onTouchMove(fakeTouch(180, 100)); }); // dx = -20, bajo el umbral de 44
    act(() => { result.current.handlers.onTouchEnd(); });

    expect(result.current.open).toBe(false);
    expect(result.current.offset).toBe(0);
  });

  it('close() cierra la fila y resetea el offset', () => {
    const { result } = renderHook(() => useSwipeOTRow(true));
    // Cada fase en su propio act(): onTouchEnd lee `offset` de un render ya confirmado
    // (si se agrupan en un solo act(), React 18 batchea los setState y onTouchEnd ve el offset viejo).
    act(() => { result.current.handlers.onTouchStart(fakeTouch(200, 100)); });
    act(() => { result.current.handlers.onTouchMove(fakeTouch(100, 100)); });
    act(() => { result.current.handlers.onTouchEnd(); });
    expect(result.current.open).toBe(true);

    act(() => { result.current.close(); });

    expect(result.current.open).toBe(false);
    expect(result.current.offset).toBe(0);
  });

  it('el offset nunca excede el rango [OPEN_OFFSET_PX, 0]', () => {
    const { result } = renderHook(() => useSwipeOTRow(true));

    act(() => {
      result.current.handlers.onTouchStart(fakeTouch(500, 100));
      result.current.handlers.onTouchMove(fakeTouch(0, 100)); // dx = -500, muy por fuera del rango
    });

    expect(result.current.offset).toBe(-132); // clamp al mínimo, no -500
  });
});
