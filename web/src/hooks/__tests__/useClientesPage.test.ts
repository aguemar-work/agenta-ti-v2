/**
 * src/hooks/__tests__/useClientesPage.test.ts
 * Mismo patrón que useAreasPage — catálogo de clientes.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useClientesPage } from '@/hooks/useClientesPage';
import { wrapWithQueryClient } from '@/test/helpers';
import { useWorkspaceStore } from '@/store/workspaceStore';

const mockGetClientes = vi.fn();
const mockCrearCliente = vi.fn();
const mockActualizarCliente = vi.fn();
const mockDesactivarCliente = vi.fn();

vi.mock('@/api/clientes', () => ({
  Q_CLIENTES: 'clientes',
  getClientes: () => mockGetClientes(),
  crearCliente: (input: unknown) => mockCrearCliente(input),
  actualizarCliente: (input: unknown) => mockActualizarCliente(input),
  desactivarCliente: (id: string) => mockDesactivarCliente(id),
}));

const CLIENTE = { id: 'c1', workspace_id: 'ws-1', nombre: 'Acme', activo: true, created_at: '' };

beforeEach(() => {
  vi.clearAllMocks();
  useWorkspaceStore.setState({ workspaceActivo: { id: 'ws-1', organizacion_id: 'o1', nombre: 'WS', activo: true } });
  mockGetClientes.mockResolvedValue([CLIENTE]);
});

describe('useClientesPage', () => {
  it('abrirEditar precarga el form (hasChanges=false)', async () => {
    const { result } = renderHook(() => useClientesPage(), { wrapper: wrapWithQueryClient() });
    await waitFor(() => expect(result.current.clientes).toHaveLength(1));

    act(() => { result.current.abrirEditar('c1'); });

    expect(result.current.form).toEqual({ nombre: 'Acme' });
    expect(result.current.hasChanges).toBe(false);
  });

  it('submitForm con editandoId llama a actualizar, no a crear', async () => {
    mockActualizarCliente.mockResolvedValue(CLIENTE);
    const { result } = renderHook(() => useClientesPage(), { wrapper: wrapWithQueryClient() });
    await waitFor(() => expect(result.current.clientes).toHaveLength(1));
    act(() => { result.current.abrirEditar('c1'); result.current.setForm({ nombre: 'Acme Corp' }); });

    act(() => { result.current.submitForm(); });

    await waitFor(() => expect(mockActualizarCliente).toHaveBeenCalledWith({ id: 'c1', nombre: 'Acme Corp' }));
    expect(mockCrearCliente).not.toHaveBeenCalled();
  });

  it('submitForm con nombre vacío no llama a nada', async () => {
    const { result } = renderHook(() => useClientesPage(), { wrapper: wrapWithQueryClient() });
    await waitFor(() => expect(result.current.clientes).toHaveLength(1));
    act(() => { result.current.abrirNuevo(); });

    act(() => { result.current.submitForm(); });

    expect(mockCrearCliente).not.toHaveBeenCalled();
  });
});
