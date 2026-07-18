/**
 * src/hooks/__tests__/useRealtimeNotificaciones.test.ts
 *
 * Conexión realtime + toasts por evento. Riesgos principales: suscribirse al
 * canal de equipo cuando NO se es jefe (fuga de eventos privados del equipo),
 * no reintentar tras agotar los 3 intentos, y no desuscribirse/desconectar
 * al desmontar (fuga de listeners entre navegaciones).
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { useRealtimeNotificaciones } from '@/hooks/useRealtimeNotificaciones';
import { getDefaultNotificationPrefs } from '@/lib/notificationPrefs';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';

const handlers = new Map<string, (payload: Record<string, unknown>) => void>();
const mockConnect = vi.fn();
const mockSubscribe = vi.fn().mockResolvedValue(undefined);
const mockUnsubscribe = vi.fn();
const mockDisconnect = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastInfo = vi.fn();
const mockToastWarning = vi.fn();
const mockToastError = vi.fn();

vi.mock('@/lib/insforge', () => ({
  getInsforge: () => ({
    realtime: {
      connect: () => mockConnect(),
      subscribe: (ch: string) => mockSubscribe(ch),
      on: (event: string, cb: (p: Record<string, unknown>) => void) => { handlers.set(event, cb); },
      unsubscribe: (ch: string) => mockUnsubscribe(ch),
      disconnect: () => mockDisconnect(),
    },
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...a: unknown[]) => mockToastSuccess(...a),
    info: (...a: unknown[]) => mockToastInfo(...a),
    warning: (...a: unknown[]) => mockToastWarning(...a),
    error: (...a: unknown[]) => mockToastError(...a),
  },
}));

// QueryClient estable a nivel de módulo: crearlo dentro del wrapper le daba una
// identidad nueva por render y, como `qc` está en las deps del efecto del hook,
// cada rerender reconectaba (en producción es el singleton de lib/queryClient).
let testQueryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function wrapper({ children }: { children: ReactNode }) {
  return createElement(MemoryRouter, null, createElement(QueryClientProvider, { client: testQueryClient }, children));
}

const USUARIO = { id: 'u1', nombre: 'Ana', email: 'a@x.com', rol: 'jefe' as const, activo: true, created_at: '', updated_at: '' };

beforeEach(() => {
  vi.clearAllMocks();
  handlers.clear();
  testQueryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mockConnect.mockResolvedValue(undefined);
  useAuthStore.setState({ authUser: null, usuario: null, isLoading: false });
  useWorkspaceStore.setState({ rolActivo: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useRealtimeNotificaciones', () => {
  it('sin usuario en sesión, no intenta conectar', () => {
    renderHook(() => useRealtimeNotificaciones(), { wrapper });

    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('jefe: se suscribe al canal personal Y al canal de equipo', async () => {
    useAuthStore.setState({ usuario: USUARIO });
    useWorkspaceStore.setState({ rolActivo: 'jefe' });

    const { result } = renderHook(() => useRealtimeNotificaciones(), { wrapper });

    await waitFor(() => expect(result.current.conectado).toBe(true));
    expect(mockSubscribe).toHaveBeenCalledWith('usuario:u1');
    expect(mockSubscribe).toHaveBeenCalledWith('equipo:u1');
  });

  it('miembro (no jefe): se suscribe SOLO al canal personal, no al de equipo', async () => {
    useAuthStore.setState({ usuario: { ...USUARIO, rol: 'miembro' } });
    useWorkspaceStore.setState({ rolActivo: 'miembro' });

    const { result } = renderHook(() => useRealtimeNotificaciones(), { wrapper });

    await waitFor(() => expect(result.current.conectado).toBe(true));
    expect(mockSubscribe).toHaveBeenCalledWith('usuario:u1');
    expect(mockSubscribe).not.toHaveBeenCalledWith('equipo:u1');
  });

  it('evento ot_aprobada con notificación habilitada, muestra el toast', async () => {
    useAuthStore.setState({ usuario: USUARIO });
    useWorkspaceStore.setState({ rolActivo: 'jefe' });
    const prefs = getDefaultNotificationPrefs();

    renderHook(() => useRealtimeNotificaciones(prefs), { wrapper });
    await waitFor(() => expect(handlers.has('ot_aprobada')).toBe(true));

    handlers.get('ot_aprobada')!({ numero: 'OT-TI-0007' });

    expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringContaining('OT-TI-0007'));
  });

  it('evento ot_aprobada con esa notificación deshabilitada en prefs, NO muestra el toast', async () => {
    useAuthStore.setState({ usuario: USUARIO });
    useWorkspaceStore.setState({ rolActivo: 'jefe' });
    const prefs = { ...getDefaultNotificationPrefs(), ot_aprobada: false };

    renderHook(() => useRealtimeNotificaciones(prefs), { wrapper });
    await waitFor(() => expect(handlers.has('ot_aprobada')).toBe(true));

    handlers.get('ot_aprobada')!({ numero: 'OT-TI-0007' });

    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('miembro: el handler tarea_completada (solo-jefe) nunca se registra', async () => {
    useAuthStore.setState({ usuario: { ...USUARIO, rol: 'miembro' } });
    useWorkspaceStore.setState({ rolActivo: 'miembro' });

    const { result } = renderHook(() => useRealtimeNotificaciones(), { wrapper });
    await waitFor(() => expect(result.current.conectado).toBe(true));

    expect(handlers.has('tarea_completada')).toBe(false);
  });

  it('al desmontar (con prefs estables), desuscribe los canales y desconecta exactamente una vez', async () => {
    useAuthStore.setState({ usuario: USUARIO });
    useWorkspaceStore.setState({ rolActivo: 'jefe' });
    const prefsEstables = getDefaultNotificationPrefs(); // misma referencia en cada render, como en uso real (AppShell la guarda en useState)
    const { result, unmount } = renderHook(() => useRealtimeNotificaciones(prefsEstables), { wrapper });
    await waitFor(() => expect(result.current.conectado).toBe(true));

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalledWith('usuario:u1');
    expect(mockUnsubscribe).toHaveBeenCalledWith('equipo:u1');
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('sin prefs explícitas, el default es estable y conecta exactamente una vez (fix P8, 2026-07-18)', async () => {
    // Antes el default param `prefs = getDefaultNotificationPrefs()` se re-evaluaba
    // en cada render con identidad nueva y, al estar `prefs` en las deps del efecto,
    // duplicaba connect/subscribe/unsubscribe/disconnect (este test documentaba el
    // bug con toBeGreaterThan(1)). Ahora el default es DEFAULT_PREFS module-level:
    // la ventana inicial de AppShell (notifPrefs null) ya no reconecta de más.
    useAuthStore.setState({ usuario: USUARIO });
    useWorkspaceStore.setState({ rolActivo: 'jefe' });

    const { result, rerender } = renderHook(() => useRealtimeNotificaciones(), { wrapper });

    await waitFor(() => expect(result.current.conectado).toBe(true));
    rerender();
    rerender();
    await waitFor(() => expect(result.current.conectado).toBe(true));
    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(mockDisconnect).not.toHaveBeenCalled();
  });

  it('si connect() falla, reintenta hasta 3 veces con backoff y luego se rinde (conectado=false)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    useAuthStore.setState({ usuario: USUARIO });
    useWorkspaceStore.setState({ rolActivo: 'jefe' });
    mockConnect.mockRejectedValue(new Error('network'));
    const prefsEstables = getDefaultNotificationPrefs(); // referencia estable — evita el bug de re-conexión del test anterior

    renderHook(() => useRealtimeNotificaciones(prefsEstables), { wrapper });

    await vi.waitFor(() => expect(mockConnect).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(2_000);
    await vi.waitFor(() => expect(mockConnect).toHaveBeenCalledTimes(2));
    await vi.advanceTimersByTimeAsync(4_000);
    await vi.waitFor(() => expect(mockConnect).toHaveBeenCalledTimes(3));
    await vi.advanceTimersByTimeAsync(8_000);
    await vi.waitFor(() => expect(mockConnect).toHaveBeenCalledTimes(4));

    // Agotados los 3 reintentos (4 llamadas totales) — no debe programarse uno más.
    await vi.advanceTimersByTimeAsync(20_000);
    expect(mockConnect).toHaveBeenCalledTimes(4);
  });
});
