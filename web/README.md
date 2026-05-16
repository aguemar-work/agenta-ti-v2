# Nexora — SGTD (Agenda TI v3) · SPA Web

Aplicación web del **Sistema de Gestión de Tareas Departamental (SGTD)** para equipos de TI con roles **Jefe** y **Miembro**: planificación semanal, ejecución diaria, imprevistos, objetivos estratégicos, órdenes de trabajo formales y métricas. Marca de producto: **Nexora**.

Este directorio (`web/`) es la **SPA** del monorepo `agenda-ti_v3`. Los datos viven en **InsForge** (PostgreSQL, auth, RLS). El esquema y las migraciones están en `../db/`; las reglas de dominio y convenciones en `.cursor/rules/` (fuente de verdad: `CONTEXT.mdc`).

---

## Stack tecnológico

| Área | Tecnología |
|------|------------|
| Runtime UI | **React 19** + **TypeScript** (~6) |
| Build | **Vite 8** (vendor splitting, lazy routes, target ES2022) |
| Routing | **React Router 7** |
| Datos remotos | **TanStack Query 5** + **`@insforge/sdk` 1.2** |
| Estado cliente | **Zustand 5** (auth; `vistaStore` donde aplica) |
| Validación | **Zod 4** (`src/lib/schemas.ts`) |
| Estilos | **Tailwind CSS 3.4** + design system **Meta Canvas** (`tokens.css`, clases `mc-*`) |
| Iconos | **Lucide React** (`aria-hidden` en decorativos) |
| DnD | **`@dnd-kit/core`** — solo Mi semana (mover tareas entre días) |
| Notificaciones UI | **Sonner** + preferencias por usuario (`localStorage`) |
| Errores | **Sentry** — `VITE_SENTRY_DSN` (obligatorio en producción) |
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
| `/login`, `/forgot-password`, `/verify-reset-code`, `/reset-password` | Auth | Público | — |
| `/semana` | **Mi semana** | Jefe + Miembro | Grilla Lun–Sáb, DnD, incidencias por día, notas (drawer xl+), resumen del día |
| `/objetivos` | **Objetivos** | Jefe + Miembro | Progreso por tareas vinculadas; jefe asigna responsable |
| `/ordenes-trabajo` | **Órdenes de trabajo** | Jefe + Miembro | Flujo formal OT; tipos de trabajo (modal, jefe) |
| `/planificacion` | **Planificación** | Solo **Jefe** | Vista multi-miembro **solo lectura** — no crear/editar tareas |
| `/metricas` | **Métricas** | Solo **Jefe** | KPIs comparativos del equipo |

Redirección: `/` y rutas desconocidas → `/semana`.

**Eliminadas en V4 (no recrear):** `/tablero`, `/bitacora`, `/hoy` como página dedicada.

---

## Variables de entorno

Copiar `web/.env.example` → `web/.env` (no versionar credenciales):

| Variable | Uso |
|----------|-----|
| `VITE_INSFORGE_URL` | URL del proyecto InsForge (**obligatoria**) |
| `VITE_INSFORGE_ANON_KEY` | Clave anónima (**obligatoria**) |
| `VITE_ALLOWED_EMAIL_DOMAINS` | Opcional: whitelist de dominios de email al alta |
| `VITE_OT_MIGRATION_028` | `true` tras ejecutar `db/migrations/028_check_ot_completada_receptor.sql` (validación Zod OT completada) |
| `VITE_SENTRY_DSN` | **Producción:** DSN del proyecto Sentry (errores + performance) |
| `VITE_SENTRY_ENVIRONMENT` | Opcional: override del entorno Sentry (default `production` en build prod) |
| `VITE_ANALYTICS_ENDPOINT` | Opcional: POST para eventos de producto |
| `VITE_ANALYTICS_ENABLED` | Opcional: `true` para enviar analytics también en dev |

### Observabilidad (Sentry) — C-02

1. Crear proyecto en [sentry.io](https://sentry.io) (plan Developer gratuito) → plataforma **React** → copiar el **DSN**.
2. En **Vercel** (o el host de prod): añadir `VITE_SENTRY_DSN=https://…@….ingest.sentry.io/…` y redeploy.
3. El bootstrap en `src/lib/sentry.ts` + `main.tsx` inicializa con `environment: production`, `tracesSampleRate: 0.2` y tracing del navegador.
4. Tras login, `AuthProvider` llama `Sentry.setUser({ id, email, role })` + tag `role` para filtrar issues por rol.
5. **Alerta recomendada** (Sentry → Alerts → Create): métrica *Error rate* &gt; **1%** en ventana **5 min** → notificación email o Slack.

**Validación:** en prod, ejecutar en consola `throw new Error('sentry-smoke-test')` (o provocar un fallo en un módulo) y comprobar el issue en el dashboard en &lt; 2 min con usuario y rol visibles.

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
- **`AuthProvider`**: bootstrap, fila en `public.usuario`, verificación periódica de sesión.
- **RBAC:** rol desde tabla `usuario` (`jefe` | `miembro`). La UI oculta acciones; **RLS en Postgres** es el enforcement real (`sgtd_es_jefe()`, políticas de miembro).
- **Estado `atrasada`:** calculado en BD (trigger); la UI no debe mutarlo — solo reflejar (`estadoEfectivoTablero` para lectura).
- **Acciones con log:** bloquear, cancelar, reprogramar y eliminar tarea requieren justificación ≥10 caracteres (RPCs `sgtd_*_con_log`).

---

## Base de datos (monorepo)

| Recurso | Ubicación |
|---------|-----------|
| Schema consolidado | `../db/schema.sql` |
| Seed | `../db/seed.sql` |
| Migraciones | `../db/migrations/` |
| Guía de validación | `../db/migrations/README.md` |
| **Checklist por entorno** | `.cursor/rules/CONTEXT.mdc` → **§12 Gestión de migraciones** |

### Validar migraciones antes de desplegar

Las migraciones del repo **no se auto-registran** al pegarlas en el SQL Editor. Para saber si una migración (p. ej. **027**) ya está en un entorno:

```bash
npx @insforge/cli whoami
npx @insforge/cli current          # proyecto = Dev / Staging / Prod correcto
npx @insforge/cli db query "SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND proname = 'sgtd_marcar_atrasadas_vencidas') AS migration_027_ok"
```

- `migration_027_ok = true` → **027 aplicada** (RPC de backfill presente).
- `false` → aplicar `../db/migrations/027_fix_eliminar_atrasada_ot.sql` y luego:

```sql
SELECT public.sgtd_marcar_atrasadas_vencidas();
```

Opcional (solo migraciones internas de la plataforma InsForge, no sustituye la comprobación del proyecto):

```bash
npx @insforge/cli db query "SELECT * FROM system.migrations ORDER BY run_on DESC"
```

**Regla de oro:** al cerrar un ticket con cambios en BD, actualizar el checklist §12 en `CONTEXT.mdc` (columnas Dev / Staging / Prod).

---

## Design system

- Tokens y semántica: `src/styles/tokens.css`, `src/styles/components.css`
- Estados de tarea: `src/lib/estadoConfig.ts` (`TAREA_BADGE`, `TAREA_PILL`, `TAREA_LABEL`) — no hardcodear colores hex en TSX
- Reglas UI: `.cursor/rules/sgtd-ui-meta-canvas.mdc`, `DESIGN-SYSTEM.md`

---

## Documentación relacionada

| Recurso | Contenido |
|---------|-----------|
| **`auditorias/auditoria_16052026_final.md`** | Auditoría consolidada: estado del producto, checklist deploy, deuda abierta |
| `auditorias/minicambio_16052026.md` | Bugs operativos y Lote 2 (trazabilidad ítem a ítem) |
| `auditorias/auditoria_16052026.md` | Auditoría técnica/UX (Fase 0 tokens, dimensiones arquitectura) |
| `PROJECT_STRATEGY.md` | Visión, roadmap y deuda estratégica |
| `.cursor/rules/CONTEXT.mdc` | Stack, rutas V4, schema, RPCs, convenciones |
| `.cursor/rules/sgtd-*.mdc` | Negocio, RBAC, auth, módulos, UI |

---

## Licencia / propiedad

Proyecto privado (`"private": true` en `package.json`). Ajustar según política de la organización.
