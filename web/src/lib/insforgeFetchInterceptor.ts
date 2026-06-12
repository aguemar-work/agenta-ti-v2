import { getInsforge, getInsforgeEnv } from '@/lib/insforge';
import { getWorkspaceId } from '@/store/workspaceStore';

let installed = false;

/** Tiempo máximo por petición PostgREST (alineado con SDK InsForge). */
const FETCH_TIMEOUT_MS = 30_000;

/** Reintentos solo para fallos transitorios (red / 5xx), no para 401 ni 4xx de negocio. */
const TRANSIENT_RETRY_DELAYS_MS = [500, 1_000] as const;
const TRANSIENT_HTTP_STATUS = new Set([408, 502, 503, 504]);

function isDatabasePath(url: string): boolean {
  try {
    const u = new URL(url);
    return u.pathname.includes('/api/database/');
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function readErrorJson(res: Response): Promise<unknown> {
  try {
    return await res.clone().json();
  } catch {
    return null;
  }
}

function looksLikeSessionError(status: number, body: unknown): boolean {
  if (status !== 401) return false;
  if (body == null || typeof body !== 'object') return true;
  const o = body as { message?: string; error?: string };
  const t = `${o.message ?? ''} ${o.error ?? ''}`.toLowerCase();
  return (
    t.includes('token') ||
    t.includes('jwt') ||
    t.includes('session') ||
    t.includes('unauthorized') ||
    t.length === 0
  );
}

function buildRequestInput(input: RequestInfo | URL): RequestInfo {
  if (input instanceof URL) {
    return input.href;
  }
  if (input instanceof Request) {
    const m = input.method.toUpperCase();
    if (m === 'POST' || m === 'PATCH' || m === 'PUT' || m === 'DELETE') {
      return input.clone();
    }
  }
  return input;
}

function isTransientHttpStatus(status: number): boolean {
  return TRANSIENT_HTTP_STATUS.has(status);
}

function isNetworkFailure(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  return false;
}

async function fetchWithTimeout(
  native: typeof fetch,
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const callerSignal = init?.signal;
  if (callerSignal) {
    if (callerSignal.aborted) {
      clearTimeout(timeoutId);
      controller.abort();
    } else {
      callerSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  try {
    return await native(buildRequestInput(input), {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Petición con reintentos acotados ante red inestable o 5xx.
 * No sustituye TanStack Query ni un circuit breaker global (no requerido en V4).
 */
async function fetchDatabaseResilient(
  native: typeof fetch,
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const maxAttempts = TRANSIENT_RETRY_DELAYS_MS.length + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetchWithTimeout(native, input, init);
      if (isTransientHttpStatus(res.status) && attempt < TRANSIENT_RETRY_DELAYS_MS.length) {
        await sleep(TRANSIENT_RETRY_DELAYS_MS[attempt]!);
        continue;
      }
      return res;
    } catch (err) {
      if (isNetworkFailure(err) && attempt < TRANSIENT_RETRY_DELAYS_MS.length) {
        await sleep(TRANSIENT_RETRY_DELAYS_MS[attempt]!);
        continue;
      }
      throw err;
    }
  }

  return fetchWithTimeout(native, input, init);
}

async function handleSession401(
  native: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  res: Response,
): Promise<Response> {
  const body = await readErrorJson(res);
  if (!looksLikeSessionError(res.status, body)) return res;

  const insforge = getInsforge();
  const refresh = await insforge.auth.refreshSession();
  if (refresh.error) {
    await insforge.auth.signOut();
    window.location.assign('/login');
    return res;
  }

  const second = await fetchWithTimeout(native, input, init);
  if (second.status === 401) {
    await insforge.auth.signOut();
    window.location.assign('/login');
  }
  return second;
}

/**
 * Parche de `fetch` para peticiones PostgREST de InsForge:
 * timeout, reintentos transitorios y un 401 de sesión → refresh + un reintento → logout.
 */
export function installInsforgeFetchInterceptor(): void {
  if (installed || typeof window === 'undefined' || !getInsforgeEnv()) return;
  installed = true;

  const native = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input instanceof Request
            ? input.url
            : String(input);

    if (!url.startsWith('http') || !isDatabasePath(url)) {
      return native(input, init);
    }

    const wsId = getWorkspaceId();
    if (wsId) {
      const headers = new Headers(init?.headers);
      headers.set('x-workspace-id', wsId);
      init = { ...init, headers };
    }

    const res = await fetchDatabaseResilient(native, input, init);
    if (res.status !== 401) return res;

    return handleSession401(native, input as RequestInfo | URL, init, res);
  };
}
