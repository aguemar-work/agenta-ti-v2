/**
 * src/hooks/__tests__/useAreasPage.test.ts
 * Catálogo de áreas: hasChanges (para confirmar cierre de modal), y que
 * submitForm elija crear vs. actualizar según editandoId.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAreasPage } from '@/hooks/useAreasPage';
import { wrapWithQueryClient } from '@/test/helpers';
import { useWorkspaceStore } from '@/store/workspaceStore';

const mockGetAreas = vi.fn();
const mockCrearArea = vi.fn();
const mockActualizarArea = vi.fn();
const mockDesactivarArea = vi.fn();

vi.mock('@/api/areas', () => ({
  Q_AREAS: 'areas',
  getAreas: () => mockGetAreas(),
  crearArea: (input: unknown) => mockCrearArea(input),
  actualizarArea: (input: unknown) => mockActualizarArea(input),
  desactivarArea: (id: string) => mockDesactivarArea(id),
}));

const AREA = { id: 'a1', workspace_id: 'ws-1', nombre: 'Sistemas', activo: true, created_at: '' };

beforeEach(() => {
  vi.clearAllMocks();
  useWorkspaceStore.setState({ workspaceActivo: { id: 'ws-1', organizacion_id: 'o1', nombre: 'WS', activo: true } });
  mockGetAreas.mockResolvedValue([AREA]);
});

describe('useAreasPage', () => {
  it('abrirEditar precarga el form con los datos del área y formInicial igual (hasChanges=false)', async () => {
    const { result } = renderHook(() => useAreasPage(), { wrapper: wrapWithQueryClient() });
    await waitFor(() => expect(result.current.areas).toHaveLength(1));

    act(() => { result.current.abrirEditar('a1'); });

    expect(result.current.form).toEqual({ nombre: 'Sistemas' });
    expect(result.current.hasChanges).toBe(false);
    expect(result.current.modalOpen).toBe(true);
  });

  it('editar el nombre activa hasChanges', async () => {
    const { result } = renderHook(() => useAreasPage(), { wrapper: wrapWithQueryClient() });
    await waitFor(() => expect(result.current.areas).toHaveLength(1));
    act(() => { result.current.abrirEditar('a1'); });

    act(() => { result.current.setForm({ nombre: 'Redes' }); });

    expect(result.current.hasChanges).toBe(true);
  });

  it('submitForm con editandoId llama a actualizar, no a crear', async () => {
    mockActualizarArea.mockResolvedValue(AREA);
    const { result } = renderHook(() => useAreasPage(), { wrapper: wrapWithQueryClient() });
    await waitFor(() => expect(result.current.areas).toHaveLength(1));
    act(() => { result.current.abrirEditar('a1'); result.current.setForm({ nombre: 'Redes' }); });

    act(() => { result.current.submitForm(); });

    await waitFor(() => expect(mockActualizarArea).toHaveBeenCalledWith({ id: 'a1', nombre: 'Redes' }));
    expect(mockCrearArea).not.toHaveBeenCalled();
  });

  it('submitForm sin editandoId (nuevo) llama a crear', async () => {
    mockCrearArea.mockResolvedValue(AREA);
    const { result } = renderHook(() => useAreasPage(), { wrapper: wrapWithQueryClient() });
    await waitFor(() => expect(result.current.areas).toHaveLength(1));
    act(() => { result.current.abrirNuevo(); result.current.setForm({ nombre: 'Redes' }); });

    act(() => { result.current.submitForm(); });

    await waitFor(() => expect(mockCrearArea).toHaveBeenCalledWith({ nombre: 'Redes' }));
  });

  it('submitForm con nombre vacío (solo espacios) no llama a nada', async () => {
    const { result } = renderHook(() => useAreasPage(), { wrapper: wrapWithQueryClient() });
    await waitFor(() => expect(result.current.areas).toHaveLength(1));
    act(() => { result.current.abrirNuevo(); result.current.setForm({ nombre: '   ' }); });

    act(() => { result.current.submitForm(); });

    expect(mockCrearArea).not.toHaveBeenCalled();
    expect(mockActualizarArea).not.toHaveBeenCalled();
  });

  it('confirmarDesactivar sin un id seleccionado, no llama al mutation', async () => {
    const { result } = renderHook(() => useAreasPage(), { wrapper: wrapWithQueryClient() });
    await waitFor(() => expect(result.current.areas).toHaveLength(1));

    act(() => { result.current.confirmarDesactivar(); });

    expect(mockDesactivarArea).not.toHaveBeenCalled();
  });
});
