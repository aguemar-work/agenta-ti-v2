/**
 * src/hooks/__tests__/useOrgsDesactivadas.test.ts
 * Papelera de organizaciones (soft-delete) — query + 2 mutaciones que
 * refrescan orgs y refetchean la papelera al completar.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  useOrgsDesactivadas, useDesactivarOrg, useReactivarOrg,
} from '@/hooks/useOrgsDesactivadas';
import { wrapWithQueryClient } from '@/test/helpers';

const mockFetchOrgsDesactivadas = vi.fn();
const mockDesactivarOrg = vi.fn();
const mockReactivarOrg = vi.fn();
const mockRefrescarOrgs = vi.fn().mockResolvedValue(undefined);

vi.mock('@/api/plataforma', () => ({
  fetchOrgsDesactivadas: () => mockFetchOrgsDesactivadas(),
  desactivarOrg: (id: string) => mockDesactivarOrg(id),
  reactivarOrg: (id: string) => mockReactivarOrg(id),
}));

vi.mock('@/api/organizacion', () => ({
  refrescarOrgs: () => mockRefrescarOrgs(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockRefrescarOrgs.mockResolvedValue(undefined);
});

describe('useOrgsDesactivadas', () => {
  it('con enabled:false, no dispara el fetch', () => {
    const { result } = renderHook(() => useOrgsDesactivadas(false), { wrapper: wrapWithQueryClient() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchOrgsDesactivadas).not.toHaveBeenCalled();
  });

  it('con enabled:true (default), dispara el fetch y expone la lista', async () => {
    mockFetchOrgsDesactivadas.mockResolvedValue([{ id: 'o1', nombre: 'Vieja', slug: 'vieja', desactivada_en: '', purga_en: '' }]);
    const { result } = renderHook(() => useOrgsDesactivadas(), { wrapper: wrapWithQueryClient() });

    await waitFor(() => expect(result.current.data).toHaveLength(1));
  });
});

describe('useDesactivarOrg / useReactivarOrg', () => {
  it('al desactivar con éxito, refresca la lista de orgs y la papelera', async () => {
    mockDesactivarOrg.mockResolvedValue({ organizacion_id: 'o1', nombre: 'Nufago', desactivada_en: '', purga_en: '' });
    const { result } = renderHook(() => useDesactivarOrg(), { wrapper: wrapWithQueryClient() });

    act(() => { result.current.mutate('o1'); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockRefrescarOrgs).toHaveBeenCalledTimes(1);
  });

  it('al reactivar con éxito, refresca la lista de orgs y la papelera', async () => {
    mockReactivarOrg.mockResolvedValue({ organizacion_id: 'o1', nombre: 'Nufago' });
    const { result } = renderHook(() => useReactivarOrg(), { wrapper: wrapWithQueryClient() });

    act(() => { result.current.mutate('o1'); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockRefrescarOrgs).toHaveBeenCalledTimes(1);
  });

  it('si desactivar falla con un Error, isError queda true (el toast se maneja fuera del test)', async () => {
    mockDesactivarOrg.mockRejectedValue(new Error('permission denied'));
    const { result } = renderHook(() => useDesactivarOrg(), { wrapper: wrapWithQueryClient() });

    act(() => { result.current.mutate('o1'); });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockRefrescarOrgs).not.toHaveBeenCalled();
  });
});
