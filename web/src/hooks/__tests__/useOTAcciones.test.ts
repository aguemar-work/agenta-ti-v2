/**
 * src/hooks/__tests__/useOTAcciones.test.ts
 *
 * Acciones de estado de OT (aprobar/rechazar/completar/cancelar) + estado de
 * los modales asociados. canCompletar delega en puedeCompletarOTReceptor
 * (nombre no vacío + DNI de 8 dígitos).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useOTAcciones } from '@/hooks/useOTAcciones';
import { wrapWithQueryClient } from '@/test/helpers';
import { makeJefe } from '@/test/helpers';

const mockAprobarOT = vi.fn();
const mockRechazarOT = vi.fn();
const mockCompletarOT = vi.fn();
const mockCancelarOrdenTrabajo = vi.fn();
const mockPublicarEventoUsuario = vi.fn().mockResolvedValue(undefined);

vi.mock('@/api/ordenTrabajo', () => ({
  aprobarOT: (...a: unknown[]) => mockAprobarOT(...a),
  rechazarOT: (...a: unknown[]) => mockRechazarOT(...a),
  completarOT: (...a: unknown[]) => mockCompletarOT(...a),
  cancelarOrdenTrabajo: (...a: unknown[]) => mockCancelarOrdenTrabajo(...a),
}));

vi.mock('@/lib/realtimePublish', () => ({
  publicarEventoUsuario: (...a: unknown[]) => mockPublicarEventoUsuario(...a),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const OT = {
  id: 'ot-1', numero: 'OT-TI-0001', creado_por: 'uuid-miembro',
} as unknown as Parameters<typeof useOTAcciones>[0]['ordenes'][number];

beforeEach(() => {
  vi.clearAllMocks();
  mockPublicarEventoUsuario.mockResolvedValue(undefined);
});

describe('useOTAcciones', () => {
  it('canCompletar exige nombre no vacío y DNI de exactamente 8 dígitos', () => {
    const { result } = renderHook(() => useOTAcciones({ ordenes: [OT], usuario: makeJefe() }), { wrapper: wrapWithQueryClient() });

    expect(result.current.canCompletar).toBe(false);
    act(() => { result.current.setReceptorNombre('Juan Pérez'); });
    expect(result.current.canCompletar).toBe(false); // falta DNI
    act(() => { result.current.setReceptorDni('123'); });
    expect(result.current.canCompletar).toBe(false); // DNI incompleto
    act(() => { result.current.setReceptorDni('12345678'); });
    expect(result.current.canCompletar).toBe(true);
  });

  it('mutAprobar con éxito notifica al creador de la OT vía realtime', async () => {
    mockAprobarOT.mockResolvedValue(undefined);
    const { result } = renderHook(() => useOTAcciones({ ordenes: [OT], usuario: makeJefe() }), { wrapper: wrapWithQueryClient() });

    act(() => { result.current.mutAprobar.mutate('ot-1'); });

    await waitFor(() => expect(result.current.mutAprobar.isSuccess).toBe(true));
    expect(mockPublicarEventoUsuario).toHaveBeenCalledWith(expect.objectContaining({
      tipo: 'ot_aprobada', usuarioId: 'uuid-miembro', otId: 'ot-1',
    }));
  });

  it('mutRechazar con éxito limpia el modal y el motivo', async () => {
    mockRechazarOT.mockResolvedValue(undefined);
    const { result } = renderHook(() => useOTAcciones({ ordenes: [OT], usuario: makeJefe() }), { wrapper: wrapWithQueryClient() });
    act(() => { result.current.setModalRechazar(OT); result.current.setMotivoRechazo('No corresponde'); });

    act(() => { result.current.mutRechazar.mutate({ otId: 'ot-1', motivo: 'No corresponde' }); });

    await waitFor(() => expect(result.current.mutRechazar.isSuccess).toBe(true));
    expect(result.current.modalRechazar).toBeNull();
    expect(result.current.motivoRechazo).toBe('');
  });

  it('mutCompletar con éxito limpia los campos de receptor y cierra el modal', async () => {
    mockCompletarOT.mockResolvedValue(undefined);
    const { result } = renderHook(() => useOTAcciones({ ordenes: [OT], usuario: makeJefe() }), { wrapper: wrapWithQueryClient() });
    act(() => {
      result.current.setModalCompletar(OT);
      result.current.setReceptorNombre('Juan Pérez');
      result.current.setReceptorDni('12345678');
    });

    act(() => { result.current.mutCompletar.mutate(); });

    await waitFor(() => expect(result.current.mutCompletar.isSuccess).toBe(true));
    expect(result.current.modalCompletar).toBeNull();
    expect(result.current.receptorNombre).toBe('');
    expect(result.current.receptorDni).toBe('');
  });

  it('mutCompletar solo envía observacionesCierre si hay texto no vacío', async () => {
    mockCompletarOT.mockResolvedValue(undefined);
    const { result } = renderHook(() => useOTAcciones({ ordenes: [OT], usuario: makeJefe() }), { wrapper: wrapWithQueryClient() });
    act(() => {
      result.current.setModalCompletar(OT);
      result.current.setReceptorNombre('Juan Pérez');
      result.current.setReceptorDni('12345678');
      result.current.setObsCierre('   ');
    });

    act(() => { result.current.mutCompletar.mutate(); });

    await waitFor(() => expect(result.current.mutCompletar.isSuccess).toBe(true));
    expect(mockCompletarOT).toHaveBeenCalledWith(expect.not.objectContaining({ observacionesCierre: expect.anything() }));
  });
});
