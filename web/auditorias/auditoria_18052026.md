# Auditoría Ejecutiva Unificada — Nexora SGTD v3
**Versión:** Consolidada + Estado de implementación  
**Fecha original:** 16 de mayo de 2026 · **Última actualización:** 18 de mayo de 2026  
**Rol:** Chief Digital Auditor (CTO + CFO + Product + UX + Performance)  
**Stack auditado:** React 19 + Vite 8 + TanStack Query 5 + Zustand + Zod 4 · InsForge (PostgreSQL/RLS)

---

## Estado general del sistema: 🟡 En riesgo moderado (mejorando)

El sistema posee fundaciones técnicas sólidas y ha resuelto 5 hallazgos críticos/altos desde la auditoría inicial. Persisten bugs activos en BD pendientes de verificación manual, el QA formal sin ejecutar y 7 mejoras medias por implementar.

---

## 1. RESUMEN EJECUTIVO

### Top 3 problemas activos con mayor impacto financiero

| # | Problema | Estado |
|---|----------|--------|
| 1 | **Bugs B-01/B-03 en BD** — eliminación de tareas y marcado de `atrasada` | ⏳ Pendiente verificación en InsForge |
| 2 | **QA manual sin ejecutar** — 27 escenarios incluyendo riesgo de seguridad O4 | ⏳ Pendiente ejecución |
| 3 | **Sin CI/CD ni métricas de cobertura** — cada deploy es un riesgo no cuantificado | ⏳ En evaluación |

### Top 3 oportunidades de mayor ROI inmediato

| # | Oportunidad | ROI |
|---|-------------|-----|
| 1 | Verificar migración 027 en InsForge y ejecutar función de corrección | Alto — 30 min |
| 2 | Ejecutar checklist QA completo antes del próximo release | Alto — 4h |
| 3 | Activar analytics (`VITE_ANALYTICS_ENABLED=true`) para datos de uso real | Medio — 1h |

### Deuda técnica estimada: **Media** (bajando desde Media-Alta)
### Brecha competitiva principal: Ausencia de app móvil, notificaciones push y multi-tenant

---

## 2. DECISION LAYER ⭐

| Categoría | Hallazgos |
|-----------|-----------|
| ✅ **HACER AHORA** | C-01: Verificar migraciones en InsForge · C-04: Ejecutar QA manual |
| 📅 **PLANIFICAR** | A-01: CI/CD · A-02: Coverage · M-01→M-07: Mejoras medias · B-03: Multi-tenant (Estrategia B) |
| ⏸️ **POSPONER** | Integración calendarios externos · App nativa (PWA cubre la necesidad inicial) |
| ❌ **NO HACER** | Reintroducir `/tablero` kanban · Migrar a Tailwind v4 · Reestructurar backend InsForge |

---

## 3. HALLAZGOS — ESTADO COMPLETO

---

### 🔴 CRÍTICOS

---

#### C-01 — Bugs de base de datos activos (B-01 / B-03)
**Estado: ⏳ Pendiente verificación en InsForge**

| Campo | Detalle |
|-------|---------|
| **Problema** | El RPC `sgtd_eliminar_tarea_con_log` falla con tareas en estado `atrasada`. El trigger de BD no promueve a `atrasada` las tareas `reprogramada` con fecha vencida |
| **Descripción** | El trigger de atrasadas (migraciones 009/015) solo evalúa tareas `pendiente` y `en_progreso`. Resultado: tareas fantasma que no se pueden eliminar y métricas del jefe incorrectas |
| **Solución** | 1. Aplicar `027_fix_eliminar_atrasada_ot.sql` en SQL Editor de InsForge · 2. Ejecutar `SELECT public.sgtd_marcar_atrasadas_vencidas();` una sola vez |
| **Mejora** | Añadir en `CONTEXT.mdc` un apartado "Migraciones pendientes por entorno" con checklist. Nunca más debe existir una migración escrita sin aplicar sin visibilidad |
| **Validación** | Tarea atrasada → eliminar → éxito. Tarea reprogramada con fecha pasada → función → estado `atrasada` |

---

#### C-02 — Observabilidad en producción
**Estado: ✅ Código implementado — falta configuración en Sentry/Vercel**

| Campo | Detalle |
|-------|---------|
| **Problema** | Sin `VITE_SENTRY_DSN` configurado, los errores de producción eran invisibles |
| **Implementado** | `src/lib/sentry.ts` con `initSentry()`, `identifySentryUser()`, `clearSentryUser()`, `captureSentryException()` · `main.tsx` inicializa Sentry al arranque · `AuthProvider.tsx` vincula usuario (id, email, rol) tras login · `SectionErrorBoundary.tsx` reporta errores por sección · `.env.example` con plantilla DSN |
| **Pasos manuales pendientes** | 1. Crear proyecto en sentry.io → React → copiar DSN · 2. Vercel Production: `VITE_SENTRY_DSN=https://...` → redeploy · 3. Crear alerta: error rate > 1% en 5 min → email/Slack · 4. Smoke test: `throw new Error('sentry-smoke-test')` → aparece en dashboard < 2 min con usuario y rol |
| **Comportamiento** | Sin DSN: Sentry no se inicializa (dev local sin ruido). Con DSN: errores no capturados, boundaries y unhandled rejections al dashboard. Performance: 20% de transacciones muestreadas |

---

#### C-03 — Pérdida de borradores de Órdenes de Trabajo
**Estado: ✅ Implementado**

| Campo | Detalle |
|-------|---------|
| **Problema** | El formulario de OT solo persistía en memoria. Un F5 o sesión expirada destruía todo el trabajo |
| **Implementado** | `api/ordenTrabajo.ts`: `getBorradorOTUsuario()` · `lib/otFormDraft.ts`: helpers de formulario y texto relativo · `hooks/useOrdenesTrabajoPage.ts`: query, hidratación, autosave con debounce 2s, envío unificado · `OTFormModal.tsx`: indicador de estado en footer ("Borrador guardado hace X segundos") · `pages/OrdenesTrabajo.tsx`: cierra sin borrar el borrador en BD |
| **Flujo** | Abrir "Nueva OT" → recupera borrador existente → autoguarda cada 2s → al enviar, la misma fila pasa a `pendiente` |
| **QA sugerido** | 1. Escribir descripción → esperar 2s → ver indicador · 2. F5 → reabrir → texto persiste · 3. Enviar → OT en pendiente; nueva sesión empieza limpia |

---

#### C-04 — QA manual sin ejecutar (27 escenarios)
**Estado: ⏳ Pendiente ejecución**

| Campo | Detalle |
|-------|---------|
| **Problema** | 27 escenarios críticos sin resultado registrado. Tabla de ejecución vacía |
| **Riesgo activo** | Escenario O4 ("Miembro intenta aprobar OT vía manipulación de API") es riesgo de seguridad sin verificar |
| **Orden de ejecución** | 1. O4 (seguridad) via Postman/cliente InsForge con JWT de miembro · 2. A3/A4 (expiración y revocación de token) · 3. O1 (ciclo completo OT) · 4. D1/D2 (DnD días y atrasada) · 5. Resto en sesión de 2-3h |
| **Mejora** | Ningún deploy a producción sin fecha, ejecutor y resultados del día en el checklist. Añadir como gate manual en el futuro pipeline |

---

#### C-05 — Bloqueos críticos de layout
**Estado: ✅ Implementado**

| Campo | Detalle |
|-------|---------|
| **Problema** | Columna de miembros en `/planificacion` sin sticky. Columnas de días con overflow sin control en `/semana` |
| **Implementado** | `/planificacion`: clase `planificacion-carga-scroll` con `overflow-x: auto`, `border-collapse: separate`, clase `planificacion-celda-miembro` con `sticky left:0 z-index:10` fondo `--mc-color-surface` y sombra lateral · `/semana`: token `--mc-semana-dia-col-max-height` en `tokens.css`, constantes en `appLayout.ts`, clases `mc-semana-dia-col` y `mc-semana-dia-drop` con `overflow-y: auto`. Con 8+ tareas solo la lista hace scroll; encabezado y botón quedan fijos |
| **QA visual permanente** | S12: columna densa (>8 tareas) — scroll interno, grilla intacta · PL7: >5 miembros + scroll horizontal — nombres sticky legibles |
| **Nota de mantenimiento** | Si vuelve a romperse tras un refactor, revisar primero `border-collapse` en tabla de planificación y `overflow-hidden` en `.mc-card` de la grilla |

---

### 🟠 ALTOS

---

#### A-01 — Pipeline CI/CD inexistente
**Estado: ⏳ En evaluación**

| Campo | Detalle |
|-------|---------|
| **Problema** | Sin pipeline automatizado, cada release es manual, no reproducible y depende del entorno local |
| **Solución** | `.github/workflows/ci.yml` con: `npm ci` → `npm run lint` → `npm run test` → `npm run build`. Vercel: activar "Require CI to pass before deploying" |
| **Mejora** | Quinto paso: verificar que `VITE_SENTRY_DSN` esté presente en producción antes de permitir deploy. Si falta → pipeline falla con mensaje claro |

---

#### A-02 — Cobertura de pruebas sin métricas
**Estado: ⏳ En evaluación**

| Campo | Detalle |
|-------|---------|
| **Problema** | `coverage/` con 0 bytes. Imposible saber qué porcentaje del código crítico está cubierto |
| **Solución** | En `Vitest.config.ts` añadir: `coverage: { provider: 'v8', reporter: ['text', 'lcov', 'html'], thresholds: { lines: 70, branches: 60, functions: 70 }, include: ['src/lib/**', 'src/api/**', 'src/hooks/**'] }` |
| **Mejora** | Una vez activo, configurar regla que impida que un PR baje la cobertura respecto a `main`. La deuda se paga progresivamente sin bloquear desarrollo |

---

#### A-03 — CHECK constraint faltante en OT completada
**Estado: ✅ Cerrado en dev**

| Campo | Detalle |
|-------|---------|
| **Problema** | Una OT podía quedar `completada` sin `receptor_nombre` ni `receptor_dni` |
| **Implementado** | Migración `028_check_ot_completada_receptor.sql` con `CHECK (estado != 'completada' OR (receptor_nombre IS NOT NULL AND receptor_nombre != '' AND receptor_dni IS NOT NULL AND receptor_dni != ''))` · Validación añadida también en `OrdenTrabajoSchema` con `.superRefine()` cuando `estado === 'completada'` |
| **Validación** | INSERT directo con `estado='completada'` y `receptor_nombre=NULL` → error de constraint |

---

#### A-04 — Colores `#hex` hardcodeados + hook condicional
**Estado: ✅ Cerrado completamente**

| Campo | Detalle |
|-------|---------|
| **Problema** | Códigos `#hex` directos en componentes. Hook `useMemo` en `Objetivos.tsx` después de early return (violación de reglas de hooks) |
| **Implementado** | `main.tsx`: eliminado fallback `#dc2626` → `var(--mc-color-danger)` · `tareaUrgencia.ts`: `RIESGO_CONFIG` con tokens semánticos · `OTImpresion.tsx`: estilos en `ot-impresion.css` · `Metricas.tsx`: clases `.mc-progress-*` y `.mc-chart-segment-value` · `MiSemanaGrillaDnD.tsx`: sombra/rotación con `.mc-drag-overlay-card` · `Objetivos.tsx`: menú flotante con `.mc-dropdown-menu--portal` · `animations.css`: keyframes con tokens semánticos · `EmptyState` unificado en Planificación (5), Objetivos (3), OT (1) · CSS legacy de `KpiCard` eliminado · Regla ESLint `no-restricted-syntax` anti-hex en `eslint.config.js` |
| **Fix hook** | `nombreResponsablePorId` se calcula siempre (con `usuario` opcional dentro del memo); early return queda después de todos los hooks. `eslint src/pages/Objetivos.tsx` pasa sin errores |
| **Verificación** | `grep` en `src/**/*.{ts,tsx}`: 0 `#hex` y 0 `rgba(`. Build OK |

---

### 🟡 MEDIOS

---

#### M-01 — DnD táctil en móviles sin validar
**Estado: ⏳ Pendiente**

| Campo | Detalle |
|-------|---------|
| **Problema** | `@dnd-kit` sin `TouchSensor` configurado. En móvil, el gesto se interpreta como scroll en lugar de drag |
| **Solución** | En `useSemanaDnD.ts`: añadir `TouchSensor` con `activationConstraint: { delay: 250, tolerance: 5 }` junto al `PointerSensor` existente con `{ distance: 8 }`. El delay de 250ms distingue scroll de drag |
| **Mejora** | Ejecutar QA D5 en iOS y Android. Añadir a QA visual permanente junto a S12 y PL7 |

---

#### M-02 — Sin baseline de rendimiento ni imágenes optimizadas
**Estado: ⏳ Pendiente**

| Campo | Detalle |
|-------|---------|
| **Problema** | Sin medición de LCP/CLS/INP. Assets PNG sin optimizar: `logo-nexora.png` 118KB, `icon-nexora-png.png` 55KB, `hero.png` 44KB (total ~217KB) |
| **Solución** | Baseline: Lighthouse en staging con throttling "Slow 4G" sobre `/login` y `/semana`. Registrar valores en `README`. Objetivo: LCP < 2.5s · Imágenes: convertir a WebP con `cwebp -q 85`. Actualizar imports en `AppLogo.tsx` y `OnboardingWelcome.tsx` |
| **Mejora** | Añadir `vite-plugin-imagetools` para transformaciones de imagen declarativas en los imports |

---

#### M-03 — Tests de integración para recurrencia de eventos
**Estado: ⏳ Pendiente**

| Campo | Detalle |
|-------|---------|
| **Problema** | Funcionalidad nueva (migraciones 025-026) sin tests de API. Solo existe test V2 de validación de fechas en UI |
| **Solución** | Crear `src/api/__tests__/recurrencia.api.test.ts` con patrón MSW. Casos mínimos: recurrencia válida → RPC correcto · `fecha_fin` < `fecha_inicio` → error antes del API · sin días seleccionados → error de validación · RPC devuelve error BD → se propaga sin silenciar |
| **Mejora** | Añadir test de "eliminar solo este evento vs. toda la serie" — el caso que más confunde a usuarios |

---

#### M-04 — Sin automatización proactiva de SLAs
**Estado: ⏳ Pendiente**

| Campo | Detalle |
|-------|---------|
| **Problema** | El sistema es reactivo. El jefe descubre tareas atrasadas o bloqueadas solo cuando abre la app |
| **Solución** | Edge Function o `pg_cron` ejecutándose a las 8:00 AM diariamente. Consulta: tareas que cambiaron a `atrasada` en las últimas 24h + tareas `bloqueada` sin resolver hace más de 48h. Envía resumen al jefe via email (InsForge) o webhook Slack/Teams con link a `/planificacion` filtrado |
| **Mejora** | A futuro: notificaciones en tiempo real via canal Realtime de InsForge ya integrado en `useRealtimeNotificaciones.ts`. Toast inmediato al jefe cuando una tarea cambia a `atrasada` o `bloqueada` |

---

#### M-05 — Accesibilidad WCAG sin auditoría formal
**Estado: ⏳ Pendiente**

| Campo | Detalle |
|-------|---------|
| **Problema** | Solo 2 escenarios de accesibilidad en QA manual (AC1, AC2). Sin auditoría automatizada |
| **Solución** | 1. `@axe-core/react` en `main.tsx` dentro de bloque `if (import.meta.env.DEV)` → violaciones en consola sin configuración extra · 2. Lighthouse Accessibility en `/semana` y `/ordenes-trabajo` → objetivo score ≥ 90 · 3. Verificar AC1 y AC2 del QA manual |
| **Mejora** | Integrar `vitest-axe` en tests existentes: añadir `expect(container).toHaveNoViolations()` a los tests que renderizan componentes. Sin tests nuevos |

---

#### M-06 — Sin capacidades offline (PWA)
**Estado: ⏳ Pendiente**

| Campo | Detalle |
|-------|---------|
| **Problema** | La app deja de funcionar sin conexión. Crítico para técnicos en campo con OTs de modalidad `viaje` |
| **Solución** | `vite-plugin-pwa` con estrategia diferenciada: assets estáticos → `CacheFirst` · datos de lectura (tareas, OTs activas) → `StaleWhileRevalidate` · mutaciones → bloqueadas con mensaje claro. `manifest.json` con nombre "Nexora", iconos y `display: standalone` para instalación como app |
| **Mejora** | `Background Sync API` para cola de mutaciones offline. Al recuperar conexión, las acciones pendientes se sincronizan automáticamente |

---

#### M-07 — Analytics de comportamiento desactivados
**Estado: ⏳ Pendiente**

| Campo | Detalle |
|-------|---------|
| **Problema** | `VITE_ANALYTICS_ENABLED` desactivado. El roadmap se construye sin datos de uso real |
| **Solución** | Activar `VITE_ANALYTICS_ENABLED=true` en Vercel. Verificar que `VITE_ANALYTICS_ENDPOINT` apunte a destino válido (PostHog plan gratuito recomendado para uso interno). Validar que llegan: `page_view` por ruta, creación de OT y cambio de estado de tarea |
| **Mejora** | Instrumentar tres eventos de alto valor: tasa de completación del formulario OT (abiertos vs. enviados) · frecuencia de reprogramación por usuario (indicador de planificación deficiente) · tiempo promedio creación → completado de OT (KPI principal del sistema) |

---

### 🟢 BACKLOG

---

#### B-01 — Estado indefinido del módulo Bitácora
**Estado: ⏳ Decisión pendiente**

| Campo | Detalle |
|-------|---------|
| **Problema** | Ruta `/bitacora` eliminada en V4 pero tabla `nota_bitacora` con RLS activa en BD y tests que la referencian |
| **Opción A — Eliminar definitivamente** | Migración `029_drop_nota_bitacora.sql`. Eliminar tabla, políticas RLS, índices y tests que la referencian |
| **Opción B — Pausar hasta V5** | Crear `ROADMAP-FEATURES.md` con bitácora listada como "pausada en V4". Marcar escenarios QA como N/A hasta reactivación |
| **Mejora** | Establecer como práctica: toda funcionalidad eliminada tiene una decisión explícita sobre sus datos en BD |

---

#### B-02 — Plan de contingencia por vendor lock-in con InsForge
**Estado: ⏳ Pendiente documentar**

| Campo | Detalle |
|-------|---------|
| **Problema** | Dependencia total de InsForge sin plan documentado de escape |
| **Solución** | Sección "Dependencias externas y contingencia" en `PROJECT_STRATEGY.md` con: inventario de acoplamiento (`insforge.ts`, `insforgeFetchInterceptor.ts`, RPCs) · plan de escape (InsForge es compatible con Supabase API — estimado 2-3 días de migración) · señales de alerta que activarían evaluar migración |
| **Mejora** | Verificar en pipeline que `db/schema.sql` esté sincronizado con InsForge. Si hay drift → alerta. El schema desactualizado pierde su valor como herramienta de escape |

---

#### B-03 — Soporte multi-tenant para múltiples empresas cliente
**Estado: ⏳ Diseño definido, implementación futura**

| Campo | Detalle |
|-------|---------|
| **Contexto** | Escenario: múltiples empresas clientes con aislamiento total. Estrategia elegida: **Estrategia B** — una instancia InsForge, `tenant_id` en cada tabla + RLS |
| **Fases de implementación** | 1. Tabla `tenant` + columna `tenant_id` en todas las tablas core (2d) · 2. Actualizar todas las políticas RLS con condición `tenant_id = sgtd_tenant_id()` (1d) · 3. Función de contexto en Postgres + inyección en cliente post-login (1d) · 4. Actualizar todos los RPCs para inferir `tenant_id` desde sesión (2d) · 5. Tests de aislamiento por tenant — intento de leer datos de otro tenant devuelve 0 resultados (2d) · 6. UI de administración de tenants (3d) |
| **Esfuerzo total** | ~11 días |
| **Riesgo principal** | Un bug en RLS es una brecha de datos entre clientes. Salvaguardas obligatorias: tests de aislamiento en cada PR · tabla `audit_log` · checklist de code review que exige `tenant_id` + RLS en cada tabla nueva |
| **Prerrequisito** | Validar con el negocio que la expansión multi-cliente es probable en los próximos 12 meses antes de invertir en la implementación |

---

## 4. QUICK WINS ACTIVOS

Acciones ejecutables esta semana con recursos existentes:

| # | Acción | Esfuerzo | Impacto |
|---|--------|----------|---------|
| QW-1 | Verificar migraciones en InsForge y ejecutar `sgtd_marcar_atrasadas_vencidas()` | 30 min | 🔴 Corrige datos de producción |
| QW-2 | Ejecutar checklist QA manual completo (27 escenarios) | 4h | 🔴 Valida flujos críticos |
| QW-3 | Configurar `VITE_SENTRY_DSN` en Vercel + alerta en Sentry | 2h | 🔴 Activa observabilidad |
| QW-4 | Activar `VITE_ANALYTICS_ENABLED=true` en Vercel | 1h | 🟡 Datos de uso real |
| QW-5 | Convertir imágenes PNG a WebP | 2h | 🟡 ~150KB menos en first load |

---

## 5. ROADMAP DE IMPLEMENTACIÓN

| Sprint | Tarea | Prioridad | Esfuerzo | ROI |
|--------|-------|-----------|----------|-----|
| **1** | C-01: Verificar migraciones InsForge | 🔴 | 30 min | Alto |
| **1** | C-02: Configurar Sentry + Vercel | 🔴 | 2h | Alto |
| **1** | C-04: Ejecutar QA manual completo | 🔴 | 4h | Alto |
| **1-2** | A-01: Pipeline CI/CD básico | 🟠 | 1 día | Alto |
| **1-2** | A-02: Coverage report + umbrales | 🟠 | 4h | Alto |
| **2** | M-01: DnD táctil + TouchSensor | 🟡 | 4h | Medio |
| **2** | M-02: Lighthouse baseline + WebP | 🟡 | 4h | Medio |
| **2-3** | M-03: Tests recurrencia de eventos | 🟡 | 4h | Medio |
| **3** | M-04: Automatización SLAs / alertas | 🟡 | 4 días | Medio |
| **3** | M-05: Auditoría accesibilidad WCAG | 🟡 | 1 día | Medio |
| **3-4** | M-07: Analytics activados + eventos | 🟡 | 1 día | Medio |
| **4** | M-06: PWA con soporte offline | 🟡 | 3 días | Medio |
| **Backlog** | B-01: Decidir estado Bitácora | 🟢 | 4h | Bajo |
| **Backlog** | B-02: Documentar plan contingencia InsForge | 🟢 | 2h | Bajo |
| **Backlog** | B-03: Multi-tenant (diseño → implementación) | 🟢 | 11 días | Alto a largo plazo |

---

## 6. BENCHMARK COMPETITIVO

| Capacidad | Nexora SGTD v3 | Asana | Jira Service Mgmt | Monday.com |
|-----------|----------------|-------|-------------------|------------|
| Gestión tareas semanal + DnD | ✅ | ✅ | ✅ | ✅ |
| OT formal con receptor (nombre, DNI, cargo) | ✅ Diferenciador | ❌ | ⚠️ via tickets | ⚠️ templates |
| RBAC real con RLS en BD | ✅ | ⚠️ | ✅ | ⚠️ |
| Métricas de equipo | ✅ | ✅ | ✅ | ✅ |
| Observabilidad de errores | ✅ (código listo) | ✅ | ✅ | ✅ |
| Borradores persistentes de formularios | ✅ | ✅ | ✅ | ✅ |
| App móvil / PWA | ❌ (planificado) | ✅ | ✅ | ✅ |
| Notificaciones push | ❌ (planificado) | ✅ | ✅ | ✅ |
| Alertas automáticas SLA | ❌ (planificado) | ✅ | ✅ | ✅ |
| Multi-tenant | ❌ (diseñado) | ✅ | ✅ | ✅ |
| Modo offline | ❌ (planificado) | ⚠️ | ❌ | ❌ |
| Export PDF/Excel masivo | ⚠️ solo impresión OT | ✅ | ✅ | ✅ |

**Ventaja competitiva sostenible:** El flujo de OT con receptor es el diferenciador real. Las herramientas genéricas no lo tienen nativo y requieren customización costosa para alcanzarlo.

---

## 7. VISIÓN A 12 MESES

### Q3 2026 — Estabilización operativa
- Todos los bugs resueltos y verificados
- CI/CD activo con pipeline automatizado
- Coverage ≥ 70% en código de negocio crítico
- Sentry activo con alertas configuradas
- Analytics con datos de uso reales

### Q4 2026 — Expansión móvil
- PWA instalable con lectura offline
- DnD táctil validado en dispositivos reales
- Notificaciones push via Web Push API
- Alertas automáticas de SLA al jefe

### Q1-Q2 2027 — Plataforma y escala
- Motor de automatización basado en eventos
- Multi-tenant Estrategia B implementado
- Hub de integración con webhooks (ERP, calendarios)
- Export masivo a PDF/Excel para reportes formales
- Posicionamiento como Sistema Operativo Central del Departamento TI

---

## 8. CHECKLIST TÉCNICO CONSOLIDADO

### 🔴 Críticos (bloquean release)

```
[ ] C-01: sgtd_eliminar_tarea_con_log funciona con tarea en estado 'atrasada'
[ ] C-01: No existen tareas 'reprogramada' con fecha vencida en producción
[ ] C-02: VITE_SENTRY_DSN configurado en Vercel → error aparece en Sentry < 2 min
[ ] C-04: QA manual ejecutado · 0 ítems en estado FAIL · tabla con fecha y ejecutor
[ ] C-03: Borrador de OT sobrevive a F5 y a cierre del navegador
```

### 🟠 Altos (siguientes sprints)

```
[ ] A-01: Pipeline CI/CD ejecuta lint → test → build y bloquea merge si falla
[ ] A-02: npm run test:coverage genera reporte con métricas > 70% de líneas
[ ] A-03: INSERT de OT con estado='completada' y receptor_nombre=NULL → error constraint
[ ] A-04: grep en src/**/*.{ts,tsx} devuelve 0 coincidencias de #hex y rgba(
[ ] A-04: eslint src/pages/Objetivos.tsx pasa sin errores
```

### 🟡 Medios (backlog cercano)

```
[ ] M-01: QA D5 (DnD táctil) verificado ✅ PASS en iOS y Android
[ ] M-02: Lighthouse LCP < 2.5s en /semana con throttling "Slow 4G"
[ ] M-02: Assets PNG principales convertidos a WebP
[ ] M-05: Lighthouse Accessibility score ≥ 90 en /semana y /ordenes-trabajo
[ ] M-07: Eventos de analytics llegando al endpoint configurado en producción
```

---

## 9. RESUMEN DE ESTADO POR HALLAZGO

| # | Hallazgo | Estado |
|---|----------|--------|
| C-01 | Bugs BD B-01/B-03 | ⏳ Pendiente verificación InsForge |
| C-02 | Observabilidad Sentry | ⚙️ Código listo — falta config Sentry/Vercel |
| C-03 | Borradores de OT | ✅ Implementado |
| C-04 | QA manual 27 escenarios | ⏳ Pendiente ejecución |
| C-05 | Layout Planificación + Semana | ✅ Implementado |
| A-01 | Pipeline CI/CD | ⏳ En evaluación |
| A-02 | Coverage de pruebas | ⏳ En evaluación |
| A-03 | CHECK constraint OT completada | ✅ Cerrado en dev |
| A-04 | Colores #hex + hook condicional | ✅ Cerrado completamente |
| M-01 | DnD táctil | ⏳ Pendiente |
| M-02 | Lighthouse + WebP | ⏳ Pendiente |
| M-03 | Tests recurrencia eventos | ⏳ Pendiente |
| M-04 | Automatización SLAs | ⏳ Pendiente |
| M-05 | Accesibilidad WCAG | ⏳ Pendiente |
| M-06 | PWA offline | ⏳ Pendiente |
| M-07 | Analytics activados | ⏳ Pendiente |
| B-01 | Estado módulo Bitácora | ⏳ Decisión pendiente |
| B-02 | Plan contingencia InsForge | ⏳ Pendiente documentar |
| B-03 | Multi-tenant (diseño listo) | ⏳ Implementación futura |

**Resumen:** 4 hallazgos cerrados · 1 con código listo pendiente de configuración · 14 pendientes de implementar o decidir

---

*Auditoría Nexora SGTD v3 — Actualizada el 18 de mayo de 2026*