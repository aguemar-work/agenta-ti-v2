import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonRes({ error: 'Unauthorized' }, 401);

    const url    = Deno.env.get('SUPABASE_URL')!;
    const svcKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const caller = createClient(url, svcKey, {
      global: { headers: { Authorization: authHeader } },
      auth:   { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: authErr } = await caller.auth.getUser();
    if (authErr || !user) return jsonRes({ error: 'Unauthorized' }, 401);

    const { data: esOwner, error: rpcErr } = await caller.rpc('sgtd_es_plataforma_owner');
    if (rpcErr || !esOwner) return jsonRes({ error: 'Forbidden: no eres dueño de plataforma' }, 403);

    const body = await req.json() as { usuario_id?: string };
    const { usuario_id } = body;
    if (!usuario_id)          return jsonRes({ error: 'usuario_id es requerido' }, 400);
    if (usuario_id === user.id) return jsonRes({ error: 'No puedes eliminarte a ti mismo' }, 400);

    const admin = createClient(url, svcKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Limpiar datos relacionados explícitamente (por si no hay CASCADE)
    await admin.from('workspace_member').delete().eq('usuario_id', usuario_id);
    await admin.from('usuario_preferencia').delete().eq('usuario_id', usuario_id);
    await admin.from('usuario').delete().eq('id', usuario_id);

    // Eliminar de auth.users
    const { error: delErr } = await admin.auth.admin.deleteUser(usuario_id);
    if (delErr) return jsonRes({ error: delErr.message }, 500);

    return jsonRes({ data: { deleted: usuario_id } }, 200);
  } catch (err) {
    return jsonRes({ error: String(err) }, 500);
  }
});

function jsonRes(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
