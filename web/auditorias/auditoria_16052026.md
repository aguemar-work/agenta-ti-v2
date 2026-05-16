# AUDITORÍA DIGITAL INTEGRAL
## Agenda TI — Plataforma SGTD (Sistema de Gestión de Tareas y Desarrollo)

**Tipo de consultoría:** Chief Digital Audit · CTO + Product Designer + UX Strategist + Performance Engineer  
**Stack analizado:** React 19 + TypeScript 6 + Vite 8 + TailwindCSS 3.4 + Zustand 5 + React Query 5 + InsForge SDK (realtime vía transporte interno) + Zod 4 + MSW 2 + Sentry 10  
**Fecha de auditoría:** Mayo 2026  
**Actualización:** Fase 0 de convergencia de tokens completada

---

## RESUMEN DE CAMBIOS POST-AUDITORÍA (Fase 0)

| Problema auditado | Estado anterior | Estado actual |
|---|---|---|
| Hex duplicados en `design-tokens.css` | Hex propios, editables por separado | Eliminado — `design-tokens.css` borrado |
| Dark mode solo en `--ds-*` | `--mc-*` siempre en light → regresión segura al migrar | Eliminado con `--ds-*` |
| `StatusBadge` con colores incorrectos | `reprogramada` en cyan, `en_progreso` con brand | Deprecado, sin referencias activas |
| `.ds-status-badge` con colores incorrectos | Desalineado de `estadoConfig.ts` | Pendiente eliminar (Fase 2) |
| `vite.config.ts` sin build config real | Defaults implícitos, sin vendor splitting | ✅ Resuelto — plugin React, `es2022`, `manualChunks`, sourcemap |
| `TAREA_PILL` con hex directos en Tailwind | `bg-[#EEEDFE] text-[#3C3489]` etc. | ✅ Resuelto — tokens `--mc-state-*` nuevos + clases `.mc-tarea-pill--*` |
| `.ds-status-badge` en `components.css` | ~77 líneas huérfanas | ✅ Ya eliminado en Fase 0/sesión anterior |
| Lazy loading de páginas | Auditado como pendiente | ✅ Ya existía — `React.lazy` + chunks confirmados en build |
| Dos sistemas de tokens en paralelo | `--mc-*` + `--ds-*` sin plan | Solo `--mc-*` activo; plan V4 documentado |

**`npm run build` confirma: sin errores tras Fase 0.**

---

## DIAGNÓSTICO GENERAL

Agenda TI es una plataforma de gestión de tareas para equipos de TI con roles jefe/miembro. Técnicamente madura para su escala: design system propio (Meta Canvas), sistema de permisos frontend, DnD funcional, real-time vía socket, separación clara hooks/api/lib.

**Estado general: 7.1/10** *(mejorado desde 6.8 tras Fase 0)*

La base es sólida. La deuda técnica principal ahora se concentra en: ausencia de build config para producción real, zero lazy loading de páginas, validación de permisos solo en frontend, y deuda de tokens remanente en `TAREA_PILL` y `.ds-status-badge`.

---

## DIMENSIÓN 1: ARQUITECTURA Y DESARROLLO

### 1.1 Stack y versiones

**Fortalezas:**
- React 19 + TypeScript 6: stack de vanguardia.
- React Query 5: gestión de estado servidor con invalidación por query key.
- Zod 4: validación en runtime en el cliente.
- MSW 2: mocking desacoplado para desarrollo y tests.
- Sentry 10: monitoreo de errores integrado.

**Problemas detectados:**

🔴 **CRÍTICO — vite.config.ts incompleto para producción:**
El archivo actual es solo config de Vitest. No hay `plugins: [react()]`, `build.rollupOptions`, ni `build.target`. Sin esto: sin code splitting manual, sin optimización de chunks, sin target de browser definido. Si el build funciona, es por defaults implícitos.

🔴 **CRÍTICO — Sin lazy loading de páginas:**
Todas las páginas importan directamente en `App.tsx`. Con 9 páginas + componentes pesados (DnD, OTImpresion), el bundle inicial carga todo. Solución: `React.lazy()` + `<Suspense>`.

🟡 **ALTO — `TAREA_PILL` con hex directos (deuda Fase 1):**
`estadoConfig.ts` tiene `TAREA_PILL` con valores como `bg-[#EEEDFE] text-[#3C3489]` para `reprogramada`. Estos hex deben migrarse a `--mc-state-reprogramada-*` en Fase 1. No extender este patrón en código nuevo.

🟡 **ALTO — `.ds-status-badge` todavía en `components.css` (deuda Fase 2):**
El bloque (~77 líneas) existe en el CSS aunque sin referencias activas. Aumenta el bundle sin necesidad y confunde a nuevos desarrolladores. Eliminar en Fase 2.

🔵 **MEDIO-BAJO — Reconexión realtime no cubierta tras conexión inicial:**
La app no usa Socket.io directamente — el realtime va vía `getInsforge().realtime` del SDK InsForge. `useRealtimeNotificaciones.ts` implementa 3 reintentos al conectar (2 s → 4 s → 8 s) pero no cubre reconexión si la sesión se cae *después* de conectar (WiFi, suspensión móvil, cambio de red). El impacto es **solo en toasts e invalidaciones de caché** — los datos persisten en PostgreSQL y TanStack Query los recupera en el siguiente refetch. Para 4–8 usuarios en red corporativa el riesgo es bajo; sube a medio si el jefe trabaja desde móvil esperando alertas instantáneas de OTs o incidencias.

🟡 **ALTO — `@insforge/sdk` como dependencia opaca:**
`@insforge/sdk@1.2.5` en producción sin documentación interna de endpoints, datos transmitidos ni SLA. Riesgo de mantenibilidad y seguridad.

✅ **RESUELTO — `@tabler/icons-react` eliminado:**
Migrado a Lucide en `AppShell.tsx`. Eliminado de `package.json`. vendor-icons: ~8.0 → ~6.6 KB gzip. Módulos transformados en build: ~8 500 → ~2 350.

✅ **RESUELTO — Interceptor de errores de API ampliado:**
`insforgeFetchInterceptor.ts`: timeout 30 s, 2 reintentos (500 ms / 1 s) en red caída o códigos 408/502/503/504. Flujo 401 → refresh → logout intacto. Circuit breaker descartado para V4 (4–8 usuarios, SPA interna) — complejidad sin beneficio claro en esta escala. TanStack Query sigue gestionando reintentos de queries.

✅ **RESUELTO — TypeScript strict ampliado:**
`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride` añadidos a `tsconfig.app.json`. 26 errores corregidos + `override` en error boundaries. `strict: true` ya estaba; el chequeo es ahora más exhaustivo y el build pasa.

🔵 **MEDIO — `tailwindcss: 3.4.17` mientras existe v4:**
Tailwind 4 mejora el tiempo de build 5–10x y resolvería los conflictos entre `@layer components` y los tokens `--mc-*`.

### 1.2 Seguridad

✅ **HALLAZGO INCORRECTO — Permisos enforceados por RLS en BD:**
`permisos.ts` es solo UX (qué CTAs mostrar). El enforcement real está en Row-Level Security de PostgreSQL: `sgtd_es_jefe()` y políticas de miembro con `asignado_a = auth.uid()` en `db/schema.sql` + migración `005`. Una llamada directa a la API no omite permisos mientras RLS esté activo. Paridad documentada en `permisosBackend.ts` con tests en `permisos.rls-paridad.test.ts`.

✅ **HALLAZGO DESACTUALIZADO — Headers de seguridad ya existían y se ampliaron:**
`vercel.json` ya tenía `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`. Ampliado con CSP completo: `default-src 'self'`, `connect-src 'self' https://*.insforge.app wss://*.insforge.app`, `frame-ancestors 'none'`.

✅ **ACLARADO — Sin JWT en localStorage:**
`authStore.ts` guarda solo `authUser` + fila `usuario` en memoria Zustand (sin persistencia). El token lo gestiona el SDK InsForge con `autoRefreshToken: true`; `persistSession` no existe en v1.2.5 y fue removido. Mitigaciones V4 activas: CSP, interceptor 401, sin secretos en Zustand. `httpOnly` cookies requerirían proxy de auth propio — fuera de alcance para SPA + InsForge BaaS.

### 1.3 Performance (estimado)

✅ **RESUELTO — Bundle optimizado (C1+C2):**
Vendor splitting + lazy routes confirmados en build. vendor-react ~220 KB, vendor-insforge ~164 KB, schemas ~65 KB, páginas como chunks separados.

✅ **RESUELTO — `@dnd-kit` lazy-loaded:**
`MiSemanaGrillaDnD.tsx` extraída con `React.lazy` + `Suspense`. Build genera `MiSemanaGrillaDnD-*.js` + `vendor-dnd-*.js` (~53 KB) como chunks separados. `index-*.js` sin referencias a `@dnd-kit`. `useSemanaDnD` importa solo tipos de `@dnd-kit/core` (sin runtime en bundle principal).

---

## DIMENSIÓN 2: UX/UI Y CONVERSIÓN

### 2.1 Fortalezas UX

- Design system coherente con jerarquía visual clara (post-Fase 0: solo `--mc-*`).
- Modales con `hasUnsavedChanges` + confirmación de descarte — previene pérdida de datos.
- Focus trap + Escape en modales — accesibilidad de teclado correcta.
- `EmptyState` contextual.
- Skeletons para loading states.
- Indicadores de carga semanal (dots de color con `title` / `aria-label`).

### 2.2 Problemas detectados

✅ **RESUELTO — Escala de z-index + `stackLevel` en Modal:**
El flujo cierra el modal padre antes de abrir el hijo (sin apilamiento real). El riesgo era el drawer (z-60) quedando sobre el modal (z-50). Solución: escala definida en `tokens.css` — modal 70, stack 80, top 90, drawer 60, bottom nav 40. Prop `stackLevel` (0 | 1 | 2) en `<Modal>` con clases `.mc-modal-overlay--stack` / `--top`. Modales secundarios (completar tarea, rechazar OT) usan `stackLevel={1}`. Para apilamiento real futuro, se recomienda `ModalStackProvider`.

✅ **RESUELTO — Jerarquía de bottom nav por frecuencia de uso:**
Miembro (3 rutas): Semana · Órdenes · Objetivos — caben en barra, sin drawer "Más". Jefe (5 rutas): Semana · Planificación · Órdenes · Objetivos en barra; solo Métricas en drawer "Más". Criterio: Métricas es vista retrospectiva (semanal), no de uso diario. Revertible en una línea (`BOTTOM_NAV_JEFE` en `AppShell.tsx`) si el patrón de uso cambia.

🔵 **POSTERGADO — Tour de onboarding (decisión de producto):**
No necesario en V4 para equipo interno que ya conoce el proceso. Tiene sentido si entran usuarios nuevos frecuentemente o hay que formar en DnD/OT sin acompañamiento. Alternativas más ligeras identificadas: empty states con línea de ayuda, tooltip en primera incidencia, documentación interna (Confluence/Notion). No implementado en esta iteración.

🔵 **MEDIO — `FilterBar` sin persistencia de estado visible:**
No queda claro si los filtros persisten entre navegaciones. Si están en estado local del componente, se pierden al cambiar de página. Migrar a `useSearchParams`.

✅ **RESUELTO — `CargaIndicator` accesible en móvil:**
En `MiSemanaGrillaDnD`: texto visible en <768px ("Carga baja · 3 tareas"); punto + `sr-only` en desktop. Sin cambio visual en escritorio.

✅ **RESUELTO — Planificación adaptada para móvil:**
KPIs en grid 2×2 en móvil (`.mc-planificacion-kpis`). Secciones secundarias (actividad, incidencias, log) envueltas en `PlanificacionSection` como `<details>` colapsables en móvil; en desktop siguen siempre abiertos. Heatmap + KPIs visibles arriba sin cambio.

### 2.3 Accesibilidad

✅ **RESUELTO — `TareaEstadoIndicator`: icono + patrón por estado:**
Nuevo componente `TareaEstadoIndicator` en `components/tareas/`. Cada estado tiene icono Lucide distinto (círculo → pendiente, play → en progreso, check → completada, candado → bloqueada, alerta → atrasada, calendario → reprogramada, ban → cancelada) + texto vía `TAREA_LABEL`. Variant pill añade patrones extra: borde punteado, discontinuo, barra izquierda, tachado. Integrado en `TaskItem`, `DraggableTareaSemana`, `ModalDetalleTareaSemana`, `Objetivos`, `Planificacion`.

✅ **RESUELTO — `LiveRegion` global + `announcePolitely()`:**
`LiveRegion` (`role="status"`, `aria-live="polite"`, `aria-atomic="true"`) montada en `AppProviders`. `announcePolitely()` llamada desde `useRealtimeNotificaciones` en paralelo con cada toast: tarea asignada, OT aprobada/rechazada, tarea completada, OT nueva, incidencia. Los lectores de pantalla anuncian el mismo mensaje que el usuario ve en el toast.

✅ **RESUELTO — `aria-describedby` en modales destructivos:**
`<Modal>` ampliado con props `description` (párrafo descriptivo con id generado) y `descriptionElementId` (enlaza párrafo ya visible en el cuerpo). Aplicado en: `ModalConfirmar`, `ModalBloquear`, `ModalReprogramar`, `ModalJustificacion`, `ModalCompletarTarea`, vista eliminar de `ModalDetalleTareaSemana` (`ELIM_HINT_ID`) y overlay de descartar cambios (`alertdialog`).

---

## DIMENSIÓN 3: SEO TÉCNICO

> **Aplica solo a páginas públicas.** Sistema interno: no relevante. Dimensión retirada de la auditoría activa.


## DIMENSIÓN 4: ESTRATEGIA DE NEGOCIO

✅ **RESUELTO — `analytics.ts`: capa de analytics de producto:**
Complementa Sentry con eventos de adopción: `page_view` (módulo), `modal_open` / `modal_close` (abandono vs. completado + `durationMs`), `onboarding` (shown/step/completed/dismissed), `feature_discovery`. En dev: logs en consola `[analytics]`. En prod: `sendBeacon` a `VITE_ANALYTICS_ENDPOINT` (PostHog proxy, ingest propio, etc.). Breadcrumbs en Sentry por evento para correlacionar errores con flujos. `<Modal>` acepta `analyticsId`; modales clave ya instrumentados (`modal-mi-semana-nuevo`, `modal-nueva-tarea`, `modal-ot-form`, etc.). Éxito: `markModalCompleted('modal-id')` antes de cerrar.

✅ **RESUELTO — `OnboardingWelcome` + `ValuePropositionBanner`:**
Tour de bienvenida en primera sesión: 3 pasos para jefe (Objetivos → Métricas → OT), 2 para miembro. `ValuePropositionBanner` dismissible por usuario en Objetivos, Métricas y Órdenes de Trabajo — el mensaje de valor llega al entrar al módulo sin cambios estructurales en la nav.

✅ **RESUELTO — OT destacada en tour y banner:**
Aprobación, rechazo e impresión destacados en el paso 3 del tour (jefe) y en el banner de `/ordenes-trabajo`. El diferenciador B2B queda visible al primer uso sin cambios en la navegación.

✅ **RESUELTO — Preferencias de notificación por usuario:**
Icono de campana en sidebar y topbar móvil → modal de preferencias con toggles por tipo de evento. Persistencia en `localStorage` (`nexora_notif_prefs_v1_<userId>`). `useRealtimeNotificaciones` respeta los toggles: la invalidación de queries sigue activa aunque el toast esté desactivado.
Deuda menor: preferencias solo en el navegador actual. Migración `027` podría añadir `preferencias jsonb` en `usuario` para sincronización entre dispositivos.

---

## DIMENSIÓN 5: ROADMAP

### Problemas críticos (resolver antes del próximo deploy)

| # | Problema | Esfuerzo |
|---|---|---|
| ~~C1~~ | ~~`vite.config.ts` sin config de build~~ | ✅ Resuelto |
| ~~C2~~ | ~~Sin lazy loading de páginas~~ | ✅ Ya existía antes de la auditoría — `React.lazy` en las 9 rutas, `index` ~19 KB; mejora añadida: `OTImpresion` lazy dentro de OrdenesTrabajo (~41→~32 KB), `PageSpinner` con `.mc-page-loading` |
| C3 | Sin headers de seguridad en `vercel.json` | Bajo (0.5 días) |
| C4 | Sin `<title>` dinámico | Bajo (0.5 días) |
| C5 | Sin `robots.txt` | Bajo (0.25 días) |
| ~~C6~~ | ~~Permisos solo en frontend~~ | ✅ Hallazgo incorrecto — RLS en BD; tests de paridad añadidos |

### Quick wins (1–3 días)

~~**QW1 — Lazy loading de páginas:**~~ ✅ Resuelto junto con C1. `React.lazy` ya existía en `App.tsx`; vendor splitting explícito añadido vía `manualChunks`.

> **Siguiente paso sugerido (C1):** añadir `browserslist` en `package.json` y enlazarlo a `build.target` para documentar soporte de navegadores corporativos de forma explícita y reproducible.

**QW2 — Títulos dinámicos:**
```tsx
// hooks/usePageTitle.ts
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} — Agenda TI`;
    return () => { document.title = 'Agenda TI'; };
  }, [title]);
}
```

~~**QW3 — Headers de seguridad en `vercel.json`:**~~ ✅ Hallazgo desactualizado — ya existían. Ampliados con CSP completo (`default-src`, `connect-src`, `frame-ancestors 'none'`).

> **Siguiente paso sugerido (C1):** añadir `browserslist` en `package.json` y enlazarlo a `build.target` para documentar soporte de navegadores corporativos de forma explícita y reproducible.

**QW2 — Títulos dinámicos:**
```tsx
// hooks/usePageTitle.ts
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} — Agenda TI`;
    return () => { document.title = 'Agenda TI'; };
  }, [title]);
}
```

**QW3 — Headers de seguridad en `vercel.json`:**
```json
{
  "headers": [{
    "source": "/(.*)",
    "headers": [
      { "key": "X-Frame-Options", "value": "DENY" },
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
      { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
    ]
  }]
}
```

**QW4 — Eliminar `@tabler/icons-react`:**
Reemplazar imports con equivalentes en Lucide. Ahorro estimado: ~40KB de bundle.

~~**QW5 — Eliminar `.ds-status-badge`:**~~ ✅ Ya eliminado en sesión anterior.

**QW6 — `aria-live` para notificaciones:**
```tsx
<div aria-live="polite" aria-atomic="true" className="sr-only" id="notif-announcer" />
// Al llegar notificación vía socket:
document.getElementById('notif-announcer')!.textContent = mensaje;
```

~~**QW7 — Migrar `TAREA_PILL` hex a tokens:**~~ ✅ Resuelto. Tokens nuevos `--mc-state-pendiente-*` y `--mc-state-cancelada-*` añadidos a `tokens.css`. Clases `.mc-tarea-pill--*` en `components.css`. `TAREA_PILL` en `estadoConfig.ts` migrado a clases sin hex. `Planificacion.tsx` simplificado.

### Mejoras estratégicas (2–6 semanas)

~~**M1 — Analytics de producto:**~~ ✅ Resuelto. `analytics.ts` con `page_view`, `modal_open/close`, `onboarding`, `feature_discovery`. Siguiente paso: conectar `VITE_ANALYTICS_ENDPOINT` a PostHog/Plausible e instrumentar más modales (detalle tarea, reprogramar) si se necesita.

**M2 — Endurecer reconexión realtime (si el jefe usa móvil activamente):**
Sin reimplementar Socket.io a mano, en `useRealtimeNotificaciones.ts` añadir dos listeners del entorno:
```ts
// Al recuperar red o volver a la pestaña, reconectar y refrescar queries críticas
window.addEventListener('online', handleReconnect);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') handleReconnect();
});

function handleReconnect() {
  // si el SDK expone connect(), llamarlo
  queryClient.invalidateQueries({ queryKey: ['tareas'] });
  queryClient.invalidateQueries({ queryKey: ['ot'] });
}
```
Esto cubre el caso LATAM/móvil (WiFi, suspensión, cambio de red) sin depender de APIs internas del SDK. El realtime sigue siendo una capa de toasts + invalidaciones, no la fuente de verdad — los datos persisten en PostgreSQL y se recuperan en el refetch.

**No bloquear V4 por esto.** El QA mínimo es R3: la app no crashea al perder red y los datos son consistentes al volver.

~~**M3 — Persistencia de filtros en URL:**~~ ✅ Resuelto. Hook `useFilterSearchParams` en `lib/`; Métricas y OTs migradas.

**M4 — Error boundaries por página:**
`PageErrorBoundary` complementario a `SectionErrorBoundary` con fallback que permita recargar sin perder el shell.

**M5 — Resumen semanal automático:**
Digest de: tareas completadas, atrasadas, bloqueos activos, objetivos avanzados. Enviable por email o notificación push.

### Recomendaciones premium (2–6 meses)

~~**P1 — Migración a Tailwind 4:**~~ 🚫 Descartado — incompatible con InsForge MCP y la convivencia de `tokens.css` / `@layer`. Decisión documentada en `tailwind.config.js`.

**P2 — Style Dictionary para tokens:** Generar `tokens.css` desde JSON único. Elimina la deuda de `--mc-*` / `--ds-*` de raíz y permite exportar a Figma.

**P3 — Permisos isomórficos:** Librería compartida frontend/backend (si backend es Node) con las mismas reglas de `permisos.ts`.

**P4 — Virtualización de listas:** `@tanstack/react-virtual` para backlogs de >200 tareas.

**P5 — Modo offline con Workbox:** `vite-plugin-pwa` + Service Worker para cachear páginas principales. Muestra datos stale en conexión lenta con indicador "Actualizando…".

---

## HERRAMIENTAS RECOMENDADAS

| Área | Herramienta |
|---|---|
| Performance | Lighthouse CI en pipeline + WebPageTest |
| Bundle | `rollup-plugin-visualizer` |
| Accesibilidad | axe DevTools (extensión) + VoiceOver/NVDA |
| Seguridad | Mozilla Observatory + Snyk |
| Analytics | PostHog (auto-hosteable) |
| Monitoreo | Sentry (ya integrado) — configurar alertas por umbral |
| TypeScript | `tsc --noEmit --strict` en CI |
| Tests | Vitest (ya integrado) — subir cobertura de `lib/` a >80% |

---

## PRIORIDADES CONSOLIDADAS

| Prioridad | Ítem | Días |
|---|---|---|
| ✅ Resuelto | vite.config.ts + vendor splitting (C1) · lazy loading ya existía (C2 desactualizado) · `OTImpresion` lazy + `.mc-page-loading` como mejora | — |
| ✅ Resuelto | Headers de seguridad — CSP completo ya existía · `robots.txt` no aplica (sistema interno) | — |
| 🚫 No aplica | Títulos dinámicos — sistema interno, SEO no relevante | — |
| ✅ Hallazgo incorrecto | Permisos enforceados por RLS en BD; paridad documentada + tests | — |
| ✅ Resuelto | Eliminar `@tabler/icons-react` — migrado a Lucide en `AppShell` | — |
| ✅ Resuelto | Eliminar `.ds-status-badge` (ya eliminado en sesión anterior) | — |
| ✅ Resuelto | Migrar `TAREA_PILL` a tokens — `.mc-tarea-pill--*` + `--mc-state-pendiente/cancelada-*` | — |
| 🟡 Alto | Documentar `@insforge/sdk` | 1 |
| ✅ Resuelto | Analytics de producto — `analytics.ts` + `modal_open/close` + breadcrumbs Sentry | — |
| 🔵 Medio-bajo | Reconexión realtime (online/visibilitychange) | 0.5 |
| ✅ Resuelto | Preferencias de notificación — campana + modal + `localStorage`; queries intactas | — |
| ✅ Resuelto | `aria-live` — `LiveRegion` global + `announcePolitely()` en todos los toasts realtime | — |
| ✅ Resuelto | Filtros en URL — `useFilterSearchParams`; Métricas + OTs | — |
| 🔵 Medio | PageErrorBoundary | 1 |
| 🚫 Descartado | Tailwind v4 — incompatible con InsForge MCP + `@layer`; decisión documentada | — |
| ⚪ Bajo | React Virtual para listas grandes | 2 |
| ✅ Resuelto | Modales anidados / z-index — escala tokens.css + prop `stackLevel` en `<Modal>` | — |
| ✅ Resuelto | Bottom nav jefe — Métricas a drawer "Más"; Objetivos a barra; miembro sin "Más" | — |
| ✅ Resuelto | Onboarding — `OnboardingWelcome` (3/2 pasos) + `ValuePropositionBanner` en Objetivos/Métricas/OT | — |
| ✅ Resuelto | `CargaIndicator` texto visible en móvil / `sr-only` en desktop | — |
| ✅ Resuelto | Planificación móvil — KPIs 2×2; secciones secundarias como `<details>` colapsables | — |
| ✅ Resuelto | Estados de tarea — `TareaEstadoIndicator` (icono + patrón por estado) | — |
| ✅ Resuelto | `aria-describedby` en modales destructivos — 6 modales + overlay descartar | — |
| ⚪ Bajo | Modo offline con Workbox | 3 |

---

## CONFIGURACIÓN DE VARIABLES DE ENTORNO

```bash
# Errores (ya existente)
VITE_SENTRY_DSN=https://...

# Analytics de adopción — ingest propio, PostHog proxy, Plausible, etc.
VITE_ANALYTICS_ENDPOINT=https://tu-collector/events
# VITE_ANALYTICS_ENABLED=true   # opcional en dev (por defecto solo console.log)
```

**Deuda menor abierta:** preferencias de notificación solo persisten en el navegador actual (`localStorage`). Si se necesita sincronización entre dispositivos, la migración `027` puede añadir `preferencias jsonb` en la tabla `usuario`.


*Auditoría generada con análisis directo del código fuente. Actualizada tras Fase 0 de convergencia de tokens (Mayo 2026). Los estimados de esfuerzo asumen 1 desarrollador senior familiarizado con el stack.*