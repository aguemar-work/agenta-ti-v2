/**
 * src/hooks/__tests__/useSwipeDiaSemana.test.ts
 * Navegación por swipe horizontal entre días (móvil) — umbrales y límites de rango.
 */

import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSwipeDiaSemana } from '@/hooks/useSwipeDiaSemana';

const DIAS = ['2026-04-27', '2026-04-28', '2026-04-29', '2026-04-30'];

function stubMobile(matches: boolean) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
}

function touch(type: 'touchstart' | 'touchend', x: number, y: number) {
  const ev = new Event(type) as unknown as TouchEvent;
  Object.defineProperty(ev, 'touches', { value: [{ clientX: x, clientY: y }] });
  Object.defineProperty(ev, 'changedTouches', { value: [{ clientX: x, clientY: y }] });
  document.dispatchEvent(ev);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useSwipeDiaSemana', () => {
  it('en desktop (matchMedia no coincide), no reacciona a gestos táctiles', () => {
    stubMobile(false);
    const onChange = vi.fn();
    renderHook(() => useSwipeDiaSemana(DIAS, DIAS[1]!, onChange));

    touch('touchstart', 200, 100);
    touch('touchend', 100, 100); // swipe izquierda de 100px, superaría el umbral en móvil

    expect(onChange).not.toHaveBeenCalled();
  });

  it('swipe hacia la izquierda avanza al día siguiente', () => {
    stubMobile(true);
    const onChange = vi.fn();
    renderHook(() => useSwipeDiaSemana(DIAS, DIAS[1]!, onChange));

    touch('touchstart', 200, 100);
    touch('touchend', 100, 100); // dx = -100 (> umbral 48px)

    expect(onChange).toHaveBeenCalledWith(DIAS[2]);
  });

  it('swipe hacia la derecha retrocede al día anterior', () => {
    stubMobile(true);
    const onChange = vi.fn();
    renderHook(() => useSwipeDiaSemana(DIAS, DIAS[1]!, onChange));

    touch('touchstart', 100, 100);
    touch('touchend', 200, 100); // dx = +100

    expect(onChange).toHaveBeenCalledWith(DIAS[0]);
  });

  it('en el último día, swipe hacia la izquierda no dispara onChange (sin día siguiente)', () => {
    stubMobile(true);
    const onChange = vi.fn();
    renderHook(() => useSwipeDiaSemana(DIAS, DIAS[DIAS.length - 1]!, onChange));

    touch('touchstart', 200, 100);
    touch('touchend', 100, 100);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('desplazamiento menor al umbral horizontal no dispara onChange', () => {
    stubMobile(true);
    const onChange = vi.fn();
    renderHook(() => useSwipeDiaSemana(DIAS, DIAS[1]!, onChange));

    touch('touchstart', 200, 100);
    touch('touchend', 180, 100); // dx = -20, menor al umbral de 48px

    expect(onChange).not.toHaveBeenCalled();
  });

  it('desplazamiento demasiado vertical (scroll) no dispara onChange aunque el dx sea suficiente', () => {
    stubMobile(true);
    const onChange = vi.fn();
    renderHook(() => useSwipeDiaSemana(DIAS, DIAS[1]!, onChange));

    touch('touchstart', 200, 100);
    touch('touchend', 100, 200); // dx=-100 pero dy=100 (> 40px máx vertical)

    expect(onChange).not.toHaveBeenCalled();
  });
});
