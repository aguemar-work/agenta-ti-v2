/**
 * src/hooks/__tests__/useProyectosPage.test.ts
 * Catálogo de proyectos — además de crear/editar/archivar, indexa
 * nombreClientePorId a partir del catálogo de clientes.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useProyectosPage } from '@/hooks/useProyectosPage';
import { wrapWithQueryClient } from '@/test/helpers';
import { useWorkspaceStore } from '@/store/workspaceStore';

const mockGetProyectos = vi.fn();
const mockGetClientes = vi.fn();
const mockCrearProyecto = vi.fn();
const mockActualizarProyecto = vi.fn();
const mockArchivarProyecto = vi.fn();

vi.mock('@/api/proyectos', () => ({
  Q_PROYECTOS: 'proyectos',
  getProyectos: () => mockGetProyectos(),
  crearProyecto: (input: unknown) => mockCrearProyecto(input),
  actualizarProyecto: (input: unknown) => mockActualizarProyecto(input),
  archivarProyecto: (id: string) => mockArchivarProyecto(id),
}));

vi.mock('@/api/clientes', () => ({
  Q_CLIENTES: 'clientes',
  getClientes: () => mockGetClientes(),
}));

const PROYECTO = { id: 'p1', workspace_id: 'ws-1', cliente_id: 'c1', nombre: 'Migración ERP', descripcion: null, estado: 'activo' as const, created_at: '' };
const CLIENTE = { id: 'c1', workspace_id: 'ws-1', nombre: 'Acme', activo: true, created_at: '' };

beforeEach(() => {
  vi.clearAllMocks();
  useWorkspaceStore.setState({ workspaceActivo: { id: 'ws-1', organizacion_id: 'o1', nombre: 'WS', activo: true } });
  mockGetProyectos.mockResolvedValue([PROYECTO]);
  mockGetClientes.mockResolvedValue([CLIENTE]);
});

describe('useProyectosPage', () => {
  it('nombreClientePorId indexa el catálogo de clientes por id', async () => {
    const { result } = renderHook(() => useProyectosPage(), { wrapper: wrapWithQueryClient() });

    await waitFor(() => expect(result.current.nombreClientePorId.get('c1')).toBe('Acme'));
  });

  it('abrirEditar precarga el form (descripcion/cliente_id null se muestran como string vacío)', async () => {
    const { result } = renderHook(() => useProyectosPage(), { wrapper: wrapWithQueryClient() });
    await waitFor(() => expect(result.current.proyectos).toHaveLength(1));

    act(() => { result.current.abrirEditar('p1'); });

    expect(result.current.form).toEqual({ nombre: 'Migración ERP', descripcion: '', cliente_id: 'c1', estado: 'activo' });
  });

  it('submitForm envía descripcion vacía como null (no string vacío)', async () => {
    mockActualizarProyecto.mockResolvedValue(PROYECTO);
    const { result } = renderHook(() => useProyectosPage(), { wrapper: wrapWithQueryClient() });
    await waitFor(() => expect(result.current.proyectos).toHaveLength(1));
    act(() => { result.current.abrirEditar('p1'); });

    act(() => { result.current.submitForm(); });

    await waitFor(() => expect(mockActualizarProyecto).toHaveBeenCalledWith(expect.objectContaining({ descripcion: null })));
  });

  it('confirmarArchivar con un id seleccionado, llama al mutation', async () => {
    mockArchivarProyecto.mockResolvedValue(undefined);
    const { result } = renderHook(() => useProyectosPage(), { wrapper: wrapWithQueryClient() });
    await waitFor(() => expect(result.current.proyectos).toHaveLength(1));
    act(() => { result.current.setArchivarId('p1'); });

    act(() => { result.current.confirmarArchivar(); });

    await waitFor(() => expect(mockArchivarProyecto).toHaveBeenCalledWith('p1'));
  });
});
