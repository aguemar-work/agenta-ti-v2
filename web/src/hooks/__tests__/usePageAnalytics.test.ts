/**
 * src/hooks/__tests__/usePageAnalytics.test.ts
 * Registra page_view en cada cambio de ruta.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { usePageAnalytics } from '@/hooks/usePageAnalytics';

const mockTrackPageView = vi.fn();

vi.mock('@/lib/analytics', () => ({
  trackPageView: (pathname: string) => mockTrackPageView(pathname),
}));

function wrapperAt(initialPath: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      MemoryRouter,
      { initialEntries: [initialPath] },
      createElement(Routes, null, createElement(Route, { path: '*', element: children })),
    );
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('usePageAnalytics', () => {
  it('al montar, registra la ruta actual', () => {
    renderHook(() => usePageAnalytics(), { wrapper: wrapperAt('/semana') });

    expect(mockTrackPageView).toHaveBeenCalledWith('/semana');
    expect(mockTrackPageView).toHaveBeenCalledTimes(1);
  });

  it('con otra ruta inicial, registra esa ruta', () => {
    renderHook(() => usePageAnalytics(), { wrapper: wrapperAt('/objetivos') });

    expect(mockTrackPageView).toHaveBeenCalledWith('/objetivos');
  });
});
