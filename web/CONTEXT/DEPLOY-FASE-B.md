# Deploy — Fase B (Invitaciones 057)

**Ventana única:** migración 057 + edge functions + frontend. No desplegar piezas sueltas.

**Entornos:** dev ✅ aplicado · staging/prod → **reportar antes de aplicar** (RPCs = capa de seguridad).

---

## 1. Pre-flight

```bash
npx @insforge/cli whoami
npx @insforge/cli current          # debe ser el entorno destino
npx @insforge/cli metadata         # functions: invite-user, delete-user active
```

Checklist código en rama:

- [ ] `db/migrations/057_invitacion_workspace.sql`
- [ ] `insforge/functions/invite-user/index.ts` (InsForge admin API, RPC 057)
- [ ] `insforge/functions/delete-user/index.ts`
- [ ] Frontend: `api/invitacion.ts`, B2, modales panel, `useWorkspaceBootstrap`
- [ ] **No** existe `supabase/functions/invite-user/` (eliminado)

Prerequisitos BD: **043–056** aplicadas.

---

## 2. Base de datos (057)

**Staging/prod:** ejecutar SQL completo en SQL Editor o:

```bash
# Pegar contenido de db/migrations/057_invitacion_workspace.sql
npx @insforge/cli db query --file db/migrations/057_invitacion_workspace.sql
```

Validación inmediata:

```bash
npx @insforge/cli db query "SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='public' AND p.proname='sgtd_invitar_a_workspace') AS ok"
```

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
npx @insforge/cli functions deploy invite-user \
  --file insforge/functions/invite-user/index.ts \
  --name "Invitar usuario" \
  --description "Invita a workspace via sgtd_invitar_a_workspace (057)"

npx @insforge/cli functions deploy delete-user \
  --file insforge/functions/delete-user/index.ts \
  --name "Eliminar usuario"
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
# Completar QA_OWNER_PASSWORD, QA_JEFE_PASSWORD, QA_MIEMBRO_PASSWORD

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

Ver bloque ROLLBACK al final de `057_invitacion_workspace.sql`.

Edge: redeploy versión anterior desde git.

Frontend: revert commit del release.

---

## 7. Cierre Fase B

- [ ] `node scripts/qa-fase-b.mjs` → 0 fail en entorno destino
- [ ] E2E manual verde (§4)
- [ ] 057 marcada ✅ en CONTEXT.mdc
- [ ] 049 documentada como deprecada (sin uso en panel)

**Siguiente:** Fase C — jefe gestiona módulos de su empresa (vecino al flujo de invitación del jefe).
