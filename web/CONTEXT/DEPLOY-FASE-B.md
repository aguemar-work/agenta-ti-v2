# Deploy — Fase B (Invitaciones 057 + 058)

**Ventana única:** migraciones **057 + 058** + edge functions + frontend. No desplegar piezas sueltas.

**Entornos:** dev ✅ 057+058 aplicadas · staging/prod → **reportar antes de aplicar** (RPCs = capa de seguridad).

---

## 1. Pre-flight

```bash
npx @insforge/cli whoami
npx @insforge/cli current          # debe ser el entorno destino
npx @insforge/cli metadata         # functions: invite-user, delete-user active
```

Checklist código en rama:

- [ ] `db/migrations/057_invitacion_workspace.sql`
- [ ] `db/migrations/058_fix_trigger_rol_invitacion.sql` (**obligatoria** — sin 058 la invitación falla con trigger 031)
- [ ] `insforge/functions/invite-user/index.ts` (InsForge admin API, RPC 057; mapeo 403 en errores de dominio)
- [ ] `insforge/functions/delete-user/index.ts`
- [ ] Frontend: `api/invitacion.ts`, B2, modales panel, `useWorkspaceBootstrap`
- [ ] **No** existe `supabase/functions/invite-user/` (eliminado)

Prerequisitos BD: **043–056** aplicadas.

---

## 2. Base de datos (057 + 058)

**Orden:** aplicar **057** y luego **058** en la misma ventana (058 no sustituye 057).

**Staging/prod:** ejecutar SQL completo en SQL Editor (recomendado) o pegar cada archivo en:

```bash
# SQL Editor: db/migrations/057_invitacion_workspace.sql
# SQL Editor: db/migrations/058_fix_trigger_rol_invitacion.sql
```

Validación inmediata:

```bash
npx @insforge/cli db query "SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='public' AND p.proname='sgtd_invitar_a_workspace') AS ok_057"

npx @insforge/cli db query "SELECT pg_get_functiondef(p.oid) LIKE '%sgtd_es_plataforma_owner%' AS ok_058 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='public' AND p.proname='sgtd_proteger_rol_usuario'"
```

### Por qué 058 va en el paquete

057 inserta `public.usuario` con `rol = NULL` (rol operativo en `workspace_member`). El trigger 031 (`sgtd_proteger_rol_usuario`) lo trataba como escalada y devolvía *Solo un jefe puede asignar el rol &lt;NULL&gt;* → `invite-user` 500. 058 corrige el trigger sin relajar la escalada miembro→jefe.

### Deuda de seguridad — `usuario.rol` + políticas legacy (no bloquea Fase B)

**No es cosmética.** En `tarea`, `evento`, `objetivo`, `nota_bitacora`, `log_accion`, etc. coexisten dos caminos de autorización unidos por **OR**: políticas V5 (`sgtd_es_jefe()` → `workspace_member`) y políticas V4 (`auth_es_jefe()` → `usuario.rol = 'jefe'`). Se concede acceso si **cualquiera** pasa. Si V4 y V5 divergen, ahí vive una escalada posible.

| Componente legacy | Rol |
|-------------------|-----|
| `auth_es_jefe()` | Lee `usuario.rol = 'jefe'` |
| `sgtd_es_miembro()` | Lee `usuario.rol = 'miembro'` |
| ~13 políticas | Usan `auth_es_jefe()` en OR con políticas V5 |

Autorización canónica V5: `workspace_member.rol` vía `sgtd_es_jefe()` / `sgtd_es_miembro_activo()`. La app ya no usa `usuario.rol` para guards (solo metadata/onboarding).

**Verificación en dev (presente, no futuro):**

```bash
npx @insforge/cli db query "
  SELECT
    count(*)::int AS n_con_rol,
    count(*) FILTER (WHERE rol IS NULL)::int AS n_null
  FROM public.usuario"

# Divergencia escalatoria: usuario.rol='jefe' pero workspace_member.rol='miembro'
npx @insforge/cli db query \"
  SELECT u.email, u.rol::text, wm.rol, w.nombre
  FROM public.usuario u
  JOIN public.workspace_member wm ON wm.usuario_id = u.id
    AND wm.activo AND wm.joined_at IS NOT NULL
  JOIN public.workspace w ON w.id = wm.workspace_id
  WHERE u.rol::text = 'jefe' AND wm.rol = 'miembro'\"
```

**Dev (2026-06-19):** 6 usuarios con `rol` no nulo, **0** con `NULL`; **0** filas en el caso escalatorio jefe/miembro divergente. Sí hay divergencia inversa (owner con `usuario.rol=miembro`, `wm.rol=jefe`) — subprivilegio en legacy, no escalada. Tras 057, invitados nuevos entran con `rol = NULL`.

**Mitigación corta (fuera de Fase B, recomendada pronto):** backfill `UPDATE usuario SET rol = NULL WHERE rol IS NOT NULL` **por entorno**, solo tras dos gates:

| Gate | Qué valida | Query |
|------|------------|-------|
| Escalada = 0 | Nadie con exceso vía legacy | `usuario.rol='jefe'` ∧ `workspace_member.rol='miembro'` (ver arriba) |
| Regresión = 0 | Nadie pierde acceso que **solo** diera `auth_es_jefe()` | Usuario con `usuario.rol='jefe'` sin membresía `wm.rol IN ('jefe')` activa con `joined_at` en ningún ws |

```bash
# Regresión: jefe solo por legacy, no cubierto por V5
npx @insforge/cli db query "
  SELECT u.email, u.rol::text
  FROM public.usuario u
  WHERE u.rol::text = 'jefe'
    AND NOT EXISTS (
      SELECT 1 FROM public.workspace_member wm
      WHERE wm.usuario_id = u.id AND wm.activo AND wm.joined_at IS NOT NULL
        AND wm.rol = 'jefe'
    )"
```

Si ambos dan 0 filas → nuleo seguro en ese entorno. Dev (2026-06-19): escalada=0, regresión=0.

**Follow-up — mini-proyecto de migración (prioridad seguridad, no one-liner):**

1. Auditar divergencias en staging/prod (query arriba).
2. Nulear `usuario.rol` en datos existentes (o alinear solo si hay script de reconciliación).
3. Reescribir o eliminar las **13 políticas legacy** que usan `auth_es_jefe()` / `sgtd_es_miembro()`.
4. DROP funciones `auth_es_jefe`, `sgtd_es_miembro` (legacy).
5. DROP trigger 031 + columna `usuario.rol`.

No hacer DROP de columna antes de los pasos 3–4 — a diferencia de `workspace.tipo` (056), aquí las políticas legacy **dependen** de la columna.

Smoke obligatorios post-apply (con JWT real — ver §4):

| ID | Caso |
|----|------|
| T5 | Jefe ws A → ws B explícito → P0007 |
| T11 | Miembro operativo no puede invitar |
| T16 | Email nuevo → pendiente |
| T17 | Usuario existente → 2ª org |
| T18 | Reinvitar tras rechazo |

Actualizar checklist en `.cursor/rules/CONTEXT.mdc` §12 (columna del entorno).

---

## 3. Edge functions

```bash
npx @insforge/cli functions deploy invite-user --file insforge/functions/invite-user/index.ts --name "Invitar usuario"

npx @insforge/cli functions deploy delete-user --file insforge/functions/delete-user/index.ts --name "Eliminar usuario"
```

**PowerShell:** no uses `\` para continuar líneas (es sintaxis bash). Una línea por comando, o backtick `` ` `` al final de cada línea:

```powershell
npx @insforge/cli functions deploy invite-user `
  --file insforge/functions/invite-user/index.ts `
  --name "Invitar usuario"
```

Secrets requeridos en función (ya en proyecto): `INSFORGE_BASE_URL`, `ANON_KEY`, `API_KEY`.

Verificar:

```bash
npx @insforge/cli metadata   # invite-user description actualizada
```

---

## 4. QA en el entorno

```bash
cp scripts/.env.qa.example scripts/.env.qa
# Completar QA_OWNER_PASSWORD, QA_JEFE_PASSWORD, QA_MIEMBRO_PASSWORD (no commitear .env.qa)

node scripts/qa-fase-b.mjs
```

### E2E manual (obligatorio una vez por entorno)

1. Panel `/panel/usuarios` → **Invitar usuario** (org + rol + email nuevo `@nufago.com` o dominio real).
2. Revisar bandeja → código 6 dígitos.
3. `/forgot-password` o enlace del correo → `/verify-reset-code` → `/reset-password`.
4. `/login` con el invitado.
5. Pantalla **Invitaciones pendientes** → **Aceptar**.
6. Debe aterrizar en `/semana` (bootstrap OK).

Opcional automatizar paso 2–6:

```bash
# Tras invitar, pegar OTP del email en scripts/.env.qa:
QA_E2E_OTP_CODE=123456
node scripts/qa-fase-b.mjs
```

---

## 5. Frontend (Vercel)

Deploy SPA en la **misma ventana** que BD + functions (mismo release tag / commit).

Variables sin cambio: `VITE_INSFORGE_URL`, `VITE_INSFORGE_ANON_KEY`.

Post-deploy smoke UI:

- [ ] Panel invitar muestra org + rol
- [ ] Chip `· pendiente` en usuarios invitados
- [ ] "Invitar a otra org" no usa asignación directa (049)
- [ ] Invitado sin membresía activa ve B2, no "No tienes acceso"

---

## 6. Rollback (solo staging)

Ver bloque ROLLBACK al final de `057_invitacion_workspace.sql` y `058_fix_trigger_rol_invitacion.sql`.

Edge: redeploy versión anterior desde git.

Frontend: revert commit del release.

---

## 7. Cierre Fase B

- [ ] `node scripts/qa-fase-b.mjs` → **0 fail** (requiere `scripts/.env.qa` con contraseñas)
- [ ] E2E manual verde en navegador (§4): invitar → código → contraseña → login → aceptar → `/semana`
- [ ] 057 y **058** marcadas ✅ en CONTEXT.mdc §12
- [ ] 049 documentada como deprecada (sin uso en panel)

**Siguiente:** Fase C — jefe gestiona módulos de su empresa (vecino al flujo de invitación del jefe).
