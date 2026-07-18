# Materen — SGTD (Agenda TI v3)

Monorepo de **Materen**, el **Sistema de Gestión de Tareas Departamental (SGTD)** para equipos de TI: planificación semanal, ejecución diaria, imprevistos, objetivos, órdenes de trabajo formales y métricas de cumplimiento.

**Versión actual:** V5 (multi-organización y multi-workspace) sobre base V4 (modelo de tarea v1.1, Materen Canvas).

---

## Qué incluye

| Módulo | Descripción |
|--------|-------------|
| **Mi Semana** | Grilla Lun–Sáb, incidencias del día, notas de bitácora, mover tareas entre días |
| **Planificación** | Vista multi-miembro del jefe (solo lectura) |
| **Objetivos** | CRUD con progreso por tareas vinculadas |
| **Órdenes de trabajo** | Flujo formal `borrador → pendiente → aprobada → completada` |
| **Métricas** | KPIs comparativos del equipo (jefe) |
| **Catálogos** | Clientes, proyectos y áreas (según módulos activos) |
| **Panel del dueño** | Gestión de organizaciones, usuarios y módulos (`plataforma_owner`) |

Roles operativos por workspace: **jefe** y **miembro**. El aislamiento de datos se aplica en **PostgreSQL + RLS**; la UI solo adapta visibilidad.

---

## Estructura del monorepo

| Directorio | Contenido |
|------------|-----------|
| [`web/`](web/) | SPA React 19 + Vite 8 (frontend) |
| [`db/`](db/) | Migraciones SQL (`002`–`059+`), schema de referencia, runbooks |
| [`scripts/`](scripts/) | QA automatizado contra InsForge (invitaciones, smoke tests) |
| [`web/CONTEXT/`](web/CONTEXT/) | Schema canónico, modelo de tarea, diseño V5 workspace |
| [`web/auditorias/`](web/auditorias/) | Informes de auditoría técnica y de diseño |
| [`.cursor/rules/`](.cursor/rules/) | Reglas de stack, negocio, UI y checklist de migraciones |
| [`.agents/skills/`](.agents/skills/) | Skills InsForge para agentes de código |

---

## Stack

| Capa | Tecnología |
|------|------------|
| UI | React 19, TypeScript, Vite 8 |
| Routing | React Router 7 |
| Datos | TanStack Query 5 + `@insforge/sdk` 1.2 |
| Estado cliente | Zustand 5 (`authStore`, `workspaceStore`) |
| Validación | Zod 4 |
| Estilos | Tailwind 3.4 + design system **Materen Canvas** |
| Backend | [InsForge](https://insforge.dev) — PostgreSQL, Auth, RLS, Realtime |
| Tests | Vitest + Testing Library + MSW |
| Deploy | Vercel (SPA estática) |

Patrón obligatorio en el frontend:

```
Page → useXxxPage → api/*.ts → InsForge SDK → PostgREST / RPC
```

Detalle de scripts, variables de entorno y convenciones UI: [`web/README.md`](web/README.md).

---

## Inicio rápido

### Frontend

```bash
cd web
cp .env.example .env    # completar VITE_INSFORGE_URL y VITE_INSFORGE_ANON_KEY
npm install
npm run dev
```

La app queda en `http://localhost:5173` (puerto por defecto de Vite).

### Backend (InsForge CLI)

Credenciales: app en `web/.env`, CLI en `.insforge/project.json` (no versionar secretos).

```bash
npx @insforge/cli whoami
npx @insforge/cli current
npx @insforge/cli db query "SELECT 1"
```

Skills del agente: `.agents/skills/insforge*` · Guía para agentes: [`AGENTS.md`](AGENTS.md).

---

## Rutas principales

| Ruta | Audiencia | Notas |
|------|-----------|-------|
| `/semana` | Todos | Módulo core; índice de la app |
| `/objetivos`, `/ordenes-trabajo` | Todos | Si el módulo está activo en el workspace |
| `/clientes`, `/proyectos`, `/areas` | Todos | Catálogos opcionales por módulo |
| `/planificacion`, `/metricas`, `/configuracion-empresa` | Jefe | `JefeRoute` |
| `/panel`, `/panel/usuarios` | Dueño plataforma | `PanelRoute` |
| `/login`, `/forgot-password`, … | Público | Auth y recuperación de contraseña |

Tras el login, `WorkspaceProvider` puede mostrar **invitaciones pendientes** o **selector de workspace** antes del shell operativo.

Rutas eliminadas en V4 (no recrear): `/tablero`, `/bitacora`, `/hoy`.

---

## Base de datos y migraciones

- **Fuente operativa:** [`db/migrations/`](db/migrations/) — aplicación **manual** en InsForge (SQL Editor o CLI).
- **Checklist por entorno:** [`.cursor/rules/CONTEXT.mdc`](.cursor/rules/CONTEXT.mdc) §12.
- **Schema canónico:** [`web/CONTEXT/CONTEXT.md`](web/CONTEXT/CONTEXT.md).
- **Modelo de tarea v1.1:** [`web/CONTEXT/TAREA-MODEL.md`](web/CONTEXT/TAREA-MODEL.md).
- **V5 workspace:** [`web/CONTEXT/MATEREN-V5-WORKSPACE.md`](web/CONTEXT/MATEREN-V5-WORKSPACE.md).

Migraciones recientes relevantes:

| # | Tema |
|---|------|
| 043–050 | Fundación V5: org, workspace, módulos, panel del dueño |
| 054 | Soft-delete de organizaciones |
| 055–058 | Usuarios invitados, invitaciones workspace, fix rol |
| 059 | Jefe puede gestionar módulos de su empresa |

Validación rápida (ejemplo):

```bash
npx @insforge/cli db query "SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND proname = 'sgtd_listar_modulos_organizacion') AS ok"
```

Más queries por migración: [`db/migrations/README.md`](db/migrations/README.md).

---

## QA automatizado

Scripts Node en [`scripts/`](scripts/) contra el entorno InsForge enlazado:

```bash
# Completar credenciales de prueba en scripts/.env.qa
node scripts/qa-fase-b.mjs      # Fase B — invitaciones (057 + edge invite-user)
node scripts/_smoke-fase-c.mjs  # Smoke Fase C
```

Requiere `web/.env` (`VITE_INSFORGE_*`) y `.insforge/project.json`.

---

## Comandos útiles (`web/`)

```bash
npm run dev          # desarrollo
npm run build        # tsc + vite build
npm run test         # Vitest
npm run lint         # ESLint
npm run test:coverage
```

Antes de desplegar: `npm run build` y `npm test`.

---

## Documentación

| Recurso | Contenido |
|---------|-----------|
| [`web/README.md`](web/README.md) | SPA: stack, env vars, auth, design system |
| [`web/CONTEXT/CONTEXT.md`](web/CONTEXT/CONTEXT.md) | Schema y convenciones frontend |
| [`web/PROJECT_STRATEGY.md`](web/PROJECT_STRATEGY.md) | Visión y roadmap |
| [`web/auditorias/`](web/auditorias/) | Auditorías técnica y de diseño (jun 2026) |
| [`.cursor/rules/RULES-NEXORA.mdc`](.cursor/rules/RULES-NEXORA.mdc) | Reglas globales del proyecto |

---

## Licencia

Software propietario — uso interno. Ver [`LICENSE`](LICENSE).
