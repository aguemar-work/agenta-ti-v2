# Nexora — SGTD (Agenda TI v3) · SPA Web

Aplicación web del **Sistema de Gestión de Tareas Departamental (SGTD)** orientado a planificación semanal, ejecución diaria, objetivos estratégicos, órdenes de trabajo e indicadores para equipos con roles **Jefe** y **Miembro**. Marca de producto: **Nexora**.

Este directorio (`web/`) es la **SPA** del monorepo `agenda-ti_v3`; el backend de datos es **InsForge** (Postgres, auth, RLS). La convención de dominio y reglas de negocio viven en `.cursor/rules/` y en `web/CONTEXT/`.

---

## Stack tecnológico

| Área | Tecnología |
|------|------------|
| Runtime UI | **React 19** + **TypeScript** (~6) |
| Build | **Vite 8** |
| Routing | **React Router 7** |
| Datos remotos | **TanStack Query 5** + **`@insforge/sdk`** |
| Estado cliente | **Zustand 5** |
| Validación | **Zod 4** (`src/lib/schemas.ts`) |
| Estilos | **Tailwind CSS 3.4** + tokens CSS (`tokens.css`, `design-tokens.css`, clases `mc-*`, `ds-*`) |
| Iconos | **Lucide React** + **Tabler Icons** (navegación shell) |
| DnD | **`@dnd-kit/core`** (Mi semana: arrastre entre días) |
| Notificaciones UI | **Sonner** |
| Errores | **Sentry** (`@sentry/react`) — opcional vía `VITE_SENTRY_DSN` |
| Tests | **Vitest** + Testing Library |

---

## Estructura del código (`src/`)

```
src/
├── api/           # Acceso InsForge: tablas, RPCs, parseo con Zod
├── components/    # UI reutilizable, layout, semana, tareas, OT, routing…
├── hooks/         # Orquestación por vista (useMiSemanaPage, usePlanificacionPage, …)
├── lib/           # insforge, fechas, permisos, schemas, queryHelpers, tableroEstado…
├── pages/         # Rutas (carga diferida desde App.tsx)
├── providers/     # AuthProvider, AppProviders (Query + Router)
├── store/         # authStore, vistaStore
├── styles/        # tokens, shell, components, forms, layout, tasks, design-tokens
└── types/         # Modelos alineados con Postgres
```

**Nota de arquitectura:** las reglas del producto sugieren módulos en `src/features/<modulo>/`; hoy la mayoría del código sigue el patrón **`pages/` + `hooks/` + `api/`**. Nuevas piezas pueden migrarse gradualmente a `features/` si el equipo lo adopta.

---

## Rutas y módulos

| Ruta | Página | Audiencia |
|------|--------|-----------|
| `/login`, `/forgot-password`, `/verify-reset-code`, `/reset-password` | Auth | Público |
| `/semana` | **Mi semana** — grilla semanal, tareas, eventos, incidencias, notas (drawer) | Jefe + Miembro |
| `/objetivos` | **Objetivos** — lista, detalle, tareas vinculadas, riesgo | Jefe + Miembro |
| `/ordenes-trabajo` | **Órdenes de trabajo** — flujo OT, tipos, impresión | Jefe + Miembro |
| `/planificacion` | **Planificación** — vista solo lectura para jefe | Solo **Jefe** (`JefeRoute`) |
| `/metricas` | **Métricas** — KPIs y comparativas | Solo **Jefe** (`JefeRoute`) |

Redirección por defecto: `/` → `/semana`. Rutas desconocidas → `/semana`.

---

## Variables de entorno

Crear `web/.env` (no versionar secretos reales):

| Variable | Uso |
|----------|-----|
| `VITE_INSFORGE_URL` | URL del proyecto InsForge (**obligatoria**) |
| `VITE_INSFORGE_ANON_KEY` | Clave anónima (**obligatoria**) |
| `VITE_ALLOWED_EMAIL_DOMAINS` | Opcional: whitelist de dominios de email |
| `VITE_SENTRY_DSN` | Opcional: telemetría de errores |

---

## Scripts

```bash
npm install
npm run dev          # Servidor de desarrollo (Vite)
npm run build        # tsc -b && vite build
npm run preview      # Vista previa del build
npm run lint         # ESLint
npm run test         # Vitest
npm run test:coverage
```

---

## Autenticación y datos

- Cliente **InsForge** singleton con persistencia de sesión y refresh de token (ver reglas en `.cursor/rules/sgtd-auth-session.mdc`).
- **`src/lib/insforgeFetchInterceptor.ts`**: ante **401** en `/api/database/`, intento de refresh y un reintento; si falla, cierre de sesión y redirección a `/login` (sin exponer mensajes técnicos de token al usuario).
- **`AuthProvider`**: bootstrap de usuario, sincronización con auth, comprobación periódica de sesión.
- **RBAC**: el rol autoritativo viene de la tabla `usuario` (no solo del JWT). La UI refleja permisos; **RLS en Postgres** es la garantía en datos.

---

## Documentación relacionada

| Recurso | Contenido |
|---------|-----------|
| `web/CONTEXT/CONTEXT_2026-05-11.md` | Snapshot de arquitectura V4, rutas, convenciones |
| `web/CONTEXT/auditoria_consistencia_2026-05-12.md` | Auditoría UX/UI y consistencia del design system |
| **`web/PROJECT_STRATEGY.md`** | Guía estratégica: estado, mejoras, deuda, roadmap, visión |
| `.cursor/rules/*.mdc` | Stack InsForge, RBAC, reglas de negocio SGTD, auth |

---

## Licencia / propiedad

Proyecto privado (`"private": true` en `package.json`). Ajustar según política de la organización.
