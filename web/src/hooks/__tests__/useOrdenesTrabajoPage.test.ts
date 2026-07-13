/**
 * src/hooks/__tests__/useOrdenesTrabajoPage.test.ts
 *
 * Orquestador de Órdenes de Trabajo. useOrdenesTrabajoQueries/useOTTiposTrabajo/
 * useOTAcciones ya tienen su propia suite — se mockean aquí. Foco en la lógica
 * propia: el filtrado por estado (ordenesFiltradas) y el resumen ejecutivo
 * (resumenOT), incluida la regla de "urgente" (excluye completada/cancelada/
 * rechazada) y "vencida" (delegada a otVencida).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { useOrdenesTrabajoPage } from '@/hooks/useOrdenesTrabajoPage';
import { useAuthStore } from '@/store/authStore';
import { setRolActivoTest } from '@/test/helpers';

let ordenesMock: unknown[] = [];

vi.mock('@/hooks/useOrdenesTrabajoQueries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useOrdenesTrabajoQueries')>();
  return {
    ...actual,
    useOrdenesTrabajoQueries: () => ({
      ordenes: ordenesMock, isLoading: false, isError: false,
      tiposTrabajo: [], tareasVinculables: [], borradorServidor: undefined, borradorCargando: false,
    }),
  };
});

vi.mock('@/hooks/useOTTiposTrabajo', () => ({
  useOTTiposTrabajo: () => ({
    tiposActivos: [], tiposInactivos: [], nuevoTipoNombre: '', setNuevoTipoNombre: vi.fn(),
    canCrearTipo: false, mutCrearTipo: {}, mutToggleTipo: {},
  }),
}));

vi.mock('@/hooks/useOTAcciones', () => ({
  useOTAcciones: () => ({
    modalCompletar: null, setModalCompletar: vi.fn(), modalRechazar: null, setModalRechazar: vi.fn(),
    motivoRechazo: '', setMotivoRechazo: vi.fn(), receptorNombre: '', setReceptorNombre: vi.fn(),
    receptorDni: '', setReceptorDni: vi.fn(), receptorCargo: '', setReceptorCargo: vi.fn(),
    obsCierre: '', setObsCierre: vi.fn(), canCompletar: false,
    mutAprobar: {}, mutRechazar: {}, mutCompletar: {}, mutCancelar: {},
  }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(MemoryRouter, null, createElement(QueryClientProvider, { client: qc }, children));
}

function ot(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ot-1', numero: 'OT-TI-0001', creado_por: 'u1', tipo_trabajo_id: null, tarea_id: null,
    objetivo_id: null, estado: 'pendiente', prioridad: 'normal', descripcion: '', area_destino: '',
    ubicacion: null, modalidad: 'presencial', fecha_estimada: '2026-04-30', hora_inicio_est: null,
    duracion_est_min: null, equipos_materiales: null, observaciones: null, aprobado_por: null,
    fecha_aprobacion: null, motivo_rechazo: null, fecha_inicio_real: null, fecha_fin_real: null,
    observaciones_cierre: null, receptor_nombre: null, receptor_dni: null, receptor_cargo: null,
    created_at: '', updated_at: '',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  ordenesMock = [];
  useAuthStore.setState({ usuario: { id: 'u1', nombre: 'Ana', email: 'a@x.com', rol: 'jefe', activo: true, created_at: '', updated_at: '' } });
  setRolActivoTest('jefe');
});

describe('ordenesFiltradas', () => {
  it('"activas" incluye borrador/pendiente/aprobada, excluye el resto', () => {
    ordenesMock = [
      ot({ id: '1', estado: 'borrador' }), ot({ id: '2', estado: 'pendiente' }),
      ot({ id: '3', estado: 'aprobada' }), ot({ id: '4', estado: 'completada' }),
    ];
    const { result } = renderHook(() => useOrdenesTrabajoPage(), {
      wrapper: ({ children }) => wrapper({ children }),
    });

    act(() => { result.current.setFiltroEstado('activas'); });

    expect(result.current.ordenes.map((o) => o.id)).toEqual(['1', '2', '3']);
  });

  it('"urgentes" excluye urgentes ya completadas/canceladas/rechazadas', () => {
    ordenesMock = [
      ot({ id: '1', prioridad: 'urgente', estado: 'pendiente' }),
      ot({ id: '2', prioridad: 'urgente', estado: 'completada' }),
      ot({ id: '3', prioridad: 'normal', estado: 'pendiente' }),
    ];
    const { result } = renderHook(() => useOrdenesTrabajoPage(), { wrapper });

    act(() => { result.current.setFiltroEstado('urgentes'); });

    expect(result.current.ordenes.map((o) => o.id)).toEqual(['1']);
  });

  it('filtro por estado exacto (p. ej. "rechazada")', () => {
    ordenesMock = [ot({ id: '1', estado: 'rechazada' }), ot({ id: '2', estado: 'pendiente' })];
    const { result } = renderHook(() => useOrdenesTrabajoPage(), { wrapper });

    act(() => { result.current.setFiltroEstado('rechazada'); });

    expect(result.current.ordenes.map((o) => o.id)).toEqual(['1']);
  });
});

describe('resumenOT', () => {
  it('agrega activas/urgentes/pendientes correctamente', () => {
    ordenesMock = [
      ot({ id: '1', estado: 'pendiente', prioridad: 'urgente' }),
      ot({ id: '2', estado: 'borrador' }),
      ot({ id: '3', estado: 'completada' }),
    ];

    const { result } = renderHook(() => useOrdenesTrabajoPage(), { wrapper });

    expect(result.current.resumenOT.activas).toBe(2); // pendiente + borrador
    expect(result.current.resumenOT.urgentes).toBe(1);
    expect(result.current.resumenOT.pendientes).toBe(1);
    expect(result.current.pendientesCount).toBe(1);
  });
});

describe('abrirNuevaOT / abrirEditarOT', () => {
  it('abrirNuevaOT limpia editandoOT y abre el modal', () => {
    const { result } = renderHook(() => useOrdenesTrabajoPage(), { wrapper });

    act(() => { result.current.abrirNuevaOT(); });

    expect(result.current.modalForm).toBe(true);
    expect(result.current.editandoOT).toBeNull();
  });

  it('abrirEditarOT precarga el form con los datos de la OT', () => {
    const { result } = renderHook(() => useOrdenesTrabajoPage(), { wrapper });
    const orden = ot({ descripcion: 'Reparar switch' });

    act(() => { result.current.abrirEditarOT(orden); });

    expect(result.current.modalForm).toBe(true);
    expect(result.current.editandoOT).toEqual(orden);
    expect(result.current.form.descripcion).toBe('Reparar switch');
  });
});
