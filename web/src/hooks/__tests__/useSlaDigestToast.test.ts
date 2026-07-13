/**
 * src/hooks/__tests__/useSlaDigestToast.test.ts
 *
 * Toast de resumen SLA al entrar (jefe), una vez por sesión/día. Es el hook
 * con más condiciones de gate del proyecto: usuario + esJefe + prefs +
 * notificación habilitada + no mostrado hoy + alertas > 0. Un solo gate mal
 * puesto y el jefe deja de recibir el aviso (o lo recibe de más).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { useSlaDigestToast } from '@/hooks/useSlaDigestToast';
import { getDefaultNotificationPrefs } from '@/lib/notificationPrefs';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';

const mockGetResumenSlaJefe = vi.fn();
const mockToastWarning = vi.fn();

vi.mock('@/api/sla', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/sla')>();
  return { ...actual, getResumenSlaJefe: () => mockGetResumenSlaJefe() };
});

vi.mock('sonner', () => ({
  toast: { warning: (...a: unknown[]) => mockToastWarning(...a) },
}));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(MemoryRouter, null, createElement(QueryClientProvider, { client: qc }, children));
}

const JEFE = { id: 'jefe-1', nombre: 'Ana', email: 'a@x.com', rol: 'jefe' as const, activo: true, created_at: '', updated_at: '' };

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  useAuthStore.setState({ authUser: null, usuario: null, isLoading: false });
  useWorkspaceStore.setState({ rolActivo: null, workspaceActivo: null });
});

function setJefeConWorkspace() {
  useAuthStore.setState({ usuario: JEFE });
  useWorkspaceStore.setState({
    rolActivo: 'jefe',
    workspaceActivo: { id: 'ws-1', organizacion_id: 'o1', nombre: 'WS', activo: true },
  });
}

describe('useSlaDigestToast', () => {
  it('sin prefs (aún cargando preferencias), no muestra el toast', async () => {
    setJefeConWorkspace();
    mockGetResumenSlaJefe.mockResolvedValue({ atrasadas_activas: 5, atrasadas_nuevas_24h: 2, bloqueadas_criticas: 0, fecha: '2026-04-29' });
    renderHook(() => useSlaDigestToast(null), { wrapper });

    await new Promise((r) => setTimeout(r, 20));
    expect(mockToastWarning).not.toHaveBeenCalled();
  });

  it('con alertas > 0 y notificación habilitada, muestra el toast una sola vez', async () => {
    setJefeConWorkspace();
    mockGetResumenSlaJefe.mockResolvedValue({ atrasadas_activas: 5, atrasadas_nuevas_24h: 2, bloqueadas_criticas: 0, fecha: '2026-04-29' });
    const prefs = getDefaultNotificationPrefs();

    renderHook(() => useSlaDigestToast(prefs), { wrapper });

    await waitFor(() => expect(mockToastWarning).toHaveBeenCalledTimes(1));
    expect(mockToastWarning).toHaveBeenCalledWith(expect.stringContaining('2'), expect.anything());
  });

  it('con atrasadas_nuevas_24h=0, no muestra el toast', async () => {
    setJefeConWorkspace();
    mockGetResumenSlaJefe.mockResolvedValue({ atrasadas_activas: 5, atrasadas_nuevas_24h: 0, bloqueadas_criticas: 0, fecha: '2026-04-29' });
    const prefs = getDefaultNotificationPrefs();

    renderHook(() => useSlaDigestToast(prefs), { wrapper });

    await new Promise((r) => setTimeout(r, 20));
    expect(mockToastWarning).not.toHaveBeenCalled();
  });

  it('con la notificación deshabilitada en prefs, no muestra el toast', async () => {
    setJefeConWorkspace();
    mockGetResumenSlaJefe.mockResolvedValue({ atrasadas_activas: 5, atrasadas_nuevas_24h: 2, bloqueadas_criticas: 0, fecha: '2026-04-29' });
    const prefs = { ...getDefaultNotificationPrefs(), resumen_sla_diario: false };

    renderHook(() => useSlaDigestToast(prefs), { wrapper });

    await new Promise((r) => setTimeout(r, 20));
    expect(mockToastWarning).not.toHaveBeenCalled();
  });

  it('si ya se mostró hoy para este usuario, no lo repite (aunque se remonte el hook)', async () => {
    setJefeConWorkspace();
    mockGetResumenSlaJefe.mockResolvedValue({ atrasadas_activas: 5, atrasadas_nuevas_24h: 2, bloqueadas_criticas: 0, fecha: '2026-04-29' });
    const prefs = getDefaultNotificationPrefs();

    const first = renderHook(() => useSlaDigestToast(prefs), { wrapper });
    await waitFor(() => expect(mockToastWarning).toHaveBeenCalledTimes(1));
    first.unmount();
    mockToastWarning.mockClear();

    renderHook(() => useSlaDigestToast(prefs), { wrapper });
    await new Promise((r) => setTimeout(r, 20));

    expect(mockToastWarning).not.toHaveBeenCalled();
  });

  it('rol miembro (no jefe), no muestra el toast aunque haya prefs', async () => {
    useAuthStore.setState({ usuario: { ...JEFE, id: 'm1', rol: 'miembro' } });
    useWorkspaceStore.setState({ rolActivo: 'miembro', workspaceActivo: { id: 'ws-1', organizacion_id: 'o1', nombre: 'WS', activo: true } });
    const prefs = getDefaultNotificationPrefs();

    renderHook(() => useSlaDigestToast(prefs), { wrapper });

    await new Promise((r) => setTimeout(r, 20));
    expect(mockToastWarning).not.toHaveBeenCalled();
    expect(mockGetResumenSlaJefe).not.toHaveBeenCalled();
  });
});
