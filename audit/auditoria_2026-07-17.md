# Auditoría técnica 4 dimensiones — Materen SGTD (agenda-ti_v3)

**Fecha:** 2026-07-17
**Alcance:** Seguridad (OWASP Top 10), calidad de código y arquitectura, rendimiento/escalabilidad, UX/accesibilidad (WCAG 2.1 AA). Frontend `web/` (~26.000 LOC, 319 módulos), 66 migraciones SQL en `db/migrations`, edge functions `insforge/functions/`, auditorías previas en `audit/` y `web/auditorias/`.
**Metodología:** análisis estático por 4 revisores especializados en paralelo sobre el código real; sin ejecución de la app ni verificación en vivo contra la BD (las verificaciones pendientes se listan al final). No se repiten hallazgos ya remediados en `auditoria_2026-07-13.md` salvo remediación incompleta.
**Remediación:** los ítems marcados ✅ se corrigieron el mismo día (detalle en la sección final).

---

## Resumen ejecutivo

La aplicación está en buen estado general: capas respetadas (solo `api/` importa el SDK, cero dependencias circulares, cero `any`), sin XSS ni secretos hardcodeados, CSP endurecida y aislamiento multi-org bien diseñado en RLS. **No hubo hallazgos Críticos.** Lo más serio: las notificaciones realtime de SLA se publicaban a **todos los jefes de todas las organizaciones** (fuga cross-tenant de títulos de tarea y nombres); un dump con correos reales seguía en el working tree; y `invite-user` creaba cuentas auth antes de validar permisos. En rendimiento, varias decisiones (caché desactivada por defecto, listas sin paginar, KPIs agregados en cliente) degradarán el servicio al crecer los datos. En UX la base es sólida; los problemas se concentran en contraste y teclado.

---

## Dimensión 1 — Seguridad

| # | Sev. | Hallazgo | Evidencia | Estado |
|---|------|----------|-----------|--------|
| S1 | Alta | Realtime SLA cross-org: `sgtd_publicar_equipo_jefes` publicaba a todos los jefes de la plataforma; `sgtd_escanear_sla_equipo` escaneaba sin filtro de workspace; `sgtd_resumen_sla_jefe` contaba toda la plataforma | `029_notify_sla_realtime.sql:56-79`, `039_logica_dos_ejes.sql:203-318` | ✅ migración `062` (aplicar en dev/prod) |
| S2 | Alta | `backup_completo.sql` (946 KB, 11 correos reales) y `schema_real.sql` físicamente en el working tree (remediación C3 de 2026-07-13 incompleta) | raíz del repo | ✅ movidos a `D:\projects\_privado_agenda-ti_backups\` |
| S3 | Media-Alta | `invite-user` creaba la cuenta en `auth.users` (API admin) antes del gate de autorización → cuentas huérfanas / squatting de emails por cualquier autenticado | `insforge/functions/invite-user/index.ts:83-98` | ✅ migración `063` + reorden de la función (re-desplegar) |
| S4 | Media | Árbol legacy `supabase/functions/delete-user` con `SUPABASE_SERVICE_ROLE_KEY`, divergente de la versión viva en `insforge/` | diff confirmado | ✅ eliminado (`git rm`) |
| S5 | Media | Whitelist de dominios fail-open (sin filas en `sgtd_config` permite todo) y editable por cualquier jefe | `023_seguridad_dominio_y_rls_ot.sql:42-45,84-90` | ✅ migración `064` (fail-closed + escritura solo owner) |
| S6 | Media-Baja | CORS `Access-Control-Allow-Origin: '*'` en ambas edge functions | `invite-user/index.ts:26`, `delete-user/index.ts:5` | ✅ env `ALLOWED_ORIGINS` (configurar en prod; sin env mantiene `*`) |
| S7 | Baja | Correo/UUID del dueño de plataforma hardcodeados en migración | `047_duenio_plataforma.sql:16` | Pendiente |
| S8 | Baja | Catálogo `modulos` legible por `anon` (decisión consciente de la remediación C1) | `060_fix_modulos_rls.sql:24-31` | Aceptado / revisar |
| S9 | Baja | OTP de reset viaja por `location.state` (deuda AUDIT-021) | `pages/ResetPassword.tsx:20-40` | Pendiente |

**Verificado en buen estado:** RLS multi-org consistente en tablas de dominio (043, legacy eliminado en 061); bypass superadmin centralizado (048); `delete-user` InsForge valida JWT+rol antes de la API key; sin XSS (`dangerouslySetInnerHTML`/`eval`: 0); sin secretos en código; Sentry `sendDefaultPii: false`; CSP/HSTS/X-Frame-Options en `web/vercel.json`; sin SQL dinámico inseguro; sin SSRF; trigger anti-escalada (031) y logs inmutables (024/030).

## Dimensión 2 — Calidad de código y arquitectura

| # | Sev. | Hallazgo | Evidencia | Estado |
|---|------|----------|-----------|--------|
| A1 | Alta | Migraciones manuales sin ledger; numeración 002–063 con artefactos (016 "applied_directly", 043 en 14 archivos + runner ad-hoc, 046 sin `.sql`); `db/schema.sql` congelado en 040 | `db/migrations/README.md:3`, `db/schema.sql:4-15` | Pendiente |
| A2 | Alta | `VITE_OT_MIGRATION_028` (default `false`) apaga el `superRefine` que exige receptor en OTs completadas | `lib/otComplecion.ts:12-13` | ✅ flag eliminado; validación incondicional (el CHECK de 028 validó las filas legacy) |
| A3 | Media | Zod solo en 8/20 archivos de `api/`; 55 casts `as Tipo`; tipos duplicados (interfaces + schemas) puenteados con casts | `lib/schemas.ts:120-121`, `types/index.ts` | Pendiente |
| A4 | Media | Testing: 0 tests en pages, 1 en components, 0 en edge functions; tests de `api/` asertan la forma de la llamada, no el contrato (MSW casi sin uso) | `vitest.config.ts:14` | Pendiente |
| A5 | Media | Duplicación CRUD ~90% entre catálogos (areas/clientes/proyectos: hooks y api) | `useAreasPage.ts` vs `useClientesPage.ts` | Pendiente |
| A6 | Media | `MiSemanaGrilla` recibe 32 props re-pasadas desde `MiSemana.tsx` (490 líneas) a 3 componentes más | `MiSemanaGrilla.tsx:21-53` | Pendiente |
| A7 | Media | 5 componentes saltan la capa hooks (`useEffect`+fetch manual); `AppShell` llama `signOut` directo al SDK | `ModalAsignarUsuario.tsx:62` etc. | Pendiente |
| A8 | Media | Reglas de negocio duplicadas (mín. justificación en 4+ RPCs y `constants.ts`; email/rol en edge + schemas) | `lib/constants.ts:14` | Pendiente |
| A9 | Baja | Catálogos descartan el error real en `onError` pese a existir `mensajeErrorInsforge` | `useAreasPage.ts:63` | ✅ `mensajeErrorInsforge` en los 9 `onError` de areas/clientes/proyectos |
| A10 | Baja | `AppShell.tsx` 524 líneas acumula nav/logout/prefs/realtime | — | Pendiente |

**Fortalezas:** disciplina de capas verificada (45/50 imports de `@/api` en components son `import type`); multi-tenancy por header con interceptor + query keys por workspace + invalidación centralizada; 43 tests de hooks orientados a comportamiento; cero `any` y cero ciclos en 319 módulos.

## Dimensión 3 — Rendimiento y escalabilidad

| # | Sev. | Hallazgo | Evidencia | Estado |
|---|------|----------|-----------|--------|
| P1 | Alta | `QueryClient` sin defaults → `staleTime: 0` + refetch al enfocar en ~22 de ~30 queries | `lib/queryClient.ts:4` | ✅ defaults 30 s / sin refetch on focus |
| P2 | Alta | Lista de OTs sin límite/paginación (`*` + 4 embeds), filtros y contadores en cliente, tabla sin virtualizar | `api/ordenTrabajo.ts:144-170` | ✅ `useInfiniteQuery` + `range` (páginas de 100), filtro en servidor, resumen con `count head:true`, botón "Cargar más" |
| P3 | Alta | KPIs agregados en cliente descargando filas completas; `getKpisUsuario` sin cota temporal | `api/objetivosMetricas.ts:116-253` | Pendiente |
| P4 | Alta | Policies RLS sin patrón initplan: helpers pueden ejecutarse por fila | `043_apply/06_policies.sql:90-143` | Pendiente (confirmar con EXPLAIN) |
| P5 | Media | Toda mutación de Mi Semana invalidaba 9 familias de queries (incl. OTs y KPIs) | `useMiSemana.ts:56-70` | ✅ invalidaciones escalonadas (base/métricas/completo) |
| P6 | Media | Índices faltantes: `log_accion.created_at`, `orden_trabajo (ws, created_at)`, `tarea (ws, fecha_planificada)`, `evento.organizacion_id` (migración no está en el repo) | cruce código↔schema | ✅ migración `065` (7 índices, idempotentes) |
| P7 | Media | ~~UPDATE masivo por sesión~~ — mitigado: `sgtd_marcar_atrasadas_*` son no-ops desde 039 | `039:33-54` | Mitigado (retirar la llamada del cliente) |
| P8 | Media | Reconexión realtime inestable: prefs default recreadas por render fuerzan teardown/reconnect | `useRealtimeNotificaciones.ts:70,266` | ✅ `DEFAULT_PREFS` module-level (+ test que documentaba el bug invertido a proteger el fix) |
| P9 | Media | Planificación: doble roundtrip + contadores O(n) por celda sin memo | `api/planificacion.ts:9-27` | Pendiente |
| P10 | Baja | `select('*')` en listas; post-filtrado que rompe `limit(40)` en audit; bootstrap login 3-5 RTT secuenciales; `delete-user` 3 DELETEs no transaccionales | varios | Pendiente |

**Correcto:** code-splitting completo por ruta + manualChunks; Zustand siempre con selectores; realtime event-driven (único polling: 5 min en SLA jefe); sin N+1; índices `workspace_id` en todas las tablas de dominio.

## Dimensión 4 — UX y accesibilidad

| # | Sev. | Hallazgo | Evidencia | Estado |
|---|------|----------|-----------|--------|
| U1 | Alta | 3 diálogos `aria-modal` sin focus trap/Escape/foco inicial | `NotasDrawer`, `OTDetalleMobile`, drawer de `AppShell` | ✅ hook `useDialogA11y` aplicado a los 3 (+`inert` en drawer) |
| U2 | Alta | Warning `#ffb224` como texto en modo claro ≈1.8:1 (AA: 4.5:1) en 12 reglas | `tokens.css:57`, `components.css` | ✅ token `--mc-color-warning-text` (#8a5c00 claro / #ffc53d dark) |
| U3 | Alta | Escape cerraba todos los modales apilados a la vez | `ui/Modal.tsx:175-186` | ✅ pila global `lib/modalStack.ts`; solo el tope responde |
| U4 | Media | Modal no devolvía el foco al disparador al cerrar (0/24 consumidores) | `ui/Modal.tsx` | ✅ restauración en cleanup (Modal + hook) |
| U5 | Media | Texto terciario/placeholder ≈3.9:1; danger/success/info como texto pequeño 3.2-3.9:1 | `tokens.css:30-31,56-67` | Pendiente (validar con axe) |
| U6 | Media | Errores de formulario sin `aria-describedby`/`aria-invalid` (solo 2 archivos lo hacen) | `OTFormModal.tsx:211-214` | Pendiente (generalizar patrón `JustificacionField`) |
| U7 | Media | `role="grid"` sin navegación de flechas; `PopoverMenu`/`OrgMenu` sin flechas ni foco al abrir/cerrar | `MiSemanaListaVista.tsx:313`, `PopoverMenu.tsx` | Pendiente |
| U8 | Media | Loading inconsistente: skeleton solo en Mi Semana; 8+ páginas con `<p>Cargando…</p>` sin `role="status"` | varias pages | Pendiente |
| U9 | Media | `outline: none` con reemplazo débil en selects/OTP/inputs inline | `layout.css:287`, `components.css:919-926` | Pendiente |
| U10 | Baja | Token inexistente `--mc-color-text-primary` (6 usos); obligatorios inconsistentes; `role="button"` sin Espacio en `SemanaCalendarPicker`; locale mixto; texto 10-11px; overflow tablas móvil | varios | Pendiente |

**Base sólida:** skip-link + landmarks completos; `ui/Modal` con trap/ARIA; `LiveRegion` global; 140 `aria-hidden` en iconos; flujo destructivo de org ejemplar; dark mode por tokens; `prefers-reduced-motion`.

---

## Remediación aplicada el 2026-07-17

1. **`db/migrations/062_fix_sla_realtime_workspace_scope.sql`** — `sgtd_publicar_equipo_jefes` ahora recibe `p_workspace_id` y publica solo a jefes activos de ese workspace (se elimina la firma antigua); `sgtd_escanear_sla_equipo` agrupa por workspace (resumen diario por workspace, payloads con `workspaceId`); `sgtd_resumen_sla_jefe` filtra por `sgtd_workspace_id()`. **Pendiente: aplicar en dev y prod.**
2. **`db/migrations/063_puede_invitar_rpc.sql`** + reorden de `insforge/functions/invite-user/index.ts` — nueva RPC `sgtd_puede_invitar_a_workspace` (espejo del gate de 057); la edge function la evalúa con el JWT del caller **antes** de crear la cuenta auth. **Pendiente: aplicar migración y re-desplegar la función.**
3. **PII fuera del repo** — `backup_completo.sql`, `schema_real.sql` y `db/migrations.rar` movidos a `D:\projects\_privado_agenda-ti_backups\`; árbol `supabase/functions/` eliminado del repo (`git rm`).
4. **Rendimiento** — `queryClient` con `staleTime: 30 s` y `refetchOnWindowFocus: false` globales; `useMiSemana` con invalidaciones escalonadas (`base` → `+métricas` → `+OTs`) según lo que cada mutación puede cambiar.
5. **Accesibilidad** — `lib/modalStack.ts` (pila global: Escape solo cierra el diálogo superior) + `hooks/useDialogA11y.ts` (foco inicial, trap de Tab, Escape, restauración de foco) aplicado a `NotasDrawer`, `OTDetalleMobile` y el drawer "Más módulos" de `AppShell` (con `inert` cerrado); `ui/Modal` restaura el foco al disparador al cerrar; token `--mc-color-warning-text` en `tokens.css` y 12 usos migrados en `components.css`/`shell.css`.

**Validación:** `vitest run` 532/532 en 80 archivos; `tsc -b` sin errores nuevos (35 líneas de errores preexistentes en `src/api/__tests__/*`, idénticas antes y después); ESLint limpio en los archivos tocados.

## Remediación aplicada el 2026-07-18 (segunda tanda)

6. **`db/migrations/064_config_fail_closed_owner.sql`** — trigger de dominio fail-closed (sin dominios configurados el alta se rechaza; opt-out explícito `email_domain_policy=open`) y `sgtd_config` con escritura solo `plataforma_owner`. **Pendiente: aplicar y verificar que existan filas `allowed_email_domain_%` en cada entorno.**
7. **`db/migrations/065_indices_rendimiento.sql`** — 7 índices (log_accion, orden_trabajo, tarea, evento.organizacion_id condicionado a que la columna exista).
8. **CORS por lista blanca** en `invite-user` y `delete-user` vía env `ALLOWED_ORIGINS` (coma-separada, con `Vary: Origin`); sin la env se mantiene `*`. **Pendiente: fijar `ALLOWED_ORIGINS` en el entorno de funciones y re-desplegar ambas.**
9. **Flag `VITE_OT_MIGRATION_028` eliminado** — validación de receptor incondicional (`otComplecion.ts`, `schemas.ts`, fila retirada de `web/README.md`; la línea en `.env` local queda inerte).
10. **Paginación de OTs (P2)** — `getOrdenesTrabajoTodas/Miembro` con filtro en servidor + `range` (páginas de 100), `getResumenOTs` con `count head:true`, `getOrdenTrabajoPorId` para el deep-link `abrirOtId`, `useInfiniteQuery` en `useOrdenesTrabajoQueries`, botón "Cargar más" en la página; tests de queries/page reescritos (+4 tests).
11. **P8** — `DEFAULT_PREFS` estable en `useRealtimeNotificaciones` (el test que documentaba el bug ahora protege el fix; el wrapper del test creaba un QueryClient por render y se estabilizó). **A9** — `mensajeErrorInsforge` en los 9 `onError` de catálogos.

**Validación 2026-07-18:** `vitest run` **536/536** en 80 archivos; `tsc -b` idéntico al baseline preexistente; ESLint limpio en todos los archivos tocados.

## Verificaciones pendientes (no evaluables estáticamente)

- Autorización de suscripción a canales realtime `equipo:{id}` en InsForge (¿puede un usuario suscribirse al canal de otro?). Determina el alcance residual de S1.
- `EXPLAIN (ANALYZE)` de queries bajo RLS (P4) y tamaños reales de tablas.
- `npm audit` + contraste de versiones (React 19.2, Vite 8, TS 6, Zod 4) con avisos vigentes.
- Rate limiting de edge functions y login (AUDIT-035); headers efectivos en producción.
- Estado real aplicado de migraciones por entorno (incluye ahora 062 y 063).
- Contraste con herramienta (axe/WebAIM, incl. `color-mix()`), orden de tabulación real, lectores de pantalla, zoom 200 %.

## Acciones prioritarias restantes (corto plazo)

1. Aplicar 062 + 063 en dev/prod y re-desplegar `invite-user`; probar aislamiento con dos orgs.
2. Paginación + filtro en servidor de la lista de OTs (tarea abierta).
3. KPIs a agregación server-side o acotados por fecha (P3) e índices de P6.
4. Whitelist de dominios fail-closed y escritura solo owner (S5); CORS con lista blanca (S6).
5. Runner de migraciones con ledger (`schema_migrations`) y limpieza de artefactos (A1); eliminar flag `VITE_OT_MIGRATION_028` (A2).
