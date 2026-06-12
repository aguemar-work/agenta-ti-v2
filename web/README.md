# Materen — SGTD (Agenda TI v3) · SPA Web

Aplicación web del **Sistema de Gestión de Tareas Departamental (SGTD)** para equipos de TI con roles **Jefe** y **Miembro**: planificación semanal, ejecución diaria, imprevistos, objetivos estratégicos, órdenes de trabajo formales y métricas. Marca de producto: **Materen**.

Este directorio (`web/`) es la **SPA** del monorepo `agenda-ti_v3`. Los datos viven en **InsForge** (PostgreSQL, auth, RLS). El esquema y las migraciones están en `../db/`; el schema canónico en `CONTEXT/CONTEXT.md` y `CONTEXT/TAREA-MODEL.md`; reglas operativas en `.cursor/rules/CONTEXT.mdc`.

**Última revisión de este README:** 2026-06-08

---

## Stack tecnológico

| Área | Tecnología |
|------|------------|
| Runtime UI | **React 19** + **TypeScript** (~6) |
| Build | **Vite 8** (vendor splitting, lazy routes, target ES2022) |
| Routing | **React Router 7** |
| Datos remotos | **TanStack Query 5** + **`@insforge/sdk` 1.2** |
| Estado cliente | **Zustand 5** (`authStore`, `vistaStore` donde aplica) |
| Validación | **Zod 4** (`src/lib/schemas.ts`) |
| Estilos | **Tailwind CSS 3.4** + design system **Materen Canvas** (`tokens.css`, clases `mc-*`) |
| Iconos | **Lucide React** (`aria-hidden` en decorativos) |
| Mi Semana | Mover tareas entre días vía **API/RPC** (sin `@dnd-kit` en V4) |
| Notificaciones UI | **Sonner** + preferencias por usuario (`localStorage`) |
| Errores | **Sentry** — `VITE_SENTRY_DSN` (recomendado en producción) |
| Tests | **Vitest** + Testing Library + **MSW 2** (mocks) |

> **No usar Tailwind v4** — incompatible con el flujo InsForge MCP y `@layer` del proyecto.

---

## Patrón de capas (obligatorio)

```
Page (src/pages)
 └→ useXxxPage (src/hooks)     — React Query, estado UI, orquestación
 └→ api/xxx.ts (src/api)      — InsForge SDK + safeParse Zod
 └→ PostgREST / RPC (InsForge)
```

No llamar al SDK desde componentes de página ni poner lógica de negocio en JSX de rutas.

---

## Estructura del código (`src/`)

```
src/
├── api/           # InsForge: tablas, RPCs, parseo Zod
├── components/    # layout, ui, semana, tareas, ot, routing…
├── hooks/         # useMiSemanaPage, usePlanificacionPage, useOrdenesTrabajoPage…
├── lib/           # insforge, fechas, permisos, schemas, queryHelpers, tableroEstado…
├── pages/         # Rutas (React.lazy desde App.tsx)
├── providers/     # AuthProvider, AppProviders
├── store/         # authStore, vistaStore
├── styles/        # tokens.css, components.css, shell, forms…
└── types/         # Modelos alineados con Postgres
```

Nuevas piezas pueden organizarse en `features/<modulo>/` de forma gradual; el patrón vigente sigue siendo `pages/` + `hooks/` + `api/`.

---

## Rutas y módulos (V4)

| Ruta | Página | Audiencia | Notas de negocio |
|------|--------|-----------|------------------|
| `/login`, `/forgot-password`, `/verify-reset-code`, `/reset-password` | Auth | Público | Ver [UX Login](#ux-login) |
| `/semana` | **Mi semana** | Jefe + Miembro | Grilla Lun–Sáb, incidencias por día, notas (drawer xl+). Ver [UX Mi Semana](#ux-mi-semana) |
| `/objetivos` | **Objetivos** | Jefe + Miembro | Progreso por tareas vinculadas; jefe asigna responsable |
| `/ordenes-trabajo` | **Órdenes de trabajo** | Jefe + Miembro | Flujo formal OT; tipos de trabajo (modal, jefe) |
| `/planificacion` | **Planificación** | Solo **Jefe** | Vista multi-miembro **solo lectura** — no crear/editar tareas |
| `/metricas` | **Métricas** | Solo **Jefe** | KPIs comparativos del equipo |
| `/privacidad` | Aviso Ley 29733 | Público / enlazado desde login | Informativo |
| `/panel` | **Panel del dueño** | Solo **`plataforma_owner`** | Lista orgs, crear, entrar; modo panel (`modoContexto='panel'`) |
| `/panel/usuarios` | **Usuarios plataforma** | Solo **`plataforma_owner`** | Listar usuarios y asignar a organización |

Redirección: `/` y rutas desconocidas → `/semana`.

**Panel del dueño:** vista por encima de las organizaciones, separada del modo operativo. Solo visible para usuarios en `plataforma_owner`; `AppShell` oculta el nav operativo en `/panel/*`.

**Eliminadas en V4 (no recrear):** `/tablero`, `/bitacora`, `/hoy` como página dedicada.

---

## UX Login

Patrones implementados en `pages/Login.tsx`:

| Aspecto | Comportamiento |
|---------|----------------|
| Errores de credenciales | Banner global (`.mc-auth-alert`) encima de los campos; inputs sin borde rojo |
| Validación de campos | Inline bajo cada input (`mc-field-feedback` con ritmo fijo 4px/12px) |
| Botón «Entrar» | Opacity 0.5 + `cursor: not-allowed` si falta correo o contraseña (señal visual; submit no bloqueado) |
| Marca | Logo 32px dentro de la card (no bloque externo que comprima el formulario en móvil) |

Errores de auth neutros (no revelar si falló el correo o la contraseña).

---

## UX Mi Semana

Patrones en `TareaSemanaCard`, `MiSemanaHeader`, `MiSemanaToolbar`, `MiSemanaGrilla`, `ModalMiSemana`:

| Aspecto | Comportamiento |
|---------|----------------|
| Acciones en card | **Desktop:** Iniciar / ⋯ ocultos en reposo; aparecen al hover (overlay inferior). **Móvil:** siempre visibles; botón primario en `variant="secondary"` |
| Estado «Pendiente» | Círculo gris 12px sin texto; pills con color solo cuando comunican cambio (`en_progreso`, `atrasada`, etc.) |
| «Vence hoy» | **No** se muestra en la grilla semanal (la columna ya da contexto de día) |
| Selector jefe | Dropdown inline sin label «Ver semana de» (`FilterBar.Select` con `hideLabel`) |
| Contadores | Una línea compacta bajo el header; solo valores **> 0**; sin separadores `·` |
| Columnas de día | Cabecera mínima (día + número + punto en HOY); sin conteo «N tareas · M completadas» |
| Scroll en columna | Hint discreto «↓ N más» al fondo cuando hay tareas ocultas (`SemanaColumnaScrollArea`) |
| Modal crear ítem | Título «Nueva tarea» / «Nuevo evento»; fecha en campo legible `DD/MM/YYYY`; tabs pill compactos centrados |

---

## Variables de entorno

Copiar `web/.env.example` → `web/.env` (no versionar credenciales):

| Variable | Uso |
|----------|-----|
| `VITE_INSFORGE_URL` | URL del proyecto InsForge (**obligatoria**) |
| `VITE_INSFORGE_ANON_KEY` | Clave anónima (**obligatoria**) |
| `VITE_ALLOWED_EMAIL_DOMAINS` | **Obligatorio en producción:** whitelist de dominios al alta |
| `VITE_OT_MIGRATION_028` | `true` tras ejecutar migración 028 (validación Zod OT completada) |
| `VITE_SENTRY_DSN` | **Producción:** DSN del proyecto Sentry (errores + performance) |
| `VITE_SENTRY_ENVIRONMENT` | Opcional: override del entorno Sentry (default `production` en build prod) |
| `VITE_ANALYTICS_ENDPOINT` | Opcional: POST para eventos de producto |
| `VITE_ANALYTICS_ENABLED` | Opcional: `true` para enviar analytics también en dev |

### Observabilidad (Sentry)

1. Crear proyecto en [sentry.io](https://sentry.io) (plan Developer gratuito) → plataforma **React** → copiar el **DSN**.
2. En **Vercel** (o el host de prod): añadir `VITE_SENTRY_DSN=https://…@….ingest.sentry.io/…` y redeploy.
3. El bootstrap en `src/lib/sentry.ts` + `main.tsx` inicializa con `environment: production`, `tracesSampleRate: 0.2` y tracing del navegador.
4. Tras login, `AuthProvider` identifica solo `id` + tag `role` (`sendDefaultPii: false`).
5. `vercel.json` incluye `connect-src` para `*.ingest.sentry.io`. Si usas `VITE_ANALYTICS_ENDPOINT` externo, añade su host a `connect-src` en `vercel.json`.
6. **Alerta recomendada** (Sentry → Alerts → Create): métrica *Error rate* > **1%** en ventana **5 min** → notificación email o Slack.

**Validación:** en prod, ejecutar en consola `throw new Error('sentry-smoke-test')` (o provocar un fallo en un módulo) y comprobar el issue en el dashboard en < 2 min con usuario y rol visibles.

---

## Scripts

```bash
npm install
npm run dev          # Servidor de desarrollo (Vite)
npm run build        # tsc -b && vite build
npm run preview      # Vista previa del build
npm run lint         # ESLint
npm run test         # Vitest (suite completa)
npm run test:watch
npm run test:coverage
```

Tras cambios relevantes, conviene ejecutar `npm run build` y `npm test` antes de desplegar.

---

## Autenticación, permisos y datos

- Cliente **InsForge** singleton: sesión persistida y refresh automático (ver `.cursor/rules/sgtd-auth-session.mdc`).
- **`insforgeFetchInterceptor.ts`**: en **401** de `/api/database/` → refresh + un reintento → si falla, logout y `/login` (sin mensajes técnicos de token en UI).
- **`AuthProvider`**: bootstrap, fila en `public.usuario`, verificación periódica de sesión (cada 4 min).
- **RBAC:** rol desde tabla `usuario` (`jefe` | `miembro`). La UI oculta acciones; **RLS en Postgres** es el enforcement real (`sgtd_es_jefe()`, políticas de miembro).
- **Modelo tarea v1.1:** dos ejes — `estado` (4 valores) + `situacion` en `tarea_activa`. Ver `CONTEXT/TAREA-MODEL.md`.
- **Clave visual:** `claveVisualTarea()` en `lib/tableroEstado.ts` para badges y conteos.
- **Acciones con log:** cancelar, reprogramar y eliminar tarea requieren justificación ≥10 caracteres (RPCs `sgtd_*_con_log`).

---

## Base de datos (monorepo)

| Recurso | Ubicación |
|---------|-----------|
| Schema referencia | `../db/schema.sql` (puede ir desfasado; fuente operativa: migraciones) |
| Seed | `../db/seed.sql` |
| Migraciones | `../db/migrations/` (002–045+) |
| Guía de validación | `../db/migrations/README.md` |
| Runbook backup | `../db/RUNBOOK-BACKUP-RESTORE.md` |
| **Checklist por entorno** | `.cursor/rules/CONTEXT.mdc` → **§12 Gestión de migraciones** |

### Validar migraciones antes de desplegar

Las migraciones del repo **no se auto-registran** al pegarlas en el SQL Editor. Para saber si una migración ya está en un entorno, usar las queries de identificación de `CONTEXT.mdc` §12 o:

```bash
npx @insforge/cli whoami
npx @insforge/cli current          # proyecto = Dev / Staging / Prod correcto
npx @insforge/cli db query "SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND proname = 'sgtd_objetivos_con_progreso') AS migration_042_ok"
```

Ejemplos de identificadores: **027** → `sgtd_marcar_atrasadas_vencidas`; **036** → `sgtd_enviar_ot`; **042** → `sgtd_objetivos_con_progreso`.

**Regla de oro:** al cerrar un ticket con cambios en BD, actualizar el checklist §12 en `CONTEXT.mdc` (columnas Dev / Staging / Prod).

---

## Design system

- Tokens y semántica: `src/styles/tokens.css`, `src/styles/components.css`
- Estados de tarea: `src/lib/estadoConfig.ts` (`TAREA_BADGE`, `TAREA_PILL`, `TAREA_LABEL`) — no hardcodear colores hex en TSX
- Resumen ordenado: `CONTEXT/SISTEMA-DISENO.md`
- Inventario de componentes: `CONTEXT/DESIGN-INVENTORY.md`
- Reglas UI: `.cursor/rules/sgtd-ui-materen-canvas.mdc`, `.cursor/rules/DESIGN-SYSTEM.md`

Principios Materen Canvas: denso, silencioso, un solo acento interactivo (teal `--mc-color-accent`); amarillo `--mc-color-warning` solo para urgencia/atraso.

---

## Documentación relacionada

| Recurso | Contenido |
|---------|-----------|
| **`auditorias/auditoria_diseno_08062026.md`** | Auditoría de diseño UX/UI (jun 2026) — hallazgos y estado |
| **`auditorias/auditoria_16052026_final.md`** | Auditoría consolidada: producto, deploy, deuda abierta |
| `auditorias/deuda_lint_2026-06-08.md` | Deuda ESLint post-auditoría |
| `PROJECT_STRATEGY.md` | Visión, roadmap y deuda estratégica |
| `CONTEXT/CONTEXT.md` | Schema canónico y convenciones frontend |
| `CONTEXT/TAREA-MODEL.md` | Modelo tarea v1.1 (dos ejes) |
| `CONTEXT/MATEREN-V5-WORKSPACE.md` | Diseño V5: org, workspace, RBAC, módulos, panel dueño (043–050 ✅ Dev) |
| `.cursor/rules/CONTEXT.mdc` | Stack, rutas V4, RPCs, checklist migraciones |
| `.cursor/rules/sgtd-*.mdc` | Negocio, RBAC, auth, módulos, UI, OT |

---

## Licencia / propiedad

Proyecto privado (`"private": true` en `package.json`). Ajustar según política de la organización.
