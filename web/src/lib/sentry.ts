/**
 * Observabilidad en producción (Sentry).
 * Inicializar en main.tsx antes del render; identificar usuario en AuthProvider.
 *
 * Env: VITE_SENTRY_DSN (obligatorio en prod), VITE_SENTRY_ENVIRONMENT (opcional).
 */

import * as Sentry from '@sentry/react';

let initialized = false;

export function isSentryEnabled(): boolean {
  return initialized;
}

/** Devuelve true si Sentry quedó activo (DSN presente). */
export function initSentry(): boolean {
  const dsn = (import.meta.env.VITE_SENTRY_DSN as string | undefined)?.trim();
  if (!dsn || initialized) return initialized;

  const isProd = import.meta.env.PROD;
  const environment =
    (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined)?.trim() ||
    (isProd ? 'production' : import.meta.env.MODE);

  Sentry.init({
    dsn,
    environment,
    sendDefaultPii: false,
    tracesSampleRate: isProd ? 0.2 : 1,
    integrations: [Sentry.browserTracingIntegration()],
  });

  initialized = true;
  return true;
}

export type SentryUserIdentity = {
  id: string;
  email?: string | null;
  role?: string | null;
};

export function identifySentryUser({ id, role }: SentryUserIdentity): void {
  if (!initialized) return;
  Sentry.setUser({ id });
  if (role) Sentry.setTag('role', role);
}

export function clearSentryUser(): void {
  if (!initialized) return;
  Sentry.setUser(null);
}

export function captureSentryException(
  error: Error,
  context?: { componentStack?: string; label?: string },
): void {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    if (context?.label) scope.setTag('error_boundary', context.label);
    const stack = context?.componentStack;
    if (stack) scope.setExtra('componentStack', stack);
    Sentry.captureException(error);
  });
}
