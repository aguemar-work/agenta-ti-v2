/**
 * src/hooks/__tests__/useObjetivosPage.test.ts
 *
 * puedeEliminar/puedeCompletar son las reglas de permisos del módulo de
 * objetivos: quién puede borrar (jefe o el creador) y quién puede completar
 * (jefe siempre; el responsable solo si el objetivo ya llegó al 100%).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useObjetivosPage } from '@/hooks/useObjetivosPage';
import { wrapWithQueryClient } from '@/test/helpers';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { setRolActivoTest } from '@/test/helpers';

const mockGetObjetivosConProgreso = vi.fn();
const mockGetUsuariosActivosParaAsignacion = vi.fn().mockResolvedValue([]);

vi.mock('@/api/objetivosMetricas', () => ({ getObjetivosConProgreso: () => mockGetObjetivosConProgreso() }));
vi.mock('@/api/usuarios', () => ({ getUsuariosActivosParaAsignacion: () => mockGetUsuariosActivosParaAsignacion() }));
vi.mock('@/api/objetivos', () => ({
  crearObjetivo: vi.fn(), completarObjetivo: vi.fn(), eliminarObjetivo: vi.fn(),
  getOTsPorObjetivo: vi.fn().mockResolvedValue([]), getTareasPorObjetivo: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/api/semana', () => ({ crearTareaPlanificada: vi.fn() }));

const JEFE = { id: 'jefe-1', nombre: 'Ana', email: 'a@x.com', rol: 'jefe' as const, activo: true, created_at: '', updated_at: '' };
const MIEMBRO = { ...JEFE, id: 'miembro-1', rol: 'miembro' as const };

function obj(overrides: Record<string, unknown> = {}) {
  return {
    id: 'obj-1', titulo: 'Meta', descripcion: null, fecha_limite: null,
    estado: 'activo', creado_por: 'miembro-1', responsable_id: 'miembro-1',
    created_at: '', updated_at: '', total_tareas: 4, completadas: 2, pct: 50,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUsuariosActivosParaAsignacion.mockResolvedValue([]);
  useWorkspaceStore.setState({ workspaceActivo: { id: 'ws-1', organizacion_id: 'o1', nombre: 'WS', activo: true } });
});

describe('puedeEliminar', () => {
  it('el jefe puede eliminar cualquier objetivo', async () => {
    useAuthStore.setState({ usuario: JEFE });
    setRolActivoTest('jefe');
    mockGetObjetivosConProgreso.mockResolvedValue([obj({ creado_por: 'otro-usuario' })]);
    const { result } = renderHook(() => useObjetivosPage(), { wrapper: wrapWithQueryClient() });
    await waitFor(() => expect(result.current.objetivos).toHaveLength(1));

    expect(result.current.puedeEliminar('obj-1')).toBe(true);
  });

  it('un miembro solo puede eliminar el objetivo que él mismo creó', async () => {
    useAuthStore.setState({ usuario: MIEMBRO });
    setRolActivoTest('miembro');
    mockGetObjetivosConProgreso.mockResolvedValue([obj({ creado_por: 'otro-usuario' })]);
    const { result } = renderHook(() => useObjetivosPage(), { wrapper: wrapWithQueryClient() });
    await waitFor(() => expect(result.current.objetivos).toHaveLength(1));

    expect(result.current.puedeEliminar('obj-1')).toBe(false);
  });
});

describe('puedeCompletar', () => {
  it('el jefe puede completar un objetivo activo aunque no esté al 100%', async () => {
    useAuthStore.setState({ usuario: JEFE });
    setRolActivoTest('jefe');
    mockGetObjetivosConProgreso.mockResolvedValue([obj({ pct: 50 })]);
    const { result } = renderHook(() => useObjetivosPage(), { wrapper: wrapWithQueryClient() });
    await waitFor(() => expect(result.current.objetivos).toHaveLength(1));

    expect(result.current.puedeCompletar('obj-1')).toBe(true);
  });

  it('el responsable NO puede completar si el objetivo no llegó al 100%', async () => {
    useAuthStore.setState({ usuario: MIEMBRO });
    setRolActivoTest('miembro');
    mockGetObjetivosConProgreso.mockResolvedValue([obj({ responsable_id: 'miembro-1', pct: 80 })]);
    const { result } = renderHook(() => useObjetivosPage(), { wrapper: wrapWithQueryClient() });
    await waitFor(() => expect(result.current.objetivos).toHaveLength(1));

    expect(result.current.puedeCompletar('obj-1')).toBe(false);
  });

  it('el responsable SÍ puede completar al llegar al 100%', async () => {
    useAuthStore.setState({ usuario: MIEMBRO });
    setRolActivoTest('miembro');
    mockGetObjetivosConProgreso.mockResolvedValue([obj({ responsable_id: 'miembro-1', pct: 100 })]);
    const { result } = renderHook(() => useObjetivosPage(), { wrapper: wrapWithQueryClient() });
    await waitFor(() => expect(result.current.objetivos).toHaveLength(1));

    expect(result.current.puedeCompletar('obj-1')).toBe(true);
  });

  it('objetivo ya completado no se puede volver a completar', async () => {
    useAuthStore.setState({ usuario: JEFE });
    setRolActivoTest('jefe');
    mockGetObjetivosConProgreso.mockResolvedValue([obj({ estado: 'completado', pct: 100 })]);
    const { result } = renderHook(() => useObjetivosPage(), { wrapper: wrapWithQueryClient() });
    await waitFor(() => expect(result.current.objetivos).toHaveLength(1));

    expect(result.current.puedeCompletar('obj-1')).toBe(false);
  });
});
