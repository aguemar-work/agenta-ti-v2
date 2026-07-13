/**
 * src/hooks/__tests__/useOTTiposTrabajo.test.ts
 *
 * Gestión de tipos de trabajo de OT — crear y activar/desactivar (con
 * actualización optimista + rollback en mutToggleTipo).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useOTTiposTrabajo } from '@/hooks/useOTTiposTrabajo';
import { Q_TIPOS_OT } from '@/hooks/useOrdenesTrabajoQueries';

const mockCrearTipoTrabajoOT = vi.fn();
const mockToggleTipoTrabajoOT = vi.fn();

vi.mock('@/api/ordenTrabajo', () => ({
  crearTipoTrabajoOT: (nombre: string) => mockCrearTipoTrabajoOT(nombre),
  toggleTipoTrabajoOT: (id: string, activo: boolean) => mockToggleTipoTrabajoOT(id, activo),
}));

vi.mock('@/store/workspaceStore', () => ({
  getWorkspaceId: () => 'ws-1',
}));

const TIPOS = [
  { id: 't1', nombre: 'MANTENIMIENTO', activo: true, created_at: '' },
  { id: 't2', nombre: 'INSTALACION', activo: false, created_at: '' },
];

function wrapperWithClient(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useOTTiposTrabajo', () => {
  it('separa tiposActivos/tiposInactivos a partir de la lista recibida', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useOTTiposTrabajo(TIPOS), { wrapper: wrapperWithClient(qc) });

    expect(result.current.tiposActivos.map((t) => t.id)).toEqual(['t1']);
    expect(result.current.tiposInactivos.map((t) => t.id)).toEqual(['t2']);
  });

  it('canCrearTipo requiere nombre no vacío y ninguna mutación en curso', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useOTTiposTrabajo(TIPOS), { wrapper: wrapperWithClient(qc) });

    expect(result.current.canCrearTipo).toBe(false); // nombre vacío
    act(() => { result.current.setNuevoTipoNombre('  '); });
    expect(result.current.canCrearTipo).toBe(false); // solo espacios
    act(() => { result.current.setNuevoTipoNombre('Redes'); });
    expect(result.current.canCrearTipo).toBe(true);
  });

  it('mutCrearTipo con éxito limpia el nombre ingresado', async () => {
    mockCrearTipoTrabajoOT.mockResolvedValue({ id: 't3', nombre: 'REDES', activo: true, created_at: '' });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useOTTiposTrabajo(TIPOS), { wrapper: wrapperWithClient(qc) });
    act(() => { result.current.setNuevoTipoNombre('Redes'); });

    act(() => { result.current.mutCrearTipo.mutate(); });

    await waitFor(() => expect(result.current.mutCrearTipo.isSuccess).toBe(true));
    expect(result.current.nuevoTipoNombre).toBe('');
  });

  it('mutToggleTipo: la actualización optimista escribe en una queryKey distinta a la real (bug de cache key) — este test documenta el comportamiento actual, no lo prescribe', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // Semilla de la query TAL COMO la registra useOrdenesTrabajoQueries: [Q_TIPOS_OT, wsId]
    qc.setQueryData([Q_TIPOS_OT, 'ws-1'], TIPOS);
    mockToggleTipoTrabajoOT.mockResolvedValue(undefined);
    const { result } = renderHook(() => useOTTiposTrabajo(TIPOS), { wrapper: wrapperWithClient(qc) });

    act(() => { result.current.mutToggleTipo.mutate({ id: 't2', activo: true }); });

    await waitFor(() => expect(result.current.mutToggleTipo.isSuccess || result.current.mutToggleTipo.isError).toBe(true));

    // La query real (con workspace) NO se actualiza de forma optimista — onMutate escribe
    // en qc.setQueryData([Q_TIPOS_OT]) sin el segmento de workspace (bug real, no del test).
    expect(qc.getQueryData([Q_TIPOS_OT, 'ws-1'])).toEqual(TIPOS);
  });
});
