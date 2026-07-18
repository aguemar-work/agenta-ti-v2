import { createClient } from 'npm:@insforge/sdk';

const CORS_BASE = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Origins permitidos vía env ALLOWED_ORIGINS (lista separada por comas).
 * Sin configurar se mantiene '*' por compatibilidad — configurar en prod
 * (auditoría 2026-07-17, S6).
 */
function corsFor(req: Request): Record<string, string> {
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if (allowed.length === 0) {
    return { ...CORS_BASE, 'Access-Control-Allow-Origin': '*' };
  }
  const origin = (req.headers.get('Origin') ?? '').replace(/\/$/, '');
  return {
    ...CORS_BASE,
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
    Vary: 'Origin',
  };
}

export default async function (req: Request): Promise<Response> {
  const cors = corsFor(req);
  const json = (body: unknown, status: number) => jsonWith(cors, body, status);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  try {
    const baseUrl = Deno.env.get('INSFORGE_BASE_URL')!;
    const apiKey  = Deno.env.get('API_KEY')!;

    // 1) Identidad del solicitante
    const authHeader = req.headers.get('Authorization');
    const userToken  = authHeader ? authHeader.replace('Bearer ', '') : null;
    if (!userToken) return json({ error: 'No autorizado' }, 401);

    const caller = createClient({ baseUrl, edgeFunctionToken: userToken });
    const { data: userData } = await caller.auth.getCurrentUser();
    if (!userData?.user?.id) return json({ error: 'No autorizado' }, 401);
    const callerId = userData.user.id;

    // 2) Solo el dueño de plataforma puede eliminar
    const { data: esOwner, error: rpcErr } = await caller.database.rpc('sgtd_es_plataforma_owner');
    if (rpcErr || !esOwner) {
      return json({ error: 'Solo el dueño de plataforma puede eliminar usuarios' }, 403);
    }

    // 3) Entrada
    const body = (await req.json().catch(() => ({}))) as { usuario_id?: string };
    const usuarioId = body.usuario_id?.trim();
    if (!usuarioId) return json({ error: 'usuario_id es requerido' }, 400);
    if (usuarioId === callerId) return json({ error: 'No puedes eliminarte a ti mismo' }, 400);

    // 4) Limpiar datos de dominio con cliente admin (bypassa RLS)
    const admin = createClient({ baseUrl, edgeFunctionToken: apiKey });
    await admin.database.from('workspace_member').delete().eq('usuario_id', usuarioId);
    await admin.database.from('usuario_preferencia').delete().eq('usuario_id', usuarioId);
    await admin.database.from('usuario').delete().eq('id', usuarioId);

    // 5) Eliminar la cuenta de autenticación vía API admin
    const res = await fetch(`${baseUrl}/api/auth/users`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userIds: [usuarioId] }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return json({ error: `No se pudo eliminar la cuenta de autenticación: ${detail}` }, 500);
    }

    return json({ data: { deleted: usuarioId } }, 200);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
}

function jsonWith(cors: Record<string, string>, body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
