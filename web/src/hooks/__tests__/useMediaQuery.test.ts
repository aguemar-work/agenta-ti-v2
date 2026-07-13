/**
 * src/hooks/__tests__/useMediaQuery.test.ts
 * Suscripción a matchMedia — valor inicial y reacción a cambios.
 */

import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery } from '@/hooks/useMediaQuery';

function mockMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  let listener: (() => void) | null = null;
  const mql = {
    get matches() { return matches; },
    addEventListener: vi.fn((_: string, cb: () => void) => { listener = cb; }),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal('matchMedia', vi.fn(() => mql));
  return {
    setMatches(v: boolean) { matches = v; listener?.(); },
    mql,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useMediaQuery', () => {
  it('toma el valor inicial real de matchMedia al montar', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery('(max-width: 767px)'));

    expect(result.current).toBe(true);
  });

  it('reacciona al evento "change" del media query', () => {
    const { setMatches } = mockMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery('(max-width: 767px)'));
    expect(result.current).toBe(false);

    act(() => { setMatches(true); });

    expect(result.current).toBe(true);
  });

  it('se desuscribe del listener al desmontar', () => {
    const { mql } = mockMatchMedia(false);
    const { unmount } = renderHook(() => useMediaQuery('(max-width: 767px)'));

    unmount();

    expect(mql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
