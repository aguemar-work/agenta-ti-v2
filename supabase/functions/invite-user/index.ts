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

    const url      = Deno.env.get('SUPABASE_URL')!;
    const svcKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Cliente con JWT del caller → respeta RLS para verificar ownership
    const caller = createClient(url, svcKey, {
      global: { headers: { Authorization: authHeader } },
      auth:   { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: authErr } = await caller.auth.getUser();
    if (authErr || !user) return jsonRes({ error: 'Unauthorized' }, 401);

    const { data: esOwner, error: rpcErr } = await caller.rpc('sgtd_es_plataforma_owner');
    if (rpcErr || !esOwner) return jsonRes({ error: 'Forbidden: no eres dueño de plataforma' }, 403);

    const body  = await req.json() as { email?: string; nombre?: string };
    const email = body.email?.trim().toLowerCase();
    if (!email) return jsonRes({ error: 'email es requerido' }, 400);

    // Cliente admin sin JWT del caller (service role)
    const admin = createClient(url, svcKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verificar que no exista ya
    const { data: existing } = await admin
      .from('usuario')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existing) return jsonRes({ error: 'Ya existe un usuario con ese correo' }, 409);

    // Enviar invitación vía auth
    const { data: inv, error: invErr } = await admin.auth.admin.inviteUserByEmail(email);
    if (invErr) return jsonRes({ error: invErr.message }, 400);

    const nombre = body.nombre?.trim() || email.split('@')[0];

    // Crear fila en public.usuario
    const { data: row, error: insertErr } = await admin
      .from('usuario')
      .insert({ id: inv.user.id, nombre, email, rol: 'miembro', activo: true })
      .select('*')
      .single();

    if (insertErr) return jsonRes({ error: insertErr.message }, 500);

    return jsonRes({ data: row }, 200);
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
