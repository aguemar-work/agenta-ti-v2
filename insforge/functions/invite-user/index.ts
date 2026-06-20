/**
 * Edge function: invite-user (InsForge)
 *
 * Flujo (V5 / 057):
 *   1. Autentica al caller vía JWT.
 *   2. Resuelve o crea auth.users del invitado (API admin con API_KEY).
 *      InsForge NO expone inviteUserByEmail ni POST /api/auth/invite.
 *   3. Llama sgtd_invitar_a_workspace() con el JWT del caller (+ x-workspace-id)
 *      para que el gate (owner OR jefe-de-su-ws) se evalúe en la RPC.
 *   4. Si la cuenta es nueva, envía correo de reset (flujo código → /verify-reset-code).
 *
 * Body (JSON):
 *   - email         string  requerido
 *   - rol           string  'jefe' | 'miembro'  (default 'miembro')
 *   - workspace_id  string  UUID destino (owner en panel; jefe puede omitir si hay header)
 *   - nombre        string  opcional
 *
 * Headers:
 *   Authorization:   Bearer <jwt>
 *   x-workspace-id:  <ws-uuid>  (jefe; owner puede usar header o body.workspace_id)
 */

import { createClient } from 'npm:@insforge/sdk';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-workspace-id',
};

type AuthUserRow = { id: string; email: string };

type InviteBody = {
  email?: string;
  rol?: string;
  workspace_id?: string;
  nombre?: string;
};

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  try {
    const baseUrl = Deno.env.get('INSFORGE_BASE_URL')!;
    const anonKey = Deno.env.get('ANON_KEY')!;
    const apiKey  = Deno.env.get('API_KEY')!;

    const authHeader = req.headers.get('Authorization');
    const userToken  = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : null;
    if (!userToken) return json({ error: 'No autorizado' }, 401);

    const wsHeader = req.headers.get('x-workspace-id')?.trim() ?? '';
    const callerHeaders: Record<string, string> = {};
    if (wsHeader) callerHeaders['x-workspace-id'] = wsHeader;

    const caller = createClient({
      baseUrl,
      edgeFunctionToken: userToken,
      headers: callerHeaders,
    });

    const { data: userData } = await caller.auth.getCurrentUser();
    if (!userData?.user?.id) return json({ error: 'No autorizado' }, 401);

    const body  = (await req.json().catch(() => ({}))) as InviteBody;
    const email = body.email?.trim().toLowerCase();
    const rol   = body.rol ?? 'miembro';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'El correo es requerido y debe ser válido' }, 400);
    }
    if (!['jefe', 'miembro'].includes(rol)) {
      return json({ error: 'El rol debe ser "jefe" o "miembro"' }, 400);
    }

    const nombre = body.nombre?.trim() || email.split('@')[0];

    // ── 1. Resolver auth.users (GET admin) o crear (POST admin) ───────────────
    let authUserId: string;
    let cuentaNueva = false;

    const existente = await buscarAuthUserPorEmail(baseUrl, apiKey, email);
    if (existente) {
      authUserId = existente.id;
    } else {
      try {
        const creado = await crearAuthUserPorEmail(baseUrl, apiKey, email, nombre);
        if (!creado) {
          return json({ error: 'No se pudo crear la cuenta de autenticación' }, 500);
        }
        authUserId = creado.id;
        cuentaNueva = true;
      } catch (createErr) {
        const err = createErr as Error & { status?: number };
        return json({ error: err.message || 'No se pudo crear la cuenta' }, err.status ?? 500);
      }
    }

    // ── 2. Dominio: invitación pendiente (joined_at NULL) ─────────────────────
    const rpcParams: Record<string, unknown> = {
      p_usuario_id: authUserId,
      p_email:      email,
      p_rol:        rol,
    };
    if (body.workspace_id?.trim()) {
      rpcParams.p_workspace_id = body.workspace_id.trim();
    }

    const { data: rpcResult, error: rpcErr } = await caller.database.rpc(
      'sgtd_invitar_a_workspace',
      rpcParams,
    );

    if (rpcErr) {
      const msg = rpcErr.message ?? 'No se pudo invitar al usuario';
      return json({ error: msg }, rpcHttpStatus(rpcErr.code));
    }

    // ── 3. Onboarding: reset por código (no magic link / no invite API) ─────
    if (cuentaNueva) {
      const anon = createClient({ baseUrl, anonKey });
      await enviarResetPassword(anon, email);
    }

    return json({ data: rpcResult }, 200);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
}

async function buscarAuthUserPorEmail(
  baseUrl: string,
  apiKey: string,
  email: string,
): Promise<AuthUserRow | null> {
  const res = await fetch(
    `${baseUrl}/api/auth/users?search=${encodeURIComponent(email)}&limit=10&offset=0`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  if (!res.ok) return null;

  const payload = await res.json().catch(() => null) as
    | { users?: AuthUserRow[]; data?: AuthUserRow[] }
    | AuthUserRow[]
    | null;

  const rows = Array.isArray(payload)
    ? payload
    : payload?.users ?? payload?.data ?? [];

  return rows.find((u) => u.email?.toLowerCase() === email) ?? null;
}

async function crearAuthUserPorEmail(
  baseUrl: string,
  apiKey: string,
  email: string,
  nombre: string,
): Promise<AuthUserRow | null> {
  const tempPassword = `${crypto.randomUUID()}aA1!`;
  const res = await fetch(`${baseUrl}/api/auth/users`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password: tempPassword, name: nombre }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const msg = detail || `HTTP ${res.status}`;
    if (/exist|duplicate|already/i.test(msg)) {
      throw Object.assign(new Error(msg), { status: 409 });
    }
    throw Object.assign(new Error(msg), { status: res.status >= 400 && res.status < 500 ? 400 : 500 });
  }

  const payload = await res.json().catch(() => null) as
    | { user?: AuthUserRow; id?: string; email?: string }
    | null;

  if (payload?.user?.id) {
    return { id: payload.user.id, email: payload.user.email ?? email };
  }
  if (payload?.id) {
    return { id: payload.id, email: payload.email ?? email };
  }
  return null;
}

async function enviarResetPassword(
  anon: ReturnType<typeof createClient>,
  email: string,
): Promise<void> {
  try {
    await anon.auth.sendResetPasswordEmail({ email });
  } catch {
    // No bloquea: la invitación queda creada aunque falle el correo
  }
}

/** Mapea ERRCODE de PostgreSQL a código HTTP. */
function rpcHttpStatus(code: string | undefined): number {
  switch (code) {
    case 'P0007': return 403;
    case 'P0008': return 409;
    case 'P0009': return 409;
    case 'P0006': return 409;
    case 'P0003': return 400;
    case 'P0002': return 404;
    case 'P0001': return 401;
    case '42501':
    case 'insufficient_privilege':
      return 403;
    default:
      return 500;
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
