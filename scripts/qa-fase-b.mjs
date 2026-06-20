#!/usr/bin/env node
/**
 * QA Fase B — Invitaciones (057 + edge invite-user + frontend B2)
 *
 * Uso:
 *   cp scripts/.env.qa.example scripts/.env.qa   # completar contraseñas
 *   node scripts/qa-fase-b.mjs
 *
 * Requiere: web/.env (VITE_INSFORGE_*) y .insforge/project.json (api_key)
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createClient } from '../web/node_modules/@insforge/sdk/dist/index.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

function loadDotEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

const qaEnv = loadDotEnv(resolve(__dir, '.env.qa'));
const webEnv = loadDotEnv(resolve(root, 'web/.env'));
const project = JSON.parse(readFileSync(resolve(root, '.insforge/project.json'), 'utf8'));

const BASE_URL = (webEnv.VITE_INSFORGE_URL || project.oss_host).replace(/\/$/, '');
const ANON_KEY = webEnv.VITE_INSFORGE_ANON_KEY;
const API_KEY  = project.api_key;

const IDS = {
  owner:   'f5d5d06c-317a-4ee7-9cb2-1f8a816bf7b0',
  jefe:    'bc811961-0b6f-4530-9279-3597df8c4d90',
  miembro: 'ca18685f-1728-4684-b4e3-7496dcb60ea2',
  wsJefe:  'd945505d-f75d-4ca6-9dd6-85e0e9216087', // Mi Organización
  wsAjeno: 'f15e5851-7fef-4e96-97ed-f75316061db1', // AGUEMAR
  wsBelman:'64206fc1-770d-4c93-bcc0-2801e11c80da', // BELMAN (2ª org para T17)
  existente: 'ca18685f-1728-4684-b4e3-7496dcb60ea2', // kgaytan
};

const results = [];
let failed = 0;

function pass(id, msg) { results.push({ id, ok: true, msg }); console.log(`  ✅ ${id}: ${msg}`); }
function fail(id, msg) { results.push({ id, ok: false, msg }); failed++; console.log(`  ❌ ${id}: ${msg}`); }
function skip(id, msg) { results.push({ id, ok: null, msg }); console.log(`  ⏭️  ${id}: ${msg}`); }

async function cliQuery(sql) {
  const oneLine = sql.replace(/\s+/g, ' ').trim();
  const out = execSync(`npx @insforge/cli db query "${oneLine.replace(/"/g, '\\"')}"`, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 60_000,
  });
  return out;
}

function parseCliTable(out) {
  const lines = out.split(/\r?\n/).filter((l) => l.startsWith('│') && !l.includes('─'));
  if (lines.length < 2) return [];
  const parseRow = (line) =>
    line.split('│').slice(1, -1).map((c) => c.trim());
  const headers = parseRow(lines[0]);
  return lines.slice(1).map((line) => {
    const vals = parseRow(line);
    return Object.fromEntries(headers.map((h, i) => [h, vals[i]]));
  });
}

async function rawSql(query) {
  const out = await cliQuery(query);
  return parseCliTable(out);
}

async function signIn(email, password) {
  const client = createClient({ baseUrl: BASE_URL, anonKey: ANON_KEY });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data?.accessToken) throw new Error(error?.message ?? 'signIn falló');
  return { client, token: data.accessToken, userId: data.user?.id };
}

function authedClient(token, workspaceId) {
  const headers = workspaceId ? { 'x-workspace-id': workspaceId } : {};
  return createClient({ baseUrl: BASE_URL, edgeFunctionToken: token, headers });
}

async function expectRpcError(client, fn, params, expectCode) {
  const { error } = await client.database.rpc(fn, params);
  if (!error) return { ok: false, msg: 'Se esperaba error y la RPC devolvió OK' };
  const code = error.code ?? error.details ?? '';
  const msg = error.message ?? String(error);
  if (expectCode && !msg.includes(expectCode) && code !== expectCode) {
    return { ok: false, msg: `Error inesperado: ${msg} (code=${code})` };
  }
  return { ok: true, msg };
}

async function adminCreateUser(email, password, name) {
  const res = await fetch(`${BASE_URL}/api/auth/users`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.message ?? `HTTP ${res.status}`);
  return body.user;
}

async function adminDeleteUser(userId) {
  await fetch(`${BASE_URL}/api/auth/users`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ userIds: [userId] }),
  });
}

async function cleanupQaRows(email, userId) {
  const em = email.replace(/'/g, "''");
  const uid = userId.replace(/'/g, "''");
  await rawSql(`
    DELETE FROM public.workspace_member WHERE usuario_id = '${uid}';
    DELETE FROM public.usuario_preferencia WHERE usuario_id = '${uid}';
    DELETE FROM public.usuario WHERE id = '${uid}' OR lower(email) = lower('${em}');
  `);
}

// ─── Bloque A: estructural (sin JWT) ─────────────────────────────────────────

async function runStructural() {
  console.log('\n── Bloque A: estructural (API_KEY / SQL) ──');

  try {
    const rows = await rawSql(`SELECT count(*)::int AS n FROM pg_policies WHERE schemaname='public' AND tablename='workspace_member' AND policyname='ws_member_insert' AND with_check::text LIKE '%sgtd_workspace_id()%'`);
    const n = Number(rows[0]?.n ?? 0);
    if (n > 0) pass('T1', 'ws_member_insert exige sgtd_workspace_id()');
    else fail('T1', 'Política ws_member_insert sin restricción de workspace');
  } catch (e) { fail('T1', String(e)); }

  try {
    const rows = await rawSql(`
      SELECT EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
        WHERE n.nspname='public' AND p.proname='sgtd_invitar_a_workspace'
      ) AS ok
    `);
    const ok = rows[0]?.ok === 'true' || rows[0]?.ok === 't';
    if (ok) pass('T2', 'sgtd_invitar_a_workspace existe');
    else fail('T2', 'RPC no encontrada');
  } catch (e) { fail('T2', String(e)); }

  try {
    const res = await fetch(`${BASE_URL}/api/auth/invite`, { method: 'POST', headers: { Authorization: `Bearer ${API_KEY}` } });
    if (res.status === 404) pass('API-01', 'POST /api/auth/invite → 404 (no inviteUserByEmail)');
    else fail('API-01', `status inesperado ${res.status}`);
  } catch (e) { fail('API-01', String(e)); }

  const meta = await fetch(`${BASE_URL}/api/metadata`).catch(() => null);
  if (meta?.ok) pass('API-02', 'InsForge metadata accesible');
  else skip('API-02', 'metadata no consultado');
}

// ─── Bloque B: RPC con JWT ───────────────────────────────────────────────────

async function runRpcMatrix() {
  console.log('\n── Bloque B: matriz RPC (requiere contraseñas en scripts/.env.qa) ──');

  const ownerPw  = qaEnv.QA_OWNER_PASSWORD;
  const jefePw   = qaEnv.QA_JEFE_PASSWORD;
  const miembroPw = qaEnv.QA_MIEMBRO_PASSWORD;

  if (!ownerPw) { skip('T3-T18-owner', 'Falta QA_OWNER_PASSWORD'); return { owner: null }; }

  let owner;
  try {
    owner = await signIn(qaEnv.QA_OWNER_EMAIL || 'a.guevaramartinez@gmail.com', ownerPw);
    pass('AUTH-owner', `Sesión owner OK (${owner.userId})`);
  } catch (e) {
    fail('AUTH-owner', String(e));
    return { owner: null };
  }

  const ownerClient = authedClient(owner.token);

  // T16 — email nuevo (auth creado por admin, RPC por owner)
  const ts = Date.now();
  const emailNuevo = `qa-faseb-nuevo-${ts}@nufago.com`;
  let uidNuevo = null;
  try {
    const authUser = await adminCreateUser(emailNuevo, 'TempOnly1!', 'QA Nuevo');
    uidNuevo = authUser.id;
    const { data, error } = await ownerClient.database.rpc('sgtd_invitar_a_workspace', {
      p_usuario_id: uidNuevo,
      p_email: emailNuevo,
      p_rol: 'miembro',
      p_workspace_id: IDS.wsAjeno,
    });
    if (error) fail('T16', error.message);
    else if (data?.estado === 'pendiente') pass('T16', `Invitación pendiente para email nuevo (${emailNuevo})`);
    else fail('T16', `Respuesta inesperada: ${JSON.stringify(data)}`);
  } catch (e) { fail('T16', String(e)); }

  // T17 — usuario existente → 2ª org
  try {
    const existente = await rawSql(`SELECT email FROM public.usuario WHERE id = '${IDS.existente}'`);
    const emailEx = existente[0]?.email ?? 'kgaytan@nufago.com';
    const { data, error } = await ownerClient.database.rpc('sgtd_invitar_a_workspace', {
      p_usuario_id: IDS.existente,
      p_email: emailEx,
      p_rol: 'miembro',
      p_workspace_id: IDS.wsBelman,
    });
    if (error && /ya es miembro activo/i.test(error.message)) {
      pass('T17', 'Usuario ya activo en BELMAN (idempotente OK)');
    } else if (error) {
      fail('T17', error.message);
    } else if (data?.estado === 'pendiente') {
      pass('T17', `Segunda org pendiente para ${emailEx}`);
    } else {
      fail('T17', JSON.stringify(data));
    }
  } catch (e) { fail('T17', String(e)); }

  // T5 — jefe ws A → ws B
  if (!jefePw) {
    skip('T5', 'Falta QA_JEFE_PASSWORD');
  } else {
    try {
      const jefe = await signIn(qaEnv.QA_JEFE_EMAIL || 'aguevara@nufago.com', jefePw);
      const jefeClient = authedClient(jefe.token, IDS.wsJefe);
      const r = await expectRpcError(jefeClient, 'sgtd_invitar_a_workspace', {
        p_usuario_id: uidNuevo ?? IDS.miembro,
        p_email: emailNuevo,
        p_rol: 'miembro',
        p_workspace_id: IDS.wsAjeno,
      }, 'permiso');
      if (r.ok) pass('T5', 'Jefe de su ws no puede invitar a ws ajeno');
      else fail('T5', r.msg);
    } catch (e) { fail('T5', String(e)); }
  }

  // T11 — miembro no puede invitar
  if (!miembroPw) {
    skip('T11', 'Falta QA_MIEMBRO_PASSWORD');
  } else {
    try {
      const miembro = await signIn(qaEnv.QA_MIEMBRO_EMAIL || 'kgaytan@nufago.com', miembroPw);
      const miembroClient = authedClient(miembro.token, IDS.wsJefe);
      const r = await expectRpcError(miembroClient, 'sgtd_invitar_a_workspace', {
        p_usuario_id: IDS.miembro,
        p_email: 'kgaytan@nufago.com',
        p_rol: 'miembro',
        p_workspace_id: IDS.wsJefe,
      }, 'permiso');
      if (r.ok) pass('T11', 'Miembro operativo no puede invitar');
      else fail('T11', r.msg);
    } catch (e) { fail('T11', String(e)); }
  }

  // T18 — reinvitar tras rechazo
  if (uidNuevo) {
    try {
      // Simular rechazo directo en BD (invitado aún no tiene sesión)
      await rawSql(`
        UPDATE public.workspace_member SET activo = false
        WHERE usuario_id = '${uidNuevo}' AND workspace_id = '${IDS.wsAjeno}' AND joined_at IS NULL
      `);
      const { data, error } = await ownerClient.database.rpc('sgtd_invitar_a_workspace', {
        p_usuario_id: uidNuevo,
        p_email: emailNuevo,
        p_rol: 'miembro',
        p_workspace_id: IDS.wsAjeno,
      });
      if (error) fail('T18', error.message);
      else if (data?.estado === 'pendiente') pass('T18', 'Reinvitar tras rechazo → pendiente de nuevo');
      else fail('T18', JSON.stringify(data));
    } catch (e) { fail('T18', String(e)); }
  } else {
    skip('T18', 'Sin uid de T16');
  }

  return { owner, ownerClient, emailNuevo, uidNuevo };
}

// ─── Bloque C: edge invite-user ──────────────────────────────────────────────

async function runEdgeInvite(owner, emailNuevo, uidNuevo) {
  console.log('\n── Bloque C: edge invite-user (E2E setup) ──');
  if (!owner) { skip('EDGE-01', 'Sin sesión owner'); return null; }

  const ts = Date.now();
  const email = `qa-faseb-edge-${ts}@nufago.com`;
  try {
    const client = authedClient(owner.token);
    const { data, error } = await client.functions.invoke('invite-user', {
      body: { email, rol: 'miembro', workspace_id: IDS.wsAjeno },
    });
    if (error) { fail('EDGE-01', error.message ?? String(error)); return null; }
    if (data?.error) { fail('EDGE-01', data.error); return null; }
    if (data?.data?.estado !== 'pendiente') { fail('EDGE-01', JSON.stringify(data)); return null; }
    pass('EDGE-01', `Edge invitó ${email} → pendiente`);

    const otp = await rawSql(`
      SELECT email, purpose, (consumed_at IS NULL) AS vigente
      FROM auth.email_otps WHERE lower(email) = lower('${email}') ORDER BY created_at DESC LIMIT 1
    `);
    const row = otp[0];
    if (row?.purpose === 'RESET_PASSWORD' && (row?.vigente === 'true' || row?.vigente === 't')) {
      pass('EDGE-02', 'OTP RESET_PASSWORD encolado en auth.email_otps');
    } else {
      fail('EDGE-02', `Sin fila OTP: ${JSON.stringify(row)}`);
    }

    const authLookup = await fetch(
      `${BASE_URL}/api/auth/users?search=${encodeURIComponent(email)}&limit=5`,
      { headers: { Authorization: `Bearer ${API_KEY}` } },
    ).then((r) => r.json());
    const authUser = (authLookup?.data ?? []).find((u) => u.email?.toLowerCase() === email);
    if (authUser?.id) pass('EDGE-03', `auth.users creado (${authUser.id})`);
    else fail('EDGE-03', 'auth.users no encontrado');

    return { email, userId: authUser?.id };
  } catch (e) {
    fail('EDGE-01', String(e));
    return null;
  }
}

async function cleanupT16(uidNuevo, emailNuevo) {
  if (!uidNuevo || !emailNuevo) return;
  try {
    await cleanupQaRows(emailNuevo, uidNuevo);
    await adminDeleteUser(uidNuevo);
  } catch { /* best effort */ }
}

// ─── Bloque D: E2E invitado (OTP → login → aceptar) ─────────────────────────

async function runE2eInvitee(edgeUser) {
  console.log('\n── Bloque D: E2E invitado (login → aceptar → acceso) ──');
  if (!edgeUser?.email || !edgeUser?.userId) {
    skip('E2E-01', 'Sin usuario de EDGE-01');
    return;
  }

  const otpCode = qaEnv.QA_E2E_OTP_CODE?.trim();
  const newPassword = qaEnv.QA_E2E_NEW_PASSWORD || 'QaFaseB9!x';

  if (!otpCode || otpCode.length !== 6) {
    skip('E2E-01', 'Falta QA_E2E_OTP_CODE (6 dígitos del email). Completar manualmente y re-ejecutar.');
    console.log('\n  📋 Manual E2E (completar en navegador):');
    console.log(`     1. /forgot-password → ${edgeUser.email}`);
    console.log('     2. /verify-reset-code → código del email');
    console.log(`     3. /reset-password → ${newPassword}`);
    console.log('     4. /login');
    console.log('     5. Pantalla "Invitaciones pendientes" → Aceptar');
    console.log('     6. Debe entrar a /semana');
    return;
  }

  const anon = createClient({ baseUrl: BASE_URL, anonKey: ANON_KEY });

  try {
    const { data: ex, error: exErr } = await anon.auth.exchangeResetPasswordToken({
      email: edgeUser.email,
      code: otpCode,
    });
    if (exErr || !ex?.token) { fail('E2E-01', exErr?.message ?? 'exchange OTP falló'); return; }
    pass('E2E-01', 'OTP canjeado');

    const { error: resetErr } = await anon.auth.resetPassword({ password: newPassword, otp: ex.token });
    if (resetErr) { fail('E2E-02', resetErr.message); return; }
    pass('E2E-02', 'Contraseña establecida');

    const { client, token } = await signIn(edgeUser.email, newPassword);
    pass('E2E-03', 'Login invitado OK');

    const invClient = authedClient(token);
    const { data: pendientes, error: pErr } = await invClient.database.rpc('sgtd_listar_invitaciones_pendientes');
    if (pErr) { fail('E2E-04', pErr.message); return; }
    const lista = Array.isArray(pendientes) ? pendientes : [];
    if (!lista.some((p) => p.workspace_id === IDS.wsAjeno)) {
      fail('E2E-04', `Sin invitación a AGUEMAR: ${JSON.stringify(lista)}`);
      return;
    }
    pass('E2E-04', 'listar_invitaciones_pendientes OK');

    const { data: acep, error: aErr } = await invClient.database.rpc('sgtd_aceptar_invitacion_workspace', {
      p_workspace_id: IDS.wsAjeno,
    });
    if (aErr) { fail('E2E-05', aErr.message); return; }
    if (acep?.estado !== 'aceptada') { fail('E2E-05', JSON.stringify(acep)); return; }
    pass('E2E-05', 'Invitación aceptada');

    const wm = await rawSql(`
      SELECT (joined_at IS NOT NULL) AS activo FROM public.workspace_member
      WHERE usuario_id = '${edgeUser.userId}' AND workspace_id = '${IDS.wsAjeno}'
    `);
    const activo = wm[0]?.activo === 'true' || wm[0]?.activo === 't';
    if (activo) pass('E2E-06', 'joined_at seteado — bootstrap puede continuar');
    else fail('E2E-06', 'joined_at sigue NULL');

    // cleanup edge test user
    await cleanupQaRows(edgeUser.email, edgeUser.userId);
    await adminDeleteUser(edgeUser.userId);
    pass('E2E-cleanup', 'Usuario QA edge eliminado');
  } catch (e) {
    fail('E2E', String(e));
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('QA Fase B — Invitaciones');
  console.log(`Proyecto: ${BASE_URL}`);

  if (!ANON_KEY) {
    console.error('Falta VITE_INSFORGE_ANON_KEY en web/.env');
    process.exit(2);
  }

  await runStructural();
  const { owner, emailNuevo, uidNuevo } = await runRpcMatrix();
  const edgeUser = await runEdgeInvite(owner, emailNuevo, uidNuevo);
  await runE2eInvitee(edgeUser);
  await cleanupT16(uidNuevo, emailNuevo);

  console.log('\n══ Resumen ══');
  const ok = results.filter((r) => r.ok === true).length;
  const skipN = results.filter((r) => r.ok === null).length;
  const bad = results.filter((r) => r.ok === false).length;
  console.log(`  ${ok} pass · ${bad} fail · ${skipN} skip`);

  if (failed > 0) process.exit(1);
  if (skipN > 0 && !qaEnv.QA_OWNER_PASSWORD) {
    console.log('\n⚠️  Completar scripts/.env.qa con contraseñas para matriz completa + E2E.');
    process.exit(0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
