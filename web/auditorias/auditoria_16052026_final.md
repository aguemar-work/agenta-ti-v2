# Auditoría digital integral — Nexora / SGTD (Agenda TI v3)

**Documento:** versión final consolidada  
**Fuentes:** `auditoria_16052026.md` (auditoría técnica/UX) + `minicambio_16052026.md` (bugs operativos y mejoras)  
**Fecha de cierre:** 16 de mayo de 2026  
**Stack:** React 19 · TypeScript 6 · Vite 8 · TanStack Query 5 · InsForge SDK 1.2 · PostgreSQL + RLS  
**Alcance:** SPA interna V4 — sin SEO, sin SSR, 4–8 usuarios corporativos

---

## 1. Resumen ejecutivo

Nexora (SGTD) es una herramienta de **planificación semanal, ejecución diaria, imprevistos, órdenes de trabajo formales y objetivos estratégicos** para un equipo de TI con dos roles: **jefe** (supervisión) y **miembro** (ejecución). La arquitectura respeta el patrón obligatorio **Page → Hook → API → InsForge**, con **RLS en PostgreSQL** como fuente de verdad de permisos.

Tras la auditoría técnica (Fase 0 de tokens + mejoras de accesibilidad, build y producto) y la ronda de **mini cambios** (bugs críticos + Lote 2 UX), el sistema queda en estado **operativamente usable** en frontend, con **un único requisito de despliegue en BD** pendiente de confirmar en InsForge producción: migración **027**.

| Dimensión | Nota (mayo 2026) | Comentario |
|-----------|------------------|------------|
| Arquitectura y stack | **8.0 / 10** | Build explícito, lazy routes, vendor chunks, strict TS ampliado |
| Seguridad y permisos | **8.5 / 10** | RLS + paridad documentada; frontend solo UX |
| UX / Meta Canvas | **7.8 / 10** | Lote 2 reduce fricción en Mi Semana y OT |
| Reglas de negocio (coherencia UI↔BD) | **8.0 / 10** | Tras B-03 y P2-02; depende de migración 027 en prod |
| Operación diaria (jefe/miembro) | **7.5 / 10** | Flujos críticos corregidos; P2-08 y M-07–M-09 abiertos |
| **Global estimado** | **7.8 / 10** | Subida desde ~6.8–7.1 pre-Fase 0 |

**Verificación técnica al cierre:** `npm run build` OK · **208 tests** Vitest OK.

---

## 2. Marco de negocio (criterio de la auditoría)

Toda recomendación o hallazgo se juzga contra estas reglas de producto V4. Si una propuesta las contradice, se descarta o se pospone.

### 2.1 Módulos activos y propósito

| Módulo | Ruta | Rol | Función de negocio |
|--------|------|-----|-------------------|
| Mi Semana | `/semana` | Jefe + Miembro | **Ejecución:** grilla Lun–Sáb, DnD entre días, incidencias en columna de hoy, panel de notas (xl+) |
| Planificación | `/planificacion` | Solo jefe | **Supervisión:** vista multi-miembro, **solo lectura** — no crear/editar tareas desde aquí |
| Objetivos | `/objetivos` | Ambos | **Estrategia:** progreso = % tareas completadas / no canceladas; jefe asigna responsable; miembro solo auto-responsable |
| Órdenes de trabajo | `/ordenes-trabajo` | Ambos | **Formalización B2B:** flujo borrador → pendiente → aprobada → en_ejecución → completada (o rechazada/cancelada) |
| Métricas | `/metricas` | Solo jefe | **Retrospectiva:** KPIs comparativos; uso menos frecuente que Mi Semana (por eso en drawer "Más" en móvil) |

**Eliminados en V4 (no recrear):** `/tablero`, `/bitacora`, `/hoy` como página dedicada.

### 2.2 Reglas de tarea (enforcement)

| Regla | Capa correcta | Estado en auditoría |
|-------|---------------|---------------------|
| Estado `atrasada` calculado (`fecha_planificada` vencida + `pendiente`/`reprogramada`) | **Trigger BD** (migr. 015 + **027**) | ✅ B-03: trigger incluye `reprogramada`; UI refleja vía `estadoEfectivoTablero` |
| `en_progreso` vencida **no** pasa automáticamente a `atrasada` | BD (intencional) | ✅ Respetado — el usuario que ya inició la tarea no se penaliza visualmente sin decisión |
| Imprevisto: `tipo=no_planificada`, `estado=completada`, `es_imprevisto=true`, fecha=hoy | Creación en Mi Semana | ✅ U-02, E-01, P2-01 |
| Bloquear / cancelar / reprogramar / eliminar → log + justificación ≥10 chars | RPC atómicas + UI | ✅ B-01 (eliminar); M-03 (completar atrasada con resumen) |
| Arrastrar tarea `completada`/`cancelada` | No permitido | ✅ P2-02 (evita P0002 en `sgtd_mover_tarea_dia`) |
| Tarea `libre` al soltar en día → `planificada` + fecha + semana ISO | DnD + API | ✅ Sin cambios en esta ronda |
| Miembro ve tareas del equipo; **modifica solo las propias** | RLS + UI read-only | ✅ Coherente con RBAC |

### 2.3 Órdenes de trabajo

| Regla | Estado |
|-------|--------|
| Solo jefe aprueba/rechaza | ✅ RLS + UI |
| Número correlativo vía RPC `generar_numero_ot` | ✅ |
| Lista se actualiza tras aprobar/rechazar sin recargar | ✅ B-02 (`queryHelpers` → `ordenes-trabajo`) |
| Filtros alineados al uso: Activas / Completadas + estado específico | ✅ P2-07 |
| Columna "Creado por" para trazabilidad | ✅ P2-06 |
| Tipos de trabajo: modal, activos + inactivos | ✅ U-03, P2-05 |

### 2.4 Objetivos

| Regla | Estado |
|-------|--------|
| Columna **Responsable** visible en lista | ✅ P2-04 |
| Progreso solo sobre tareas vinculadas no canceladas | ✅ Sin regresión |

---

## 3. Hallazgos operativos (mini cambios) — cierre

### 3.1 Bugs críticos

| ID | Problema | Impacto negocio | Resolución | Pendiente en prod |
|----|----------|-----------------|------------|-------------------|
| **B-01** | Eliminar tarea → P0001 logs inmutables | No se puede cerrar trabajo con trazabilidad | Migración **027**: flag de sesión en trigger + RPC | Ejecutar SQL en InsForge |
| **B-02** | OT aprobada/rechazada no refresca lista | Jefe cree que la acción falló | Frontend: invalidación `ordenes-trabajo` | — |
| **B-03** | `reprogramada` vencida no pasa a `atrasada` | Métricas y priorización incorrectas | Migración **027** + backfill + UI | Ejecutar SQL + `sgtd_marcar_atrasadas_vencidas()` |

```sql
-- InsForge SQL Editor (una vez por entorno)
-- Archivo: db/migrations/027_fix_eliminar_atrasada_ot.sql
SELECT public.sgtd_marcar_atrasadas_vencidas();
```

**QA manual post-027:** eliminar tarea con motivo ≥10 chars · aprobar OT y ver fila actualizada · tarea reprogramada en el pasado muestra `atrasada`.

### 3.2 UX y comportamiento (aprobados)

| ID | Mejora | Alineación negocio |
|----|--------|-------------------|
| U-01 | Fecha límite fijada al crear desde un día | Evita planificar “en otro día” por error al asignar desde columna |
| U-02 | Incidencias por columna de día | Imprevistos visibles en contexto temporal, no en módulo aparte |
| U-03 | Tipos de trabajo en modal (jefe) | Configuración formal sin ensuciar lista de OT |

### 3.3 Mejoras de producto (Mi Semana y detalle)

| ID | Mejora | Alineación negocio |
|----|--------|-------------------|
| M-01 | Resumen del día (pendientes, atrasadas, bloqueos) | Foco matutino del técnico |
| M-02 | Chip "Vence hoy" | Priorización sin depender solo del trigger `atrasada` |
| M-03 | Completar `atrasada` exige resumen | Trazabilidad al cerrar deuda vencida |
| M-04 | Chip estado OT en tarjeta | Enlace operación diaria ↔ formalización |
| M-05 | Historial colapsable en detalle tarea | Auditoría de reprogramaciones/bloqueos |
| M-06 | Filtro miembro (jefe) | Ya existía — supervisión por persona |
| ↪️ M-10 | Modo compacto | **Sustituido por P2-03** (ocultar completadas) — mejor para volumen real |

### 3.4 Lote 2 (16/05/2026)

| ID | Cambio | Criterio negocio |
|----|--------|------------------|
| P2-01 | Incidencias en filas compactas | Diferenciar imprevisto de tarea planificada sin competir por atención |
| P2-02 | Sin DnD en completadas/canceladas | Registro cerrado no debe “moverse” en la grilla |
| P2-03 | Ocultar completadas + contador | Reduce ruido; datos siguen en BD y en filtros de estado |
| P2-04 | Columna Responsable en Objetivos | Accountability estratégica visible al jefe |
| P2-05 | "Tipos de trabajo" + inactivos | Catálogo OT mantenible sin perder historial |
| P2-06 | Columna "Creado por" en OT | Trazabilidad de quién solicitó el trabajo |
| P2-07 | Filtros OT simplificados | Uso diario: activas vs archivo completadas |
| **P2-08** | Reorganizar Planificación / Métricas | **Pendiente** — requiere decisión de producto con capturas |

### 3.5 Pendiente de producto (no bloquea operación diaria)

| ID | Ítem | Por qué esperar |
|----|------|----------------|
| M-07 | Reordenar tareas dentro del mismo día | Alto esfuerzo; sin regla de negocio en BD hoy |
| M-08 | Exportar semana/planificación PDF | Reporting a gerencia — post-V4 |
| M-09 | Aviso 1 día antes de `fecha_limite` | Proactividad; encaja con preferencias de campana |
| P2-08 | UX Planificación / Métricas | Mezcla consulta diaria vs retrospectiva — definir con jefe |

---

## 4. Hallazgos técnicos (auditoría digital) — estado actualizado

### 4.1 Resueltos o reclasificados (no accionar)

| Hallazgo original | Estado final |
|-------------------|--------------|
| `vite.config.ts` sin build config | ✅ Plugin React, `manualChunks`, target ES2022 |
| Sin lazy loading | ✅ Ya existía; DnD y OTImpresion en chunks separados |
| Permisos “solo frontend” | ✅ **Incorrecto** — RLS + `permisos.rls-paridad.test.ts` |
| Headers / CSP | ✅ `vercel.json` ampliado |
| Títulos dinámicos / `robots.txt` | 🚫 No aplica — app interna |
| `@tabler/icons-react` | ✅ Migrado a Lucide |
| `.ds-status-badge` / `design-tokens.css` duplicado | ✅ Eliminados; solo `--mc-*` |
| `TAREA_PILL` con hex | ✅ Clases `.mc-tarea-pill--*` + tokens |
| Analytics, onboarding, preferencias notificación | ✅ Implementados |
| `aria-live`, `TareaEstadoIndicator`, modales destructivos | ✅ |
| Filtros en URL (Métricas, OT) | ✅ `useFilterSearchParams` |
| Bottom nav por frecuencia de uso | ✅ Métricas en "Más" (jefe) |

### 4.2 Deuda técnica abierta (priorizada con criterio de negocio)

| Prioridad | Ítem | Esfuerzo | Justificación |
|-----------|------|----------|---------------|
| 🔴 **Operativo** | Confirmar migración **027** en InsForge prod | 0.5 h | Sin esto, B-01 y B-03 fallan en operación real |
| 🟡 Alto | Documentar contrato `@insforge/sdk` (endpoints, realtime, límites) | 1 d | Mantenibilidad; equipo pequeño pero dependencia crítica |
| 🔵 Medio-bajo | Reconexión realtime en `online` / `visibilitychange` | 0.5 d | Solo relevante si jefe usa móvil para alertas OT/incidencias |
| 🔵 Medio | `PageErrorBoundary` por ruta | 1 d | Resiliencia sin perder shell; datos en Query se recuperan |
| 🔵 Medio | Persistencia filtros en Planificación (si se añaden filtros) | 0.5 d | Hoy Planificación no usa `FilterBar`; bajo impacto |
| 🔵 Medio-bajo | Preferencias notificación en `usuario.preferencias` (jsonb) | 1 d | Sincronizar campana entre dispositivos |
| ⚪ Bajo | `@tanstack/react-virtual` en listas >200 ítems | 2 d | Escala actual 4–8 usuarios — prematuro |
| ⚪ Bajo | Workbox / offline | 3 d | Red corporativa estable; descartado como prioritario |
| 🚫 Descartado | Tailwind v4 | — | Incompatible con InsForge MCP + `@layer` |
| 🚫 Descartado | Circuit breaker API | — | Escala 4–8 usuarios; Query + interceptor suficientes |

### 4.3 Inconsistencias corregidas respecto al borrador `auditoria_16052026.md`

El borrador inicial aún listaba como críticos: vite sin config, sin lazy loading, permisos solo en frontend, y deuda Fase 1/2 en pills. **Eso ya no refleja el código.** Este documento final sustituye esas secciones para evitar doble lectura.

---

## 5. Matriz módulo × riesgo residual

| Módulo | Riesgo residual | Mitigación |
|--------|-----------------|------------|
| **Mi Semana** | Bajo | P2-02/P2-03; incidencias legibles; DnD acotado a estados abiertos |
| **Planificación** | Medio (UX) | Solo lectura correcta; P2-08 pendiente de jerarquía visual |
| **Objetivos** | Bajo | Responsable visible; RLS en asignación |
| **OT** | Bajo (tras B-02) | Filtros y columnas alineados al flujo del jefe |
| **Métricas** | Bajo | Solo jefe; filtros en URL |
| **Auth / sesión** | Bajo | Interceptor 401; sin token en Zustand |
| **BD / RPC** | **Medio hasta migr. 027** | Checklist SQL obligatorio en deploy |

---

## 6. Checklist de salida a producción

### 6.1 Base de datos (InsForge)

- [ ] Ejecutar `db/migrations/027_fix_eliminar_atrasada_ot.sql`
- [ ] Ejecutar `SELECT public.sgtd_marcar_atrasadas_vencidas();` una vez
- [ ] Probar eliminar tarea, mover tarea abierta, reprogramada vencida → `atrasada`

### 6.2 Frontend (ya en repo)

- [x] Build de producción sin errores
- [x] 208 tests unitarios
- [x] Lote 2 mini cambios desplegado en código

### 6.3 Variables de entorno

```bash
VITE_INSFORGE_URL=...
VITE_INSFORGE_ANON_KEY=...
VITE_SENTRY_DSN=...              # opcional
VITE_ANALYTICS_ENDPOINT=...      # opcional — adopción
VITE_ALLOWED_EMAIL_DOMAINS=...   # opcional
```

### 6.4 QA manual recomendado (rol jefe + miembro)

1. **Miembro:** crear tarea en día con fecha límite bloqueada (U-01); registrar incidencia con fecha editable (E-01); ver fila compacta de incidencia (P2-01).
2. **Miembro:** completar tarea `atrasada` — exige resumen (M-03); no poder arrastrar completada (P2-02).
3. **Miembro:** activar "Ocultar completadas" — ver contador por día (P2-03).
4. **Jefe:** aprobar OT — lista actualizada (B-02); filtrar Activas / Completadas (P2-07); ver Creado por (P2-06).
5. **Jefe:** gestionar tipos de trabajo activos/inactivos (P2-05); ver responsable en Objetivos (P2-04).
6. **Jefe:** Planificación — confirmar que no hay CTAs de crear/editar tarea (regla de negocio V4).

---

## 7. Roadmap sugerido (post-cierre)

| Horizonte | Entregable | Valor negocio |
|-----------|------------|---------------|
| Inmediato | Migración 027 en prod | Operación sin errores 400/500 en flujos diarios |
| 1–2 semanas | P2-08 con wireframes | Planificación y Métricas legibles para jefe |
| 1 mes | M-09 notificación vencimiento | Menos tareas que pasan a `atrasada` sin aviso |
| Post-V4 | M-07 orden intra-día, M-08 PDF | Optimización; reporting externo |

---

## 8. Referencias

| Documento | Uso |
|-----------|-----|
| `auditoria_16052026.md` | Detalle técnico histórico (Fase 0 tokens, dimensiones 1–5) |
| `minicambio_16052026.md` | Trazabilidad ítem a ítem de bugs y Lote 2 |
| `.cursor/rules/CONTEXT.mdc` | Stack, rutas, schema, RPCs |
| `.cursor/rules/sgtd-business-rules.mdc` | Reglas de tarea, OT, imprevistos, métricas |
| `db/migrations/027_fix_eliminar_atrasada_ot.sql` | Script obligatorio B-01 + B-03 |

---

## 9. Conclusión

La plataforma **cumple el modelo de negocio V4** en frontend: separación de módulos, RBAC coherente con RLS, trazabilidad en acciones sensibles y flujos OT/objetivos alineados al uso real del jefe y del miembro. La auditoría técnica cerró deuda estructural (tokens, build, a11y, producto base); la ronda de mini cambios cerró **fricción operativa** en Mi Semana, OT y Objetivos.

**Único bloqueador de negocio en entornos no migrados:** aplicación de la migración **027** en InsForge. Todo lo demás es mejora incremental (P2-08, M-07–M-09) sin invalidar el despliegue actual del código.

*Documento final generado por consolidación de auditorías del 15–16/05/2026. Mantener sincronizado con `CONTEXT.mdc` ante cambios de schema o módulos.*
