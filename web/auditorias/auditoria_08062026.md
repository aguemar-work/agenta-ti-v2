# Auditoría integral multidisciplinaria — Materen (SGTD / Agenda TI v3)

**Fecha:** 2026-06-08  
**Rol:** Auditor Líder + Técnico/Seguridad + Procesos/Compliance  
**Stack auditado:** React 19 + Vite 8 + TanStack Query 5 + Zustand + Zod 4 · InsForge (PostgreSQL/RLS)  
**Alcance:** monorepo `agenda-ti_v3` — SPA `web/`, SQL `db/`, configuración de despliegue

**Limitaciones:** no se verificó InsForge producción/staging (RLS aplicado, migraciones 023–040, dominios en `sgtd_config`), variables Vercel, backups de plataforma ni contratos DPA con terceros.

---

## RESUMEN EJECUTIVO

### Puntuación general: **68 / 100**

| Dimensión | Nota | Comentario breve |
|-----------|------|------------------|
| Código y arquitectura | 72 | Patrón Page→Hook→API sólido en módulos core; excepciones y deuda Kanban/DnD |
| Seguridad (SAST) | 74 | RLS + auth bien planteados; CVEs npm, CSP débil, RPC no usado en objetivos |
| BD e infraestructura | 58 | Migraciones manuales, `schema.sql` desfasado, sin CI ni runbooks |
| Cumplimiento y procesos | 52 | Sin LICENSE, sin marco Ley 29733/GDPR, PII en Sentry |

**Justificación:** la base es madura para una SPA interna (RLS, interceptor 401, Zod, sin XSS sinks, `.env` fuera de git). Los descuentos vienen de bugs funcionales, dependencias con CVE, ausencia de CI/CD y backups documentados, cumplimiento de datos personales no formalizado y drift entre código, `schema.sql` y documentación.

### Top 5 hallazgos — acción inmediata

1. **Post-login redirige a ruta eliminada `/hoy`** → usuarios pueden quedar en catch-all o pantalla incorrecta (`Login.tsx` L70).
2. **Filtro OT usa `estado: 'atrasada'`** tras modelo v1.1 (atrasada = situación) → tareas vinculables incorrectas (`useOrdenesTrabajoPage.ts` L161).
3. **`eliminarObjetivo` no usa RPC atómico** → riesgo de log huérfano y fallo de permisos miembro (`api/objetivos.ts`).
4. **5 vulnerabilidades npm** (2 altas en `react-router-dom` 7.14.1) — `npm audit` ejecutado en local.
5. **Sin pipeline CI/CD** (`.github/` ausente) + migraciones aplicadas manualmente sin verificación automática en prod.

### Esfuerzo estimado de remediación

| Fase | Alcance | Esfuerzo |
|------|---------|----------|
| Urgente (semana 1) | Bugs login/OT, `npm audit fix`, RPC objetivos, CSP connect-src | **2–3 días** |
| Corto plazo (2–4 semanas) | CI (lint+test+build), índices BD, consolidar `schema.sql`, dominio obligatorio | **8–12 días** |
| Planificado (1–2 meses) | Privacidad Ley 29733, cobertura tests, refactor hooks god-object, OpenAPI | **15–25 días** |
| **Total** | | **~25–40 días-persona** |

---

## MATRIZ DE RIESGO

| Categoría ↓ / Severidad → | CRÍTICA | ALTA | MEDIA | BAJA | INFORMATIVA |
|---------------------------|---------|------|-------|------|-------------|
| 1 — Código y arquitectura | 0 | 2 | 6 | 4 | 3 |
| 2 — Seguridad | 0 | 3 | 5 | 2 | 2 |
| 3 — BD e infraestructura | 0 | 3 | 5 | 2 | 2 |
| 4 — Cumplimiento | 0 | 2 | 3 | 1 | 1 |
| **Total** | **0** | **10** | **19** | **9** | **8** |

---

## BLOQUE 1 — CALIDAD DE CÓDIGO Y ARQUITECTURA

### Hallazgos

| ID | Sev. | Archivo/Ubicación | Descripción | Impacto | Recomendación | Prioridad |
|----|------|-------------------|-------------|---------|---------------|-----------|
| AUDIT-001 | ALTA | `web/src/pages/Login.tsx` L70 | Tras login, `navigate('/hoy')` si `from === '/login'`. `/hoy` eliminado en V4. | Usuario en ruta inválida. | Cambiar a `/semana`. | 1 |
| AUDIT-002 | ALTA | `web/src/hooks/useOrdenesTrabajoPage.ts` L161 | `.in('estado', […,'atrasada'])` — `atrasada` ya no es `estado` (migr. 040). | OT no lista tareas atrasadas reales. | Filtrar por `situacion` o `estadoEfectivoTablero`. | 1 |
| AUDIT-003 | MEDIA | `web/src/hooks/useOrdenesTrabajoPage.ts` (~425 líneas) | God-hook: queries, filtros URL, autoguardado, mutaciones. | Mantenimiento costoso. | Dividir en sub-hooks. | 2 |
| AUDIT-004 | MEDIA | `useTareas.ts`, `useMetricasOT.ts`, `usePlanificacionPage.ts`, etc. | 5 hooks llaman InsForge directo, saltando `api/*.ts`. | Rompe patrón; Zod inconsistente. | Mover queries a `api/`. | 2 |
| AUDIT-005 | MEDIA | `web/src/pages/Metricas.tsx` | Sin `useMetricasPage`; RBAC inline. | Inconsistencia con `selectEsJefe`. | Extraer hook de página. | 3 |
| AUDIT-006 | MEDIA | `TareaHistorialSection.tsx`, `PlanificacionActividad*.tsx` | Mapas `LABEL_TIPO` triplicados. | Etiquetas desincronizadas. | Centralizar en `lib/logAccionLabels.ts`. | 3 |
| AUDIT-007 | MEDIA | `Objetivos.tsx`, `OrdenesTrabajo.tsx`, `useSwipeDiaSemana.ts` | `matchMedia('767px')` duplicado. | Breakpoints divergentes. | Un solo `useIsMobile()`. | 3 |
| AUDIT-008 | MEDIA | `ModalDetalleTareaSemana.tsx` (~533 líneas) | Modal monolítico. | Difícil de testear. | Extraer subcomponentes. | 3 |
| AUDIT-009 | BAJA | `api/tablero.ts`, `hooks/useTareas.ts` | Código Kanban sin uso en app. | Ruido legacy. | Eliminar o archivar. | 3 |
| AUDIT-010 | BAJA | `web/README.md`, `.cursor/rules` | Docs mencionan DnD/`@dnd-kit` eliminado. | Onboarding incorrecto. | Actualizar a Materen/V4. | 3 |
| AUDIT-011 | BAJA | `web/src/types/index.ts` | `TipoAccionLog` incluye `bloqueada`/`desbloqueada`. | UI historial obsoleta. | Alias solo lectura histórica. | 3 |
| AUDIT-012 | INFORMATIVA | `web/src` | 0 `TODO`/`FIXME`/`HACK`. | Buena higiene. | Mantener. | — |
| AUDIT-013 | INFORMATIVA | TSX global | Sin hex hardcodeado; tokens `--mc-*`. | Cumple Materen Canvas. | Mantener. | — |
| AUDIT-014 | INFORMATIVA | Módulos core | Pages no usan `useQuery` directo. | Arquitectura predecible. | Extender a Métricas. | — |

### Evidencia AUDIT-001

```ts
// web/src/pages/Login.tsx L70
navigate(from === '/login' ? '/hoy' : from, { replace: true });
```

### Evidencia AUDIT-002

```ts
// web/src/hooks/useOrdenesTrabajoPage.ts L161
.in('estado', ['pendiente', 'en_progreso', 'atrasada'])
```

### Patrón arquitectónico — cumplimiento

| Módulo | Page → Hook → API | Estado |
|--------|-------------------|--------|
| Mi Semana | `MiSemana` → `useMiSemanaPage` → `semana.ts`, etc. | ✅ |
| Objetivos | `Objetivos` → `useObjetivosPage` → `objetivos.ts` | ✅ |
| Órdenes de Trabajo | `OrdenesTrabajo` → `useOrdenesTrabajoPage` → `ordenTrabajo.ts` | ✅ |
| Planificación | `Planificacion` → `usePlanificacionPage` → `planificacion.ts` | ✅ |
| Métricas | `Metricas` → hooks sueltos + lógica inline | ⚠️ |

---

## BLOQUE 2 — SEGURIDAD Y VULNERABILIDADES (SAST)

### Hallazgos

| ID | Sev. | Archivo/Ubicación | Descripción | Impacto | Recomendación | Prioridad |
|----|------|-------------------|-------------|---------|---------------|-----------|
| AUDIT-015 | ALTA | `package.json` — `react-router-dom@7.14.1` | npm audit: 2 HIGH (GHSA-49rj-9fvp-4h2h, GHSA-8x6r-g9mw-2r78). | RCE/DoS en cadena de deps. | `npm audit fix` + verificar build. | 1 |
| AUDIT-016 | ALTA | `web/src/api/objetivos.ts` L95–109 | `eliminarObjetivo`: log + delete sin transacción; no usa `sgtd_eliminar_objetivo`. | Log huérfano; miembro sin DELETE RLS. | Usar RPC migr. 007. | 1 |
| AUDIT-017 | ALTA | `web/src/api/usuario.ts` L13–22 | `VITE_ALLOWED_EMAIL_DOMAINS` opcional. | Provisioning abierto si migr. 023 no aplicada. | Obligar en prod + `sgtd_config`. | 1 |
| AUDIT-018 | MEDIA | `web/vercel.json` — CSP | `script-src 'unsafe-inline'`; `connect-src` sin Sentry/analytics. | XSS más fácil; telemetría bloqueada. | Ampliar CSP; nonce/hash. | 2 |
| AUDIT-019 | MEDIA | `web/src/lib/sentry.ts` | `sendDefaultPii: true` + email/rol. | PII en tercero (EE.UU.). | Desactivar PII; anonimizar. | 2 |
| AUDIT-020 | MEDIA | `web/src/lib/insforge.ts` | JWT en storage navegador (SDK). | Robo de sesión si XSS. | CSP estricta; TTL token. | 2 |
| AUDIT-021 | MEDIA | `VerifyResetCode.tsx` L70 | Token reset en router state. | Exposición en devtools. | TTL corto servidor. | 3 |
| AUDIT-022 | MEDIA | `.cursor/rules/CONTEXT.mdc` §12 | Migraciones 📅 pendientes Staging/Prod. | RLS/RPC desactualizados. | Checklist post-deploy automatizado. | 1 |
| AUDIT-023 | BAJA | `Login.tsx` L29–43 | Redirect `from` sin allowlist estricto. | Riesgo bajo same-origin. | Allowlist rutas internas. | 3 |
| AUDIT-023b | BAJA | `npm audit` — `ws`, `brace-expansion` | 3 moderadas transitivas. | DoS / memory disclosure. | `npm audit fix`. | 2 |
| AUDIT-024 | INFORMATIVA | `web/src` | Sin `dangerouslySetInnerHTML`, `eval`, `innerHTML`. | Superficie XSS baja. | Mantener. | — |
| AUDIT-025 | INFORMATIVA | `db/schema.sql`, migr. 003/005 | RLS + `sgtd_es_jefe()`. | Autorización real en BD. | Verificar en prod. | — |
| AUDIT-026 | INFORMATIVA | `.gitignore` | `.env` ignorado; solo `.env.example`. | Sin secretos en repo. | Rotar key si filtró. | — |

### npm audit (2026-06-08)

```
5 vulnerabilities (3 moderate, 2 high)

HIGH — react-router / react-router-dom 7.0.0–7.14.2
  GHSA-49rj-9fvp-4h2h (turbo-stream deserialization)
  GHSA-8x6r-g9mw-2r78 (DoS __manifest)

MODERATE — brace-expansion (dev, typescript-eslint)
MODERATE — ws 8.0.0–8.20.0 (engine.io-client / realtime)
```

### Visibilidad limitada (seguridad)

- Política contraseñas / MFA InsForge
- Rate-limit auth
- CORS InsForge
- Autorización Realtime en canales `usuario:{id}` / `equipo:{id}`
- Estado real de migraciones por entorno

---

## BLOQUE 3 — BASE DE DATOS E INFRAESTRUCTURA

### Hallazgos

| ID | Sev. | Archivo/Ubicación | Descripción | Impacto | Recomendación | Prioridad |
|----|------|-------------------|-------------|---------|---------------|-----------|
| AUDIT-027 | ALTA | Repo raíz | Sin `.github/workflows`. | Deploy sin gate automático. | CI: lint + test + build. | 1 |
| AUDIT-028 | ALTA | Repo | Sin Dockerfile, health checks, runbook backup. | RPO/RTO indefinidos. | Backup InsForge + restore probado. | 1 |
| AUDIT-029 | ALTA | `db/schema.sql` vs migr. 025–040 | `schema.sql` desfasado (recurrencia, índices, enums). | Instalaciones incompletas. | Regenerar DDL o solo migraciones. | 2 |
| AUDIT-030 | MEDIA | `api/objetivosMetricas.ts` L93–120 | Carga todas las tareas con `objetivo_id`. | Degradación con volumen. | RPC/vista agregada. | 2 |
| AUDIT-031 | MEDIA | `db/` | Sin índice `orden_trabajo(tarea_id)`. | Seq scan en Mi Semana. | Crear índice. | 2 |
| AUDIT-032 | MEDIA | `db/migrations/` | 39 SQL manuales; duplicado `040_rebind_*.sql`. | Entornos divergentes. | Tabla versiones o CI checks. | 2 |
| AUDIT-033 | MEDIA | `pages/Metricas.tsx` | 4 queries pesadas en paralelo. | Latencia jefe. | RPC consolidada + cache. | 3 |
| AUDIT-034 | BAJA | `web/vercel.json` | HSTS, X-Frame-Options, nosniff presentes. | Buena postura deploy. | Añadir Permissions-Policy. | 3 |
| AUDIT-035 | BAJA | InsForge BaaS | Sin rate limiting en capa app. | Abuso anon key. | Límites plataforma + WAF. | 3 |
| AUDIT-036 | INFORMATIVA | `web/src/api/` | Sin bucles N+1; batch `.in()` en OT. | Buen patrón fetch. | Mantener. | — |

### Visibilidad limitada (infra)

- Backups automáticos InsForge
- Monitoreo uptime / alertas
- Logs centralizados
- Variables Vercel producción

---

## BLOQUE 4 — CUMPLIMIENTO, LICENCIAS Y PROCESOS

### Hallazgos

| ID | Sev. | Archivo/Ubicación | Descripción | Impacto | Recomendación | Prioridad |
|----|------|-------------------|-------------|---------|---------------|-----------|
| AUDIT-037 | ALTA | Repo completo | Sin política privacidad, consentimiento, ARCO (Ley 29733). PII: usuario, DNI OT, justificaciones. | Incumplimiento normativo. | Aviso + base legal + ARCO con Legal. | 1 |
| AUDIT-038 | ALTA | Raíz repo | Sin `LICENSE`; `package.json` sin `license`. | Riesgo legal OSS. | LICENSE + `license-checker` en CI. | 2 |
| AUDIT-039 | MEDIA | `web/README.md` | README SPA ok; sin README monorepo raíz. | Onboarding fragmentado. | README raíz unificado. | 3 |
| AUDIT-040 | MEDIA | Repo | Sin OpenAPI/Swagger. | Sin contrato API formal. | Catálogo RPC documentado. | 3 |
| AUDIT-041 | MEDIA | migr. 024 | Logs inmutables vs derecho supresión. | Conflicto ARCO/GDPR. | Retención + anonimización. | 2 |
| AUDIT-042 | BAJA | Dependencias | Stack MIT/Apache en deps directas. | Riesgo GPL bajo. | Escanear transitivas en CI. | 3 |
| AUDIT-043 | INFORMATIVA | Vitest | 217 tests; sin umbral cobertura en CI. | Regresiones en PR. | Gate ≥60% en `api/` + `hooks/`. | 3 |

### Datos personales identificados

| Dato | Ubicación | Tratamiento actual |
|------|-----------|-------------------|
| nombre, email, rol | `public.usuario` | Auto-provision en login |
| receptor_nombre, receptor_dni | `orden_trabajo` | Obligatorio al completar OT |
| justificaciones | `log_accion` | Inmutables (migr. 024) |
| email, rol | Sentry | `sendDefaultPii: true` |
| userId, rol | Analytics opcional | `lib/analytics.ts` |

---

## PLAN DE REMEDIACIÓN SUGERIDO

### Prioridad 1 — Esta semana

| # | Acción | Responsable |
|---|--------|-------------|
| 1 | Corregir redirect `/hoy` → `/semana` (`Login.tsx`) | Auditor Técnico |
| 2 | Corregir filtro OT `atrasada` → situación/efectivo | Auditor Técnico |
| 3 | `eliminarObjetivo` → RPC `sgtd_eliminar_objetivo` | Auditor Técnico |
| 4 | `npm audit fix` + verificar build/tests | Auditor Técnico |
| 5 | Verificar migraciones críticas en prod (027, 039, 040) | DevOps |
| 6 | Obligar `VITE_ALLOWED_EMAIL_DOMAINS` en Vercel prod | DevOps |

### Prioridad 2 — Corto plazo (2–4 semanas)

| # | Acción | Responsable |
|---|--------|-------------|
| 7 | GitHub Actions: `lint`, `test`, `build` | DevOps |
| 8 | CSP: `connect-src` Sentry + analytics | Auditor Técnico |
| 9 | Índice `orden_trabajo(tarea_id)` | Líder BD |
| 10 | Consolidar `schema.sql` o documentar solo migraciones | Líder Desarrollo |
| 11 | Centralizar labels log + `useIsMobile` + limpiar dead code | Líder Desarrollo |
| 12 | Sentry: `sendDefaultPii: false` | Compliance + Técnico |

### Prioridad 3 — Planificado

| # | Acción | Responsable |
|---|--------|-------------|
| 13 | Marco Ley 29733: aviso, ARCO, registro tratamiento | Compliance / Legal |
| 14 | `useMetricasPage`, split `useOrdenesTrabajoPage` | Líder Desarrollo |
| 15 | RPC agregación progreso objetivos | Líder BD + Técnico |
| 16 | LICENSE + escaneo licencias OSS | Compliance |
| 17 | Actualizar docs Nexora→Materen, quitar DnD legacy | Líder Desarrollo |
| 18 | Runbook backup/restore + prueba anual | DevOps |

---

## FORTALEZAS DETECTADAS

1. **Arquitectura en capas** en módulos principales: Page → Hook → API → InsForge.
2. **Seguridad en profundidad:** RLS PostgreSQL + `sgtd_es_jefe()`, RPCs atómicas para tareas, trigger anti-escalada rol (031).
3. **Manejo de sesión:** interceptor 401 con refresh silencioso, verificación cada 4 min, sin errores de token al usuario.
4. **Validación defensiva:** Zod `safeParse` en capa API; sin sinks XSS en `src/`.
5. **Design system:** tokens `--mc-*` (marca Materen); sin hex en TSX.
6. **Despliegue:** `vercel.json` con HSTS, anti-clickjacking, CSP base.
7. **Tests:** 217 tests Vitest pasando (base para CI).
8. **Secretos:** `.env` gitignored; credenciales solo vía `VITE_*`; anon key no en código.

---

## REFERENCIAS ESTÁNDAR

- **OWASP Top 10 2021:** A01 (access control/RLS), A03 (injection), A05 (misconfiguration), A07 (auth).
- **CWE:** CWE-287, CWE-79, CWE-306.
- **ISO 27001:** controles de acceso, gestión de vulnerabilidades, continuidad (gaps documentados).

---

## Seguimiento remediación

| Fase | Estado | Notas |
|------|--------|-------|
| Prioridad 1 | ✅ Cerrada | 2026-06-08 |
| Prioridad 2 | ✅ Cerrada | 2026-06-08 |
| Prioridad 3 | ✅ Cerrada (código) | Legal/DevOps parcial → deuda |
| Deuda diferida | 📋 | `deuda_post_auditoria.md` + `deuda_lint_2026-06-08.md` |

### Estado por hallazgo (AUDIT-XXX)

| ID | Estado | Notas |
|----|--------|-------|
| AUDIT-001 | ✅ | Redirect `/semana` |
| AUDIT-002 | ✅ | Filtro OT `pendiente`/`en_progreso` |
| AUDIT-003 | 📋 | Split parcial OT; resto en deuda |
| AUDIT-004 | ✅ | Hooks → `api/metricas`, `ordenTrabajo`, `planificacion`, `semana`, `usuarios` |
| AUDIT-005 | ✅ | `useMetricasPage` |
| AUDIT-006 | ✅ | `logAccionLabels.ts` |
| AUDIT-007 | ✅ | `useIsMobile` |
| AUDIT-008–011 | 📋 | Deuda post-auditoría |
| AUDIT-012–014 | ✅ | Fortalezas / métricas alineadas |
| AUDIT-015, 023b | ✅ | `npm audit fix` |
| AUDIT-016 | ✅ | RPC `sgtd_eliminar_objetivo` |
| AUDIT-017 | ✅ | Dominios obligatorios en prod |
| AUDIT-018 | 🟡 | Sentry en CSP; `unsafe-inline` en deuda |
| AUDIT-019 | ✅ | `sendDefaultPii: false` |
| AUDIT-020–021, 023 | ✅/📋 | 023 allowlist `rutasInternas`; resto deuda |
| AUDIT-022 | 📋 | Staging/Prod manual §12 |
| AUDIT-024–026 | ✅ | Fortalezas |
| AUDIT-027–031 | ✅ | CI, runbook, migr. 041/042, docs schema |
| AUDIT-032–035, 033 | 📋 | Deuda post-auditoría |
| AUDIT-034 | ✅ | Permissions-Policy en `vercel.json` |
| AUDIT-036 | ✅ | Sin N+1 |
| AUDIT-037 | 🟡 | Plantilla + `/privacidad` + login; Legal pendiente |
| AUDIT-038, 042 | ✅ | LICENSE + `license:check` |
| AUDIT-039 | ✅ | `README.md` raíz |
| AUDIT-040–041, 043 | 📋 | Deuda post-auditoría |

---

*Auditoría Materen SGTD v3 — 2026-06-08. Relacionada con `audit/resumen_2026-06-06.md` (refactor tarea + diseño).*
