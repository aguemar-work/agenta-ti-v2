/**
 * Analytics de producto (adopción, funnels, abandono de modales).
 * Complementa Sentry (errores) con eventos de comportamiento.
 *
 * Env:
 *   VITE_ANALYTICS_ENDPOINT — POST JSON (sendBeacon en prod)
 *   VITE_ANALYTICS_ENABLED=true — fuerza envío aunque no haya endpoint
 */

import * as Sentry from '@sentry/react';

export type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

const ENDPOINT = (import.meta.env.VITE_ANALYTICS_ENDPOINT as string | undefined)?.trim() || undefined;
const FORCE_ENABLED = import.meta.env.VITE_ANALYTICS_ENABLED === 'true';
const SESSION_KEY = 'nexora_analytics_session';

let sessionId: string | null = null;
let userId: string | null = null;
let userRol: string | null = null;

const modalSessions = new Map<string, { openedAt: number; completed: boolean }>();

function getSessionId(): string {
  if (!sessionId) {
    try {
      sessionId = sessionStorage.getItem(SESSION_KEY) ?? crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, sessionId);
    } catch {
      sessionId = crypto.randomUUID();
    }
  }
  return sessionId;
}

function shouldSendRemote(): boolean {
  return Boolean(ENDPOINT) && (FORCE_ENABLED || !import.meta.env.DEV);
}

function shouldLogDev(): boolean {
  return import.meta.env.DEV;
}

export function identifyAnalyticsUser(id: string, traits?: { rol?: string }) {
  userId = id;
  userRol = traits?.rol ?? null;
  track('identify', { userId: id, rol: traits?.rol });
}

export function resetAnalyticsUser() {
  userId = null;
  userRol = null;
}

export function track(event: string, properties?: AnalyticsProps) {
  const payload: AnalyticsProps = {
    event,
    timestamp: new Date().toISOString(),
    sessionId: getSessionId(),
    userId: userId ?? undefined,
    rol: userRol ?? undefined,
    environment: import.meta.env.MODE,
    ...properties,
  };

  if (shouldLogDev()) {
    console.debug('[analytics]', event, payload);
  }

  try {
    Sentry.addBreadcrumb({
      category: 'analytics',
      message: event,
      data: payload as Record<string, unknown>,
      level: 'info',
    });
  } catch {
    // Sentry no inicializado
  }

  if (!shouldSendRemote()) return;

  const body = JSON.stringify(payload);
  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT!, new Blob([body], { type: 'application/json' }));
    } else {
      void fetch(ENDPOINT!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      });
    }
  } catch {
    // No bloquear UX por fallos de telemetría
  }
}

export function pathToModule(pathname: string): string {
  if (pathname.startsWith('/semana')) return 'mi_semana';
  if (pathname.startsWith('/objetivos')) return 'objetivos';
  if (pathname.startsWith('/ordenes-trabajo')) return 'ordenes_trabajo';
  if (pathname.startsWith('/planificacion')) return 'planificacion';
  if (pathname.startsWith('/metricas')) return 'metricas';
  if (pathname.startsWith('/login')) return 'auth';
  return 'other';
}

export function trackPageView(pathname: string) {
  track('page_view', { pathname, module: pathToModule(pathname) });
}

export function trackModalOpen(modalId: string) {
  modalSessions.set(modalId, { openedAt: Date.now(), completed: false });
  track('modal_open', { modalId });
}

export function markModalCompleted(modalId: string) {
  const session = modalSessions.get(modalId);
  if (session) session.completed = true;
}

export function trackModalClose(modalId: string) {
  const session = modalSessions.get(modalId);
  const durationMs = session ? Date.now() - session.openedAt : 0;
  const completed = session?.completed ?? false;
  track('modal_close', {
    modalId,
    completed,
    abandoned: !completed,
    durationMs,
  });
  modalSessions.delete(modalId);
}

export function trackOnboarding(action: 'shown' | 'step' | 'completed' | 'dismissed', step?: number) {
  track('onboarding', { action, step });
}

export function trackFeatureDiscovery(feature: string, source: string) {
  track('feature_discovery', { feature, source });
}
