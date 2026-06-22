#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
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

const BASE_URL = (webEnv.VITE_INSFORGE_URL || '').replace(/\/$/, '');
const ANON_KEY = webEnv.VITE_INSFORGE_ANON_KEY;

const IDS = {
  wsJefe: 'd945505d-f75d-4ca6-9dd6-85e0e9216087',
  orgA: '6fdb96df-d55e-44ee-9ce0-3a7183c15775',
  wsAjeno: 'f15e5851-7fef-4e96-97ed-f75316061db1',
  orgB: '3c09a31b-5f4f-4d9c-ad74-bcfd7821c937',
};

function ok(msg) { console.log(`✅ ${msg}`); }
function bad(msg) { console.log(`❌ ${msg}`); process.exitCode = 1; }

async function signIn(email, password) {
  const c = createClient({ baseUrl: BASE_URL, anonKey: ANON_KEY });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error || !data?.accessToken) throw new Error(error?.message ?? 'signIn falló');
  return data.accessToken;
}

async function rpcFetch(token, fn, params, workspaceId) {
  const res = await fetch(`${BASE_URL}/api/database/rpc/${fn}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(workspaceId ? { 'x-workspace-id': workspaceId } : {}),
    },
    body: JSON.stringify(params ?? {}),
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function expectRpcError(token, fn, params, expectToken, workspaceId) {
  const r = await rpcFetch(token, fn, params, workspaceId);
  if (r.status < 400) return { ok: false, msg: `se esperaba error y devolvió ${r.status}` };
  const msg = String(r.body?.message ?? r.body?.error ?? JSON.stringify(r.body));
  return { ok: msg.toLowerCase().includes(expectToken.toLowerCase()), msg };
}

async function main() {
  if (!BASE_URL || !ANON_KEY) throw new Error('Falta web/.env con VITE_INSFORGE_*');
  const ownerEmail = qaEnv.QA_OWNER_EMAIL || 'a.guevaramartinez@gmail.com';
  const jefeEmail = qaEnv.QA_JEFE_EMAIL || 'aguevara@nufago.com';
  const miembroEmail = qaEnv.QA_MIEMBRO_EMAIL || 'kgaytan@nufago.com';
  const ownerPw = qaEnv.QA_OWNER_PASSWORD;
  const jefePw = qaEnv.QA_JEFE_PASSWORD;
  const miembroPw = qaEnv.QA_MIEMBRO_PASSWORD;
  if (!ownerPw || !jefePw || !miembroPw) throw new Error('Faltan QA_*_PASSWORD en scripts/.env.qa');

  const ownerToken = await signIn(ownerEmail, ownerPw);
  const jefeToken = await signIn(jefeEmail, jefePw);
  const miembroToken = await signIn(miembroEmail, miembroPw);

  // Owner: puede listar y mutar org B.
  {
    const r = await rpcFetch(ownerToken, 'sgtd_listar_modulos_organizacion', { p_organizacion_id: IDS.orgB });
    if (r.status >= 400 || !Array.isArray(r.body) || r.body.length === 0) bad(`owner listar orgB: ${JSON.stringify(r.body)}`);
    else ok('owner puede listar módulos de org B');
  }

  // Jefe: togglear opcional en org A y restaurar.
  {
    const list = await rpcFetch(jefeToken, 'sgtd_listar_modulos_organizacion', { p_organizacion_id: IDS.orgA }, IDS.wsJefe);
    if (list.status >= 400 || !Array.isArray(list.body)) {
      bad(`jefe listar orgA: ${JSON.stringify(list.body)}`);
    } else {
      const row = list.body.find((r) => r.modulo === 'clientes');
      const original = Boolean(row?.activo);
      const next = !original;
      const set1 = await rpcFetch(jefeToken, 'sgtd_set_modulo_organizacion', {
        p_organizacion_id: IDS.orgA, p_modulo: 'clientes', p_activo: next,
      }, IDS.wsJefe);
      const set2 = await rpcFetch(jefeToken, 'sgtd_set_modulo_organizacion', {
        p_organizacion_id: IDS.orgA, p_modulo: 'clientes', p_activo: original,
      }, IDS.wsJefe);
      if (set1.status >= 400 || set2.status >= 400) bad(`jefe toggle opcional orgA: ${JSON.stringify(set1.body ?? set2.body)}`);
      else ok('jefe puede activar/desactivar módulo opcional en su org');
    }
  }

  // Jefe: bitacora bloqueada.
  {
    const r = await expectRpcError(jefeToken, 'sgtd_set_modulo_organizacion', {
      p_organizacion_id: IDS.orgA, p_modulo: 'bitacora', p_activo: false,
    }, 'obligatorio', IDS.wsJefe);
    if (!r.ok) bad(`jefe desactivar bitacora debía fallar: ${r.msg}`);
    else ok('jefe NO puede desactivar bitacora (P0002 esperado)');
  }

  // Jefe org A sobre org B: P0007 esperado.
  {
    const r = await expectRpcError(jefeToken, 'sgtd_set_modulo_organizacion', {
      p_organizacion_id: IDS.orgB, p_modulo: 'clientes', p_activo: true,
    }, 'permiso', IDS.wsJefe);
    if (!r.ok) bad(`jefe orgA sobre orgB debía ser P0007: ${r.msg}`);
    else ok('jefe de org A no puede gestionar módulos de org B (P0007)');
  }

  // Miembro: P0007 esperado.
  {
    const r = await expectRpcError(miembroToken, 'sgtd_set_modulo_organizacion', {
      p_organizacion_id: IDS.orgA, p_modulo: 'clientes', p_activo: true,
    }, 'permiso', IDS.wsJefe);
    if (!r.ok) bad(`miembro debía ser P0007: ${r.msg}`);
    else ok('miembro no puede gestionar módulos (P0007)');
  }
}

main().catch((e) => {
  console.error(`❌ ${e.message}`);
  process.exit(1);
});

