/**
 * src/hooks/__tests__/useEsPlataformaOwner.test.ts
 * Gate por sesión: sin usuario autenticado, la query ni se dispara.
 *
 * Nota: usa React.createElement (no JSX) — el CI (vite.config.ts, filesystem
 * case-sensitive en ubuntu-latest) solo incluye `*.test.ts`, no `.tsx`.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useEsPlataformaOwner } from '@/hooks/useEsPlataformaOwner';
import { useAuthStore } from '@/store/authStore';

const { mockFetchEsPlataformaOwner } = vi.hoisted(() => ({
  mockFetchEsPlataformaOwner: vi.fn(),
}));

vi.mock('@/api/plataforma', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/plataforma')>();
  return { ...actual, fetchEsPlataformaOwner: mockFetchEsPlataformaOwner };
});

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ authUser: null, usuario: null, isLoading: false });
});

describe('useEsPlataformaOwner', () => {
  it('sin usuario en sesión, la query queda deshabilitada (no llama al fetch)', () => {
    const { result } = renderHook(() => useEsPlataformaOwner(), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchEsPlataformaOwner).not.toHaveBeenCalled();
  });

  it('con usuario en sesión, dispara la query y expone el resultado', async () => {
    useAuthStore.setState({
      usuario: { id: 'u1', nombre: 'Ana', email: 'a@x.com', rol: 'jefe', activo: true, created_at: '', updated_at: '' },
    });
    mockFetchEsPlataformaOwner.mockResolvedValue(true);

    const { result } = renderHook(() => useEsPlataformaOwner(), { wrapper });

    await waitFor(() => expect(result.current.data).toBe(true));
    expect(mockFetchEsPlataformaOwner).toHaveBeenCalledTimes(1);
  });
});
