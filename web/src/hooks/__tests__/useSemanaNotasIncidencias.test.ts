/**
 * src/hooks/__tests__/useSemanaNotasIncidencias.test.ts
 *
 * Notas de bitácora e incidencias en Mi Semana. Caso de mayor riesgo
 * silencioso: crearIncidenciaHoy solo notifica a los jefes cuando el actor
 * NO es jefe (si un jefe crea una incidencia, no debe auto-notificarse).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSemanaNotasIncidencias } from '@/hooks/useSemanaNotasIncidencias';
import { wrapWithQueryClient } from '@/test/helpers';
import { makeJefe, makeUsuario } from '@/test/helpers';
import { useWorkspaceStore } from '@/store/workspaceStore';

const mockGetIncidenciasDelDia = vi.fn().mockResolvedValue([]);
const mockGetNotasBitacoraRecientes = vi.fn().mockResolvedValue([]);
const mockCrearIncidencia = vi.fn();
const mockInsertarNotaBitacoraRapida = vi.fn();
const mockPublicarEventoEquipo = vi.fn().mockResolvedValue(undefined);
const mockGetJefesActivosParaNotificacion = vi.fn().mockResolvedValue([{ id: 'jefe-1' }]);
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock('@/api/hoyColumnas', () => ({
  getIncidenciasDelDia: (...a: unknown[]) => mockGetIncidenciasDelDia(...a),
  getNotasBitacoraRecientes: (...a: unknown[]) => mockGetNotasBitacoraRecientes(...a),
  crearIncidencia: (...a: unknown[]) => mockCrearIncidencia(...a),
  insertarNotaBitacoraRapida: (...a: unknown[]) => mockInsertarNotaBitacoraRapida(...a),
  convertirNotaEnTarea: vi.fn(),
  convertirNotaEnEvento: vi.fn(),
}));

vi.mock('@/api/usuarios', () => ({
  getJefesActivosParaNotificacion: () => mockGetJefesActivosParaNotificacion(),
}));

vi.mock('@/lib/realtimePublish', () => ({
  publicarEventoEquipo: (...a: unknown[]) => mockPublicarEventoEquipo(...a),
}));

vi.mock('sonner', () => ({
  toast: { success: (...a: unknown[]) => mockToastSuccess(...a), error: (...a: unknown[]) => mockToastError(...a) },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockGetIncidenciasDelDia.mockResolvedValue([]);
  mockGetNotasBitacoraRecientes.mockResolvedValue([]);
  mockGetJefesActivosParaNotificacion.mockResolvedValue([{ id: 'jefe-1' }]);
  useWorkspaceStore.setState({ workspaceActivo: { id: 'ws-1', organizacion_id: 'o1', nombre: 'WS', activo: true } });
});

describe('crearIncidenciaHoy', () => {
  it('miembro (no jefe): notifica a los jefes activos vía realtime', async () => {
    mockCrearIncidencia.mockResolvedValue({ id: 't1', titulo: 'Falla de red' });
    const usuario = makeUsuario();
    const { result } = renderHook(
      () => useSemanaNotasIncidencias({ uid: usuario.id, esJefe: false, hoyYmd: '2026-04-29', usuario }),
      { wrapper: wrapWithQueryClient() },
    );
    await waitFor(() => expect(result.current.jefesNotificacion).toHaveLength(1));

    await act(async () => {
      await result.current.crearIncidenciaHoy({ titulo: 'Falla de red', prioridad: 'alta', ya_resuelta: false });
    });

    await waitFor(() => expect(mockPublicarEventoEquipo).toHaveBeenCalledWith(expect.objectContaining({
      tipo: 'incidencia_registrada', jefeId: 'jefe-1', titulo: 'Falla de red',
    })));
  });

  it('jefe: NO se auto-notifica al crear su propia incidencia', async () => {
    mockCrearIncidencia.mockResolvedValue({ id: 't1', titulo: 'Falla de red' });
    const jefe = makeJefe();
    const { result } = renderHook(
      () => useSemanaNotasIncidencias({ uid: jefe.id, esJefe: true, hoyYmd: '2026-04-29', usuario: jefe }),
      { wrapper: wrapWithQueryClient() },
    );

    await act(async () => {
      await result.current.crearIncidenciaHoy({ titulo: 'Falla de red', prioridad: 'alta', ya_resuelta: false });
    });

    expect(mockPublicarEventoEquipo).not.toHaveBeenCalled();
  });

  it('usa hoyYmd como fecha por defecto si no se indica fecha_planificada', async () => {
    mockCrearIncidencia.mockResolvedValue({ id: 't1', titulo: 'X' });
    const usuario = makeUsuario();
    const { result } = renderHook(
      () => useSemanaNotasIncidencias({ uid: usuario.id, esJefe: false, hoyYmd: '2026-04-29', usuario }),
      { wrapper: wrapWithQueryClient() },
    );

    await act(async () => {
      await result.current.crearIncidenciaHoy({ titulo: 'X', prioridad: 'media', ya_resuelta: true });
    });

    expect(mockCrearIncidencia).toHaveBeenCalledWith(expect.objectContaining({ fecha_planificada: '2026-04-29' }));
  });
});

describe('guardarNotaRapida', () => {
  it('nota en blanco (solo espacios) no llama a la API', async () => {
    const usuario = makeUsuario();
    const { result } = renderHook(
      () => useSemanaNotasIncidencias({ uid: usuario.id, esJefe: false, hoyYmd: '2026-04-29', usuario }),
      { wrapper: wrapWithQueryClient() },
    );
    act(() => { result.current.setNotaRapida('   '); });

    await act(async () => { await result.current.guardarNotaRapida(); });

    expect(mockInsertarNotaBitacoraRapida).not.toHaveBeenCalled();
  });

  it('con contenido válido, guarda y limpia el campo', async () => {
    mockInsertarNotaBitacoraRapida.mockResolvedValue({ id: 'n1' });
    const usuario = makeUsuario();
    const { result } = renderHook(
      () => useSemanaNotasIncidencias({ uid: usuario.id, esJefe: false, hoyYmd: '2026-04-29', usuario }),
      { wrapper: wrapWithQueryClient() },
    );
    act(() => { result.current.setNotaRapida('  Recordar backup  '); });

    await act(async () => { await result.current.guardarNotaRapida(); });

    expect(mockInsertarNotaBitacoraRapida).toHaveBeenCalledWith(expect.objectContaining({ contenido: 'Recordar backup' }));
    expect(result.current.notaRapida).toBe('');
  });
});
