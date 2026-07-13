/**
 * src/hooks/__tests__/useIsMobile.test.ts
 * useIsMobile delega en useMediaQuery con el breakpoint 767px de Tailwind `md:`.
 */

import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIsMobile, MOBILE_MEDIA_QUERY, MOBILE_MAX_WIDTH_PX } from '@/hooks/useIsMobile';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useIsMobile', () => {
  it('consulta matchMedia con el breakpoint móvil (767px)', () => {
    expect(MOBILE_MEDIA_QUERY).toBe('(max-width: 767px)');
    expect(MOBILE_MAX_WIDTH_PX).toBe(767);

    const matchMediaSpy = vi.fn(() => ({
      matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    }));
    vi.stubGlobal('matchMedia', matchMediaSpy);

    const { result } = renderHook(() => useIsMobile());

    expect(matchMediaSpy).toHaveBeenCalledWith(MOBILE_MEDIA_QUERY);
    expect(result.current).toBe(true);
  });
});
