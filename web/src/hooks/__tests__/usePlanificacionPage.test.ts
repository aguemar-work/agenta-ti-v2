/**
 * src/hooks/__tests__/usePlanificacionPage.test.ts
 *
 * Cubre las agregaciones derivadas (cuenta/totalDiaEquipo/conteoEstadosDia/
 * resumenAlertas) — son cómputo puro sobre los datos ya cargados, y el lugar
 * donde un error de categorización de "atrasada" pasaría desapercibido (solo
 * se vería como un número equivocado en el resumen ejecutivo del jefe).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { usePlanificacionPage } from '@/hooks/usePlanificacionPage';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';

const mockGetMiembrosActivos = vi.fn();
const mockGetCargaEquipoSemana = vi.fn();
const mockGetOTsPendientesIds = vi.fn();
const mockGetIncidenciasEquipoSemana = vi.fn();
const mockGetActividadEquipoSemana = vi.fn();
const mockGetJustificacionesPendientesJefe = vi.fn();
const mockGetObjetivosActivos = vi.fn();
const mockGetUsuariosActivosParaAsignacion = vi.fn();

vi.mock('@/api/planificacion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/planificacion')>();
  return {
    ...actual,
    getMiembrosActivos: () => mockGetMiembrosActivos(),
    getCargaEquipoSemana: () => mockGetCargaEquipoSemana(),
    getOTsPendientesIds: () => mockGetOTsPendientesIds(),
    getIncidenciasEquipoSemana: () => mockGetIncidenciasEquipoSemana(),
    getTareasUsuarioDia: vi.fn().mockResolvedValue([]),
  };
});
vi.mock('@/api/audit', () => ({
  getActividadEquipoSemana: () => mockGetActividadEquipoSemana(),
  getJustificacionesPendientesJefe: () => mockGetJustificacionesPendientesJefe(),
  getHistorialLogs: vi.fn().mockResolvedValue({ logs: [], total: 0 }),
  aceptarJustificacionJefe: vi.fn(),
  devolverJustificacionJefe: vi.fn(),
}));
vi.mock('@/api/semana', () => ({ crearTareaPlanificada: vi.fn(), reprogramarTareaConLog: vi.fn() }));
vi.mock('@/api/objetivos', () => ({ getObjetivosActivos: () => mockGetObjetivosActivos() }));
vi.mock('@/api/usuarios', () => ({ getUsuariosActivosParaAsignacion: () => mockGetUsuariosActivosParaAsignacion() }));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: qc }, children);
}

// fecha_planificada lejos en el futuro: estadoEfectivoTablero calcula la
// situación con la fecha REAL del sistema (Date.now()), no una fija de test —
// si quedara en el pasado, el fallback la marcaría "atrasada" sin importar
// el `estado` que el test quiera simular.
function tarea(overrides: Record<string, unknown> = {}) {
  return {
    estado: 'pendiente', tipo: 'planificada', fecha_planificada: '2099-01-01',
    situacion: null, reprogramaciones: 0, asignado_a: 'u1',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ usuario: { id: 'jefe-1', nombre: 'Ana', email: 'a@x.com', rol: 'jefe', activo: true, created_at: '', updated_at: '' } });
  useWorkspaceStore.setState({ workspaceActivo: { id: 'ws-1', organizacion_id: 'o1', nombre: 'WS', activo: true } });
  mockGetMiembrosActivos.mockResolvedValue([{ id: 'u1', nombre: 'Kevin', email: 'k@x.com' }, { id: 'u2', nombre: 'Ana', email: 'a2@x.com' }]);
  mockGetCargaEquipoSemana.mockResolvedValue([]);
  mockGetOTsPendientesIds.mockResolvedValue([]);
  mockGetIncidenciasEquipoSemana.mockResolvedValue([]);
  mockGetActividadEquipoSemana.mockResolvedValue([]);
  mockGetJustificacionesPendientesJefe.mockResolvedValue([]);
  mockGetObjetivosActivos.mockResolvedValue([]);
  mockGetUsuariosActivosParaAsignacion.mockResolvedValue([]);
});

describe('cuenta / totalDiaEquipo', () => {
  it('cuenta solo tareas activas (no completadas/canceladas) del miembro y día indicados', async () => {
    mockGetCargaEquipoSemana.mockResolvedValue([
      tarea({ asignado_a: 'u1', fecha_planificada: '2026-04-29', estado: 'pendiente' }),
      tarea({ asignado_a: 'u1', fecha_planificada: '2026-04-29', estado: 'completada' }), // no cuenta
      tarea({ asignado_a: 'u1', fecha_planificada: '2026-04-30', estado: 'pendiente' }),  // otro día
      tarea({ asignado_a: 'u2', fecha_planificada: '2026-04-29', estado: 'en_progreso' }),
    ]);
    const { result } = renderHook(() => usePlanificacionPage(), { wrapper });
    await waitFor(() => expect(result.current.carga).toHaveLength(4));

    expect(result.current.cuenta('u1', '2026-04-29')).toBe(1);
    expect(result.current.totalDiaEquipo('2026-04-29')).toBe(2); // u1 (1) + u2 (1)
  });
});

describe('conteoEstadosDia / conteoEstadosDiaMiembro', () => {
  it('agrupa por estado efectivo (situacion=atrasada prevalece sobre estado persistido)', async () => {
    // fecha_planificada en el futuro para el filtro por día, para no disparar
    // el fallback cliente de "atrasada" (que usa la fecha real del sistema).
    const DIA = '2099-01-01';
    mockGetCargaEquipoSemana.mockResolvedValue([
      tarea({ asignado_a: 'u1', fecha_planificada: DIA, situacion: 'atrasada' }),
      tarea({ asignado_a: 'u1', fecha_planificada: DIA, estado: 'en_progreso' }),
      tarea({ asignado_a: 'u2', fecha_planificada: DIA, estado: 'pendiente' }),
    ]);
    const { result } = renderHook(() => usePlanificacionPage(), { wrapper });
    await waitFor(() => expect(result.current.carga).toHaveLength(3));

    expect(result.current.conteoEstadosDia(DIA)).toEqual({ atrasada: 1, en_progreso: 1, pendiente: 1 });
    expect(result.current.conteoEstadosDiaMiembro('u1', DIA)).toEqual({ atrasada: 1, en_progreso: 1 });
  });
});

describe('resumenAlertas', () => {
  it('agrega atrasadas de la carga + OTs pendientes + incidencias + justificaciones pendientes', async () => {
    mockGetCargaEquipoSemana.mockResolvedValue([
      tarea({ situacion: 'atrasada' }),
      tarea({ situacion: 'atrasada' }),
      tarea({ estado: 'pendiente' }),
    ]);
    mockGetOTsPendientesIds.mockResolvedValue([{ id: 'ot1' }]);
    mockGetIncidenciasEquipoSemana.mockResolvedValue([tarea({ es_imprevisto: true })]);
    mockGetJustificacionesPendientesJefe.mockResolvedValue([{ id: 'log1' }]);

    const { result } = renderHook(() => usePlanificacionPage(), { wrapper });

    await waitFor(() => expect(result.current.resumenAlertas).toEqual({
      atrasadas: 2, otsPendientes: 1, incidenciasActivas: 1, justificacionesPendientes: 1,
    }));
  });
});
