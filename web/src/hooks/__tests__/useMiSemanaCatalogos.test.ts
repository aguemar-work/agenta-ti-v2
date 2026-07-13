/**
 * src/hooks/__tests__/useMiSemanaCatalogos.test.ts
 * Catálogos opcionales de Mi Semana — cada uno solo se carga si el workspace
 * tiene el módulo correspondiente activo.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMiSemanaCatalogos } from '@/hooks/useMiSemanaCatalogos';
import { wrapWithQueryClient } from '@/test/helpers';
import { useWorkspaceStore } from '@/store/workspaceStore';

const mockGetClientes = vi.fn();
const mockGetProyectos = vi.fn();
const mockGetAreas = vi.fn();

vi.mock('@/api/clientes', () => ({ getClientes: () => mockGetClientes(), Q_CLIENTES: 'clientes' }));
vi.mock('@/api/proyectos', () => ({ getProyectos: () => mockGetProyectos(), Q_PROYECTOS: 'proyectos' }));
vi.mock('@/api/areas', () => ({ getAreas: () => mockGetAreas(), Q_AREAS: 'areas' }));

beforeEach(() => {
  vi.clearAllMocks();
  useWorkspaceStore.getState().reset();
});

function setWorkspaceConModulos(modulos: string[]) {
  useWorkspaceStore.setState({
    workspaceActivo: { id: 'ws-1', organizacion_id: 'o1', nombre: 'WS', activo: true },
    modulos,
  });
}

describe('useMiSemanaCatalogos', () => {
  it('sin módulos activos, no dispara ningún fetch', () => {
    setWorkspaceConModulos([]);
    const { result } = renderHook(() => useMiSemanaCatalogos(), { wrapper: wrapWithQueryClient() });

    expect(result.current.moduloClientes).toBe(false);
    expect(result.current.moduloProyectos).toBe(false);
    expect(result.current.moduloAreas).toBe(false);
    expect(mockGetClientes).not.toHaveBeenCalled();
    expect(mockGetProyectos).not.toHaveBeenCalled();
    expect(mockGetAreas).not.toHaveBeenCalled();
  });

  it('solo carga los catálogos de los módulos activos', async () => {
    setWorkspaceConModulos(['clientes']);
    mockGetClientes.mockResolvedValue([{ id: 'c1', workspace_id: 'ws-1', nombre: 'Acme', activo: true, created_at: '' }]);
    const { result } = renderHook(() => useMiSemanaCatalogos(), { wrapper: wrapWithQueryClient() });

    await waitFor(() => expect(result.current.clientesCatalogo).toHaveLength(1));
    expect(mockGetProyectos).not.toHaveBeenCalled();
    expect(mockGetAreas).not.toHaveBeenCalled();
  });

  it('proyectosActivos filtra los archivados/completados del catálogo', async () => {
    setWorkspaceConModulos(['proyectos']);
    mockGetProyectos.mockResolvedValue([
      { id: 'p1', workspace_id: 'ws-1', cliente_id: null, nombre: 'A', descripcion: null, estado: 'activo', created_at: '' },
      { id: 'p2', workspace_id: 'ws-1', cliente_id: null, nombre: 'B', descripcion: null, estado: 'completado', created_at: '' },
    ]);
    const { result } = renderHook(() => useMiSemanaCatalogos(), { wrapper: wrapWithQueryClient() });

    await waitFor(() => expect(result.current.proyectosActivos).toHaveLength(1));
    expect(result.current.proyectosActivos[0]!.id).toBe('p1');
  });

  it('areasPorId indexa el catálogo de áreas por id', async () => {
    setWorkspaceConModulos(['areas']);
    mockGetAreas.mockResolvedValue([{ id: 'a1', workspace_id: 'ws-1', nombre: 'Sistemas', activo: true, created_at: '' }]);
    const { result } = renderHook(() => useMiSemanaCatalogos(), { wrapper: wrapWithQueryClient() });

    await waitFor(() => expect(result.current.areasPorId.get('a1')).toBe('Sistemas'));
  });
});
