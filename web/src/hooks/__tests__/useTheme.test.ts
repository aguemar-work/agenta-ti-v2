/**
 * src/hooks/__tests__/useTheme.test.ts
 * Tema claro/oscuro persistido en localStorage + clase .dark en <html>.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '@/hooks/useTheme';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

describe('useTheme', () => {
  it('sin preferencia guardada, arranca en "light" sin clase .dark', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('con "dark" guardado en localStorage, arranca en modo oscuro', () => {
    localStorage.setItem('mc-theme', 'dark');
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('toggleTheme alterna el tema y actualiza localStorage + clase del documento', () => {
    const { result } = renderHook(() => useTheme());

    act(() => { result.current.toggleTheme(); });
    expect(result.current.theme).toBe('dark');
    expect(localStorage.getItem('mc-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    act(() => { result.current.toggleTheme(); });
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
