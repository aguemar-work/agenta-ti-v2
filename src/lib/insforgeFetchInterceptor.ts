import { getInsforge, getInsforgeEnv } from '@/lib/insforge';

let installed = false;

function isDatabasePath(url: string): boolean {
  try {
    const u = new URL(url);
    return u.pathname.includes('/api/database/');
  } catch {
    return false;
  }
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

/**
 * Parche de `fetch` para peticiones PostgREST de InsForge: un 401 de sesión
 * dispara `refreshSession` y un único reintento; si sigue fallando, cierre de sesión.
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

    const run = () => native(buildRequestInput(input as RequestInfo | URL), init);

    let res = await run();
    if (res.status !== 401) return res;

    const body = await readErrorJson(res);
    if (!looksLikeSessionError(res.status, body)) return res;

    const insforge = getInsforge();
    const refresh = await insforge.auth.refreshSession();
    if (refresh.error) {
      await insforge.auth.signOut();
      window.location.assign('/login');
      return res;
    }

    const second = await run();
    if (second.status === 401) {
      await insforge.auth.signOut();
      window.location.assign('/login');
    }
    return second;
  };
}
