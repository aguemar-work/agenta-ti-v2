/**
 * src/hooks/__tests__/useMetricasPage.test.ts
 *
 * miembroFiltro es la pieza más sutil: el jefe puede filtrar por cualquier
 * miembro (o ver el total del equipo si no elige), pero un miembro SIEMPRE
 * ve solo sus propias métricas, sin importar qué traiga el query string.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { useMetricasPage } from '@/hooks/useMetricasPage';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';

const mockGetKpisRangoYSemana = vi.fn();
const mockGetKpisComparativa = vi.fn();
const mockGetObjetivosConProgreso = vi.fn();
const mockGetOtEstadoCounts = vi.fn();
const mockGetUsuariosActivosParaAsignacion = vi.fn();

vi.mock('@/api/objetivosMetricas', () => ({
  getKpisRangoYSemana: (...a: unknown[]) => mockGetKpisRangoYSemana(...a),
  getKpisComparativa: (...a: unknown[]) => mockGetKpisComparativa(...a),
  getObjetivosConProgreso: () => mockGetObjetivosConProgreso(),
  getKpisUsuario: vi.fn(),
}));
vi.mock('@/api/metricas', () => ({ getOtEstadoCounts: (...a: unknown[]) => mockGetOtEstadoCounts(...a) }));
vi.mock('@/api/usuarios', () => ({ getUsuariosActivosParaAsignacion: () => mockGetUsuariosActivosParaAsignacion() }));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(MemoryRouter, null, createElement(QueryClientProvider, { client: qc }, children));
}

const JEFE = { id: 'jefe-1', nombre: 'Ana', email: 'a@x.com', rol: 'jefe' as const, activo: true, created_at: '', updated_at: '' };
const MIEMBRO = { ...JEFE, id: 'miembro-1', rol: 'miembro' as const };

beforeEach(() => {
  vi.clearAllMocks();
  useWorkspaceStore.setState({ rolActivo: null, workspaceActivo: { id: 'ws-1', organizacion_id: 'o1', nombre: 'WS', activo: true } });
  mockGetKpisRangoYSemana.mockResolvedValue({ kpis: { total: 0, completadas: 0, en_progreso: 0, pendientes: 0, atrasadas: 0, reprogramadas: 0, incidencias: 0 }, porSemana: [] });
  mockGetKpisComparativa.mockResolvedValue([]);
  mockGetObjetivosConProgreso.mockResolvedValue([]);
  mockGetOtEstadoCounts.mockResolvedValue({});
  mockGetUsuariosActivosParaAsignacion.mockResolvedValue([]);
});

describe('useMetricasPage', () => {
  it('miembro (no jefe): siempre filtra por su propio id, ignorando filtros.m', async () => {
    useAuthStore.setState({ usuario: MIEMBRO });
    useWorkspaceStore.setState({ rolActivo: 'miembro' });

    renderHook(() => useMetricasPage(), { wrapper });

    await waitFor(() => expect(mockGetKpisRangoYSemana).toHaveBeenCalledWith(
      expect.any(String), expect.any(String), 'miembro-1',
    ));
  });

  it('jefe sin filtro de miembro: consulta el total del equipo (uid=undefined)', async () => {
    useAuthStore.setState({ usuario: JEFE });
    useWorkspaceStore.setState({ rolActivo: 'jefe' });

    renderHook(() => useMetricasPage(), { wrapper });

    await waitFor(() => expect(mockGetKpisRangoYSemana).toHaveBeenCalledWith(
      expect.any(String), expect.any(String), undefined,
    ));
  });

  it('cumplimiento es null mientras no hay kpis cargados', () => {
    useAuthStore.setState({ usuario: JEFE });
    useWorkspaceStore.setState({ rolActivo: 'jefe' });

    const { result } = renderHook(() => useMetricasPage(), { wrapper });

    expect(result.current.cumplimiento).toBeNull();
  });

  it('miembrosBajoRendimiento cuenta solo miembros con cumplimiento < 50% (y con al menos 1 tarea)', async () => {
    useAuthStore.setState({ usuario: JEFE });
    useWorkspaceStore.setState({ rolActivo: 'jefe' });
    mockGetKpisComparativa.mockResolvedValue([
      { usuarioId: 'a', nombre: 'A', completadas: 1, atrasadas: 9, reprogramadas: 0 }, // 10%, bajo
      { usuarioId: 'b', nombre: 'B', completadas: 9, atrasadas: 1, reprogramadas: 0 }, // 90%, ok
      { usuarioId: 'c', nombre: 'C', completadas: 0, atrasadas: 0, reprogramadas: 0 }, // sin tareas, no cuenta
    ]);

    const { result } = renderHook(() => useMetricasPage(), { wrapper });

    await waitFor(() => expect(result.current.comparativa).toHaveLength(3));
    expect(result.current.subtitulo).toContain('1 miembro con cumplimiento bajo');
  });
});
