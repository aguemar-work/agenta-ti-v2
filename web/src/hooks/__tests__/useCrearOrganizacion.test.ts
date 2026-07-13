/**
 * src/hooks/__tests__/useCrearOrganizacion.test.ts
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCrearOrganizacion } from '@/hooks/useCrearOrganizacion';
import { wrapWithQueryClient } from '@/test/helpers';

const mockCrearOrganizacion = vi.fn();

vi.mock('@/api/organizacion', () => ({
  crearOrganizacion: (...args: unknown[]) => mockCrearOrganizacion(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useCrearOrganizacion', () => {
  it('al mutar con éxito, invoca el callback onSuccess con el resultado', async () => {
    const result_ = { organizacion_id: 'o1', workspace_id: 'w1', modulos: ['areas'] };
    mockCrearOrganizacion.mockResolvedValue(result_);
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useCrearOrganizacion(onSuccess), { wrapper: wrapWithQueryClient() });

    act(() => { result.current.mutate({ nombre: 'Nufago', slug: 'nufago', modulos: ['areas'] }); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess.mock.calls[0]![0]).toEqual(result_);
  });

  it('sin onSuccess, no lanza al completar', async () => {
    mockCrearOrganizacion.mockResolvedValue({ organizacion_id: 'o1', workspace_id: 'w1', modulos: [] });
    const { result } = renderHook(() => useCrearOrganizacion(), { wrapper: wrapWithQueryClient() });

    act(() => { result.current.mutate({ nombre: 'Nufago', slug: 'nufago', modulos: [] }); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
