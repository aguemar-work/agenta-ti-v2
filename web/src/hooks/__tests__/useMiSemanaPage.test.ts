/**
 * src/hooks/__tests__/useMiSemanaPage.test.ts
 *
 * Orquestador de Mi Semana. Los sub-hooks (useMiSemanaData, useSemanaModales,
 * useSemanaNotasIncidencias, etc.) ya tienen su propia suite — aquí se mockean
 * directamente y se cubre solo la lógica propia de este hook: los conteos
 * agregados (conteos/resumenDia) y los guards de generarOtDesdeTarea (no debe
 * poder generarse una OT para una tarea imprevista, ya completada/cancelada,
 * o si ya existe una OT vinculada — en ese caso redirige en vez de duplicar).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { useMiSemanaPage } from '@/hooks/useMiSemanaPage';
import { makeUsuario, setRolActivoTest } from '@/test/helpers';
import { useWorkspaceStore } from '@/store/workspaceStore';

const mockNavigate = vi.fn();
const mockGetIncidenciasRangoUsuario = vi.fn().mockResolvedValue([]);
const mockGetOrdenesPorTareaIds = vi.fn().mockResolvedValue(new Map());
const mockCrearOtDesdeTarea = vi.fn();

const USUARIO = makeUsuario({ id: 'u1' });

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/hooks/useSemanaNavegacion', () => ({
  useSemanaNavegacion: () => ({
    usuario: USUARIO, esJefe: false,
    lunes: new Date('2026-04-27'), setLunes: vi.fn(), sabado: new Date('2026-05-02'),
    diasSemana: [], semanaISO: '202618', hoyYmd: '2026-04-29',
    uid: 'u1', seleccionId: null, setSeleccionId: vi.fn(),
    usuariosJefe: [], usuariosAsignables: [], objetivosActivos: [],
    esBannerViernes: false,
  }),
}));

vi.mock('@/hooks/useMiSemanaCatalogos', () => ({
  useMiSemanaCatalogos: () => ({ clientesCatalogo: [], proyectosActivos: [], areasCatalogo: [], areasPorId: new Map(), moduloClientes: false, moduloProyectos: false, moduloAreas: false }),
}));

vi.mock('@/hooks/useTareas', () => ({
  useMarcarAtrasadasAlMontar: vi.fn(),
}));

let tareasPlanMock: unknown[] = [];
vi.mock('@/hooks/useMiSemana', () => ({
  useMiSemanaData: () => ({ tareasPlan: tareasPlanMock, eventos: [], isLoading: false, isError: false }),
  useMiSemanaMutations: () => ({
    crearPlan: vi.fn(), moverDia: vi.fn(), moverEntre: vi.fn(), editarTarea: vi.fn(),
    eliminarTarea: vi.fn(), cancelarTarea: vi.fn(), completarTareaConResumen: vi.fn(),
    iniciarTarea: vi.fn(), crearEvento: vi.fn(), actualizarEvento: vi.fn(), eliminarEvento: vi.fn(),
    isPending: false, completarPendingId: null, iniciarPendingId: null, eliminarPendingId: null, cancelarPendingId: null,
  }),
}));

vi.mock('@/hooks/useSemanaNotasIncidencias', () => ({
  useSemanaNotasIncidencias: () => ({
    incidenciasHoy: [], notasHoy: [], jefesNotificacion: [],
    modalInc: false, setModalInc: vi.fn(), notaRapida: '', setNotaRapida: vi.fn(),
    notaConvertir: null, setNotaConvertir: vi.fn(),
    crearIncidenciaHoy: vi.fn(), guardarNotaRapida: vi.fn(),
    confirmarConvertirNotaTarea: vi.fn(), confirmarConvertirNotaEvento: vi.fn(),
  }),
}));

vi.mock('@/hooks/useSemanaModales', () => ({
  useSemanaModales: () => ({
    modal: null, setModal: vi.fn(), modalInc: false, setModalInc: vi.fn(),
    detalleTareaId: null, setDetalleTareaId: vi.fn(),
    completarTareaId: null, setCompletarTareaId: vi.fn(),
    reprDetalleTarea: null, setReprDetalleTarea: vi.fn(),
    tareaDetalle: null, tareaCompletar: null,
    confirmarReprDetalle: vi.fn(), confirmarCompletar: vi.fn(),
    crearTareaDesdeModal: vi.fn(), crearEventoDesdeModal: vi.fn(),
    guardarDetalle: vi.fn(), eliminarDesdeDetalle: vi.fn(), cancelarDesdeDetalle: vi.fn(),
    iniciarDesdeDetalle: vi.fn(), moverTareaADia: vi.fn(),
  }),
}));

vi.mock('@/api/ordenTrabajo', () => ({
  getOrdenesPorTareaIds: (ids: string[]) => mockGetOrdenesPorTareaIds(ids),
  crearOtDesdeTarea: (input: unknown) => mockCrearOtDesdeTarea(input),
}));

vi.mock('@/api/hoyColumnas', () => ({
  getIncidenciasRangoUsuario: (...a: unknown[]) => mockGetIncidenciasRangoUsuario(...a),
}));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(MemoryRouter, null, createElement(QueryClientProvider, { client: qc }, children));
}

function tarea(overrides: Record<string, unknown> = {}) {
  return {
    id: 't1', estado: 'pendiente', tipo: 'planificada', fecha_planificada: '2099-01-01',
    situacion: null, reprogramaciones: 0, es_imprevisto: false, asignado_a: USUARIO.id,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  tareasPlanMock = [];
  mockGetOrdenesPorTareaIds.mockResolvedValue(new Map());
  mockGetIncidenciasRangoUsuario.mockResolvedValue([]);
  useWorkspaceStore.setState({ workspaceActivo: { id: 'ws-1', organizacion_id: 'o1', nombre: 'WS', activo: true } });
  setRolActivoTest('miembro');
});

describe('conteos', () => {
  it('cuenta las tareas por estado efectivo', () => {
    tareasPlanMock = [
      tarea({ id: '1', estado: 'pendiente' }),
      tarea({ id: '2', estado: 'pendiente' }),
      tarea({ id: '3', estado: 'en_progreso' }),
      tarea({ id: '4', estado: 'completada' }),
    ];

    const { result } = renderHook(() => useMiSemanaPage(), { wrapper });

    expect(result.current.conteos).toEqual({ pendiente: 2, en_progreso: 1, atrasada: 0, reprogramada: 0, completada: 1 });
  });
});

describe('resumenDia', () => {
  it('pendientesHoy solo cuenta pendientes del día de hoy; atrasadas cuenta todas sin importar el día', () => {
    tareasPlanMock = [
      tarea({ id: '1', estado: 'pendiente', fecha_planificada: '2026-04-29' }), // hoy, pendiente
      tarea({ id: '2', estado: 'pendiente', fecha_planificada: '2099-01-01' }), // otro día
      tarea({ id: '3', situacion: 'atrasada' }),
    ];

    const { result } = renderHook(() => useMiSemanaPage(), { wrapper });

    expect(result.current.resumenDia).toEqual({ pendientesHoy: 1, atrasadas: 1 });
  });
});

describe('generarOtDesdeTarea', () => {
  it('tarea imprevista: no genera OT ni navega', async () => {
    const { result } = renderHook(() => useMiSemanaPage(), { wrapper });

    await act(async () => { await result.current.generarOtDesdeTarea(tarea({ es_imprevisto: true })); });

    expect(mockCrearOtDesdeTarea).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('tarea completada: no genera OT', async () => {
    const { result } = renderHook(() => useMiSemanaPage(), { wrapper });

    await act(async () => { await result.current.generarOtDesdeTarea(tarea({ estado: 'completada' })); });

    expect(mockCrearOtDesdeTarea).not.toHaveBeenCalled();
  });

  it('ya existe una OT vinculada a la tarea: navega a verla en vez de crear una nueva', async () => {
    mockGetOrdenesPorTareaIds.mockResolvedValue(new Map([['t1', { id: 'ot-existente' }]]));
    tareasPlanMock = [tarea({ id: 't1' })];
    const { result } = renderHook(() => useMiSemanaPage(), { wrapper });
    await waitFor(() => expect(result.current.ordenesPorTarea.size).toBe(1));

    await act(async () => { await result.current.generarOtDesdeTarea(tarea({ id: 't1' })); });

    expect(mockCrearOtDesdeTarea).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/ordenes-trabajo', { state: { abrirOtId: 'ot-existente' } });
  });

  it('tarea elegible sin OT previa: crea la OT y navega a ella', async () => {
    mockCrearOtDesdeTarea.mockResolvedValue('nueva-ot-id');
    const { result } = renderHook(() => useMiSemanaPage(), { wrapper });

    await act(async () => { await result.current.generarOtDesdeTarea(tarea({ id: 't2' })); });

    expect(mockCrearOtDesdeTarea).toHaveBeenCalledWith(expect.objectContaining({ tareaId: 't2' }));
    expect(mockNavigate).toHaveBeenCalledWith('/ordenes-trabajo', { state: { abrirOtId: 'nueva-ot-id' } });
  });
});
