/**
 * src/hooks/__tests__/useInvitacionesPendientesPage.test.ts
 *
 * Aceptar/rechazar invitaciones. estaProcesando(inv) es la pieza más sutil:
 * el estado accionEnCurso es un solo workspaceId compartido entre aceptar y
 * rechazar — solo la invitación en curso debe verse "procesando".
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useInvitacionesPendientesPage } from '@/hooks/useInvitacionesPendientesPage';
import { wrapWithQueryClient } from '@/test/helpers';

const mockFetchInvitacionesPendientes = vi.fn();
const mockAceptarInvitacion = vi.fn();
const mockRechazarInvitacion = vi.fn();

vi.mock('@/api/invitacion', () => ({
  fetchInvitacionesPendientes: () => mockFetchInvitacionesPendientes(),
  aceptarInvitacion: (id: string) => mockAceptarInvitacion(id),
  rechazarInvitacion: (id: string) => mockRechazarInvitacion(id),
}));

const INV_A = { workspace_id: 'ws-a', workspace_nombre: 'WS A', organizacion_id: 'o1', organizacion_nombre: 'Org', rol: 'miembro' as const, invited_at: '' };
const INV_B = { workspace_id: 'ws-b', workspace_nombre: 'WS B', organizacion_id: 'o1', organizacion_nombre: 'Org', rol: 'miembro' as const, invited_at: '' };

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchInvitacionesPendientes.mockResolvedValue([INV_A, INV_B]);
});

describe('useInvitacionesPendientesPage', () => {
  it('carga la lista de invitaciones pendientes', async () => {
    const { result } = renderHook(() => useInvitacionesPendientesPage(vi.fn()), { wrapper: wrapWithQueryClient() });

    await waitFor(() => expect(result.current.invitaciones).toHaveLength(2));
  });

  it('al aceptar, solo esa invitación se marca "procesando" — no la otra', async () => {
    mockAceptarInvitacion.mockImplementation(() => new Promise(() => {})); // nunca resuelve, para inspeccionar el estado "en curso"
    const { result } = renderHook(() => useInvitacionesPendientesPage(vi.fn()), { wrapper: wrapWithQueryClient() });
    await waitFor(() => expect(result.current.invitaciones).toHaveLength(2));

    act(() => { result.current.aceptar('ws-a'); });

    await waitFor(() => expect(result.current.estaProcesando(INV_A)).toBe(true));
    expect(result.current.estaProcesando(INV_B)).toBe(false);
  });

  it('al aceptar con éxito, invoca el callback onAceptada', async () => {
    mockAceptarInvitacion.mockResolvedValue({ workspace_id: 'ws-a', organizacion_id: 'o1', estado: 'aceptada' });
    const onAceptada = vi.fn();
    const { result } = renderHook(() => useInvitacionesPendientesPage(onAceptada), { wrapper: wrapWithQueryClient() });
    await waitFor(() => expect(result.current.invitaciones).toHaveLength(2));

    act(() => { result.current.aceptar('ws-a'); });

    await waitFor(() => expect(onAceptada).toHaveBeenCalledTimes(1));
  });

  it('al rechazar la última invitación restante, refetchea y expone lista vacía', async () => {
    mockRechazarInvitacion.mockImplementation(async () => {
      mockFetchInvitacionesPendientes.mockResolvedValue([]); // ya no quedan tras rechazar
      return { workspace_id: 'ws-a', estado: 'rechazada' };
    });
    const { result } = renderHook(() => useInvitacionesPendientesPage(vi.fn()), { wrapper: wrapWithQueryClient() });
    await waitFor(() => expect(result.current.invitaciones).toHaveLength(2));

    act(() => { result.current.rechazar('ws-a'); });

    await waitFor(() => expect(result.current.procesando).toBe(false));
    await waitFor(() => expect(result.current.invitaciones).toHaveLength(0));
  });
});
