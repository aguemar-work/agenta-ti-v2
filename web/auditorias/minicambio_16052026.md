# Agenda TI — Propuesta de Mini Cambios
**Para revisión y aprobación · Mayo 2026**  
**Última actualización:** 2026-05-16 — Lote 2 implementado en frontend.

Basado en el código fuente auditado y los bugs reportados. Cada ítem tiene clasificación, impacto estimado y justificación.

---

## BUGS CRÍTICOS (bloquean operación)

### B-01 — `sgtd_eliminar_tarea_con_motivo` falla con 400 ✅ Resuelto
**Síntoma:** Eliminar cualquier tarea devuelve `P0001: Los registros de auditoría son inmutables`.
**Causa real:** La RPC (migración `018`) ya solo hacía INSERT + DELETE. El fallo era el FK `ON DELETE SET NULL`: al borrar la tarea, Postgres intentaba poner `tarea_id = NULL` en `log_accion` → disparaba el trigger `sgtd_fn_log_inmutable` → P0001.
**Solución (migración `027`):**
- `sgtd_fn_log_inmutable`: permite el UPDATE que anula `tarea_id` solo cuando la variable de sesión `sgtd.permitir_null_tarea_id_log = '1'` está activa. Todo lo demás sigue bloqueado.
- `sgtd_eliminar_tarea_con_motivo`: flujo INSERT `eliminada` → activa flag → DELETE tarea → desactiva flag.
- Mínimo de motivo: 10 caracteres (alineado con el frontend).
**Requiere ejecutar en SQL Editor de InsForge:** `db/migrations/027_fix_eliminar_atrasada_ot.sql`
**Esfuerzo:** Bajo · **Prioridad:** 🔴 Crítica

---

### B-02 — Aprobar / rechazar OT no actualiza la lista ✅ Resuelto
**Síntoma:** La mutación ejecutaba correctamente pero la lista no se refrescaba hasta recargar.
**Causa confirmada:** `queryHelpers.ts` invalidaba `['ot']` pero `useOrdenesTrabajoPage` escucha `['ordenes-trabajo', ...]`. Las keys no coincidían.
**Solución:** Solo frontend — `queryHelpers.ts`: el grupo `ot` ahora invalida `['ordenes-trabajo']`. Sin cambios en `api/ordenTrabajo.ts`; el hook ya usaba `invalidateRelatedQueries(qc, ['ot'])` correctamente.
**Tests añadidos:** `queryHelpers.test.ts` + `useOrdenesTrabajoPage.invalidation.test.ts`.
**Esfuerzo:** Muy bajo · **Prioridad:** 🔴 Crítica

---

### B-03 — Tarea reprogramada no pasa a `atrasada` al vencer ✅ Resuelto
**Síntoma:** Una tarea en `reprogramada` con `fecha_limite` vencida quedaba congelada — nunca pasaba a `atrasada`.
**Causa confirmada:** El trigger de migración `015` solo degradaba `pendiente` a `atrasada`. `reprogramada` quedaba excluida.
**Solución en dos capas (migración `027`):**
- **BD:** Trigger actualizado — `pendiente` y `reprogramada` vencidas pasan a `atrasada`. `en_progreso` vencida se respeta (comportamiento intencional de `015`).
- **Backfill de datos existentes:** `SELECT public.sgtd_marcar_atrasadas_vencidas();` — ejecutar una vez en SQL Editor tras aplicar la migración.
- **Frontend:** `estadoEfectivoTablero` + `tableroEstado.ts` actualizados — `reprogramada` vencida se lee como `atrasada` en la UI.
- `schema.sql` y reglas de negocio actualizados para instalaciones nuevas.
**Tests actualizados:** `tableroEstado`, `tablero`.
**Requiere ejecutar en SQL Editor de InsForge:** `027_fix_eliminar_atrasada_ot.sql` + backfill.
**Esfuerzo:** Medio · **Prioridad:** 🔴 Crítica

---

## PASOS REQUERIDOS EN INSFORGE (para B-01 y B-03)

> Estos bugs requieren cambios en BD. Sin ejecutar la migración, los fixes de frontend no tienen efecto.

```sql
-- 1. Aplicar migración (SQL Editor de InsForge)
-- Archivo: db/migrations/027_fix_eliminar_atrasada_ot.sql

-- 2. Backfill de tareas reprogramadas ya vencidas (ejecutar una vez)
SELECT public.sgtd_marcar_atrasadas_vencidas();
```

**Verificación manual post-migración:**
- Eliminar una tarea con motivo ≥ 10 caracteres → sin error P0001; desaparece de Mi Semana; queda log `eliminada`.
- Aprobar/rechazar una OT → la fila cambia de estado sin recargar.
- Tarea reprogramada con `fecha_planificada` en el pasado → badge/filtro muestra `atrasada` tras backfill.

---

## UX / COMPORTAMIENTO (aprobados en conversación)

### U-01 — Fecha límite bloqueada al crear desde día específico ✅ Resuelto
`ModalMiSemana` y `ModalNuevaTarea` (modo día): campo `Fecha límite` visible, deshabilitado, con texto `"Fecha fijada al día seleccionado"`. Fuera de contexto de día: campo editable con date picker.
**Archivos:** `ModalNuevaTarea.tsx`, `ModalMiSemana.tsx`.
**Esfuerzo:** Bajo · **Prioridad:** 🟡 Media

---

### U-02 — Incidencias por columna en Mi Semana ✅ Resuelto
Fetch semanal vía `getIncidenciasRangoUsuario` (miembro) y `getIncidenciasEquipoPorFechaPlanificada` (jefe). Incidencias en cada columna de día (desde Lote 2: filas compactas con `IncidenciaRow`). Jefe ve equipo completo al ver su propia semana. Días pasados: solo lectura. Botón `+ Registrar incidencia` solo aparece en la columna de hoy.
**Archivos:** `useMiSemanaPage.ts`, `MiSemana.tsx`, `MiSemanaGrillaDnD.tsx`, `IncidenciaRow.tsx`, APIs `hoyColumnas.ts`, `audit.ts`.
**Esfuerzo:** Medio · **Prioridad:** 🟡 Media

---

### U-03 — Tipos de Trabajo → modal (solo jefe) ✅ Resuelto
Botón `"Tipos de trabajo"` junto a `+ Nueva OT` en el PageHeader (solo jefe). Panel inline eliminado. `ModalTiposOT.tsx` con activos e inactivos y toggle por fila.
**Archivos:** `OrdenesTrabajo.tsx`, `ModalTiposOT.tsx`, `ordenTrabajo.ts`.
**Esfuerzo:** Bajo · **Prioridad:** 🔵 Media-baja

---

## MEJORAS PROPUESTAS (nuevas — para aprobación)

### M-01 — Resumen del día al abrir Mi Semana ✅ Resuelto
Banner dismissible por sesión (`MiSemanaResumenDia`): pendientes hoy, atrasadas y bloqueos activos.
**Archivos:** `MiSemanaResumenDia.tsx`, `MiSemana.tsx`.
**Esfuerzo:** Bajo · **Prioridad:** 🟡 Media

---

### M-02 — Chip "Vence hoy" en tarjetas ✅ Resuelto
Chip ámbar en `DraggableTareaSemana` vía `TareaMetaChips` + helper `tareaVenceHoy`. Condición: `fecha_limite === hoy` y estado no es `completada` ni `cancelada`.
**Archivos:** `DraggableTareaSemana.tsx`, `TareaMetaChips` (nuevo o actualizado).
**Esfuerzo:** Muy bajo · **Prioridad:** 🟡 Media

---

### M-03 — Aviso + resumen obligatorio al completar tarea atrasada ✅ Resuelto
`ModalCompletarTarea` muestra aviso cuando el estado es `atrasada` y exige resumen/justificación obligatorio antes de confirmar.
**Archivos:** `ModalCompletarTarea.tsx`.
**Esfuerzo:** Bajo · **Prioridad:** 🟡 Media

---

### M-04 — Estado de OT en tarjeta de tarea ✅ Resuelto
Chip con estado de OT en tarjetas. Clic abre modal resumen de OT.
**Archivos:** `DraggableTareaSemana.tsx`, `ModalDetalleTareaSemana.tsx`.
**Esfuerzo:** Medio · **Prioridad:** 🔵 Media-baja

---

### M-05 — Historial colapsable en detalle de tarea ✅ Resuelto
Sección colapsable `TareaHistorialSection` en `ModalDetalleTareaSemana` vía `getLogsPorTarea`. Log: fecha, acción, usuario, justificación.
**Pendiente:** añadir `TareaHistorialSection` también en detalle de Planificación si se desea.
**Archivos:** `ModalDetalleTareaSemana.tsx`, `TareaHistorialSection` (nuevo), `audit.ts`.
**Esfuerzo:** Medio · **Prioridad:** 🔵 Media-baja

---

### M-06 — Filtro de miembro en Mi Semana (jefe) ✅ Ya existía
El filtro de miembro para jefe ya estaba implementado. Sin cambios.
**Esfuerzo:** — · **Prioridad:** —

---

### M-07 — Reordenar tareas dentro del día (DnD) ⏳ Post-V4
No implementado. Esfuerzo alto; acordado para iteración posterior.
**Esfuerzo:** Alto · **Prioridad:** ⚪ Post-V4

---

### M-08 — Exportar semana o planificación a PDF
**Qué:** Botón `Exportar PDF` en Mi Semana y Planificación que genera un resumen de la semana actual: tareas por día, estado, incidencias. Usar la infraestructura ya existente de `OTImpresion` como base.
**Por qué:** Jefes frecuentemente necesitan reportar a gerencia sin que gerencia tenga acceso al sistema.
**Esfuerzo:** Medio-alto · **Prioridad:** ⚪ Baja (post-V4)

---

### M-09 — Notificación cuando una tarea asignada está a 1 día de vencer
**Qué:** El sistema emite un evento realtime (y toast) cuando `fecha_limite = mañana` y la tarea sigue en `pendiente` o `en_progreso`. Configurable en preferencias de notificación (ya existe el modal de campana).
**Por qué:** Prevención proactiva de atrasos, no solo reacción.
**Esfuerzo:** Medio · **Prioridad:** 🔵 Media-baja

---

### M-10 — Modo compacto en Mi Semana ↪️ Sustituido por P2-03
Implementado originalmente (`mc-misemana-compact` en `localStorage`). **Reemplazado** por toggle **"Ocultar completadas"** (P2-03): mejor aporte visual al reducir ruido de tareas ya cerradas. La clave antigua se migra automáticamente si existía.
**Archivos históricos:** `MiSemana.tsx`, `MiSemanaGrillaDnD.tsx`, `DraggableTareaSemana.tsx` (prop `compact` conservada pero ya no se expone en UI).

---

## LOTE 2 — IMPLEMENTADO (2026-05-16)

### P2-01 — Incidencias como filas compactas, no cards ✅ Resuelto
**Comportamiento:** Filas compactas debajo de las tareas del día — icono `AlertCircle`, fondo tenue (`--mc-state-incidencia-bg`), sin sombra de card. Bloque `.mc-incidencia-rows` separado por borde punteado.
**Archivos:** `IncidenciaRow.tsx` (nuevo), eliminado `IncidenciaCard.tsx`, `MiSemanaGrillaDnD.tsx`, `components.css`.
**Esfuerzo:** Bajo · **Prioridad:** 🟡 Media

---

### P2-02 — Deshabilitar drag en tareas completadas/canceladas ✅ Resuelto
**Fix:** `useDraggable({ disabled })` cuando `estado === 'completada' || estado === 'cancelada'`. Icono grip con `cursor: not-allowed`. Guard adicional en `useSemanaDnD.onDragEnd`.
**Archivos:** `DraggableTareaSemana.tsx`, `useSemanaDnD.ts`.
**Esfuerzo:** Muy bajo · **Prioridad:** 🔴 Bug

---

### P2-03 — Reemplazar toggle "modo compacto" por "Ocultar completadas" ✅ Resuelto
**Comportamiento:** Toggle en cabecera (icono `EyeOff`). Preferencia `mc-misemana-hide-completed` en `localStorage`. Oculta tareas con estado efectivo `completada` o `cancelada`; contador `"N completada(s)"` por columna.
**Archivos:** `useMiSemanaPage.ts`, `MiSemana.tsx`, `MiSemanaGrillaDnD.tsx`.
**Esfuerzo:** Muy bajo · **Prioridad:** 🟡 Media

---

### P2-04 — Objetivos: columna Responsable en tabla ✅ Resuelto
**Comportamiento:** Columna `Responsable` entre Objetivo y Estado. Nombres vía `useUsuariosActivos` (habilitado para todos los usuarios autenticados).
**Archivos:** `Objetivos.tsx`, `useObjetivosPage.ts`.
**Esfuerzo:** Muy bajo · **Prioridad:** 🟡 Media

---

### P2-05 — OT: "Tipos de trabajo" + tipos desactivados visibles ✅ Resuelto
**Cambios aplicados:**
1. Label del botón: `"Tipos de trabajo"`.
2. `ModalTiposOT`: secciones Activos / Inactivos con toggle por fila (ya existía; confirmado en UI).
**Archivos:** `OrdenesTrabajo.tsx`, `ModalTiposOT.tsx`.
**Esfuerzo:** Bajo · **Prioridad:** 🟡 Media

---

### P2-06 — OT: columna "Creado por" en tabla ✅ Resuelto
**Comportamiento:** Columna dedicada en la grilla de OTs (`ot.creador.nombre`). Visible para jefe y miembro.
**Archivos:** `OrdenesTrabajo.tsx`.
**Esfuerzo:** Muy bajo · **Prioridad:** 🔵 Media-baja

---

### P2-07 — OT: simplificar filtros de estado ✅ Resuelto (Propuesta A)
**Implementación:** Pills `Todos / Activas / Completadas` + `FilterBar.Select` "Estado específico" (borrador, pendiente, aprobada, en ejecución, rechazada, cancelada). URL `?estado=` admite `activas`, `completadas` y estados individuales. Tipo `FiltroEstadoOT` en `useOrdenesTrabajoPage.ts`.
**Archivos:** `OrdenesTrabajo.tsx`, `useOrdenesTrabajoPage.ts`, `FilterBar`.
**Esfuerzo:** Bajo · **Prioridad:** 🔵 Media-baja

---

### P2-08 — Planificación / Métricas: reorganización de información ⏳ Pendiente
**Estado:** Evaluación pendiente — requiere captura de pantalla de ambas vistas para diagnóstico preciso.
**Preguntas abiertas:**
- ¿Qué secciones de Planificación son de consulta diaria vs. retrospectiva?
- ¿Métricas muestra datos de todos los miembros o solo propios?
- ¿Jefe y miembro ven lo mismo?
**Prioridad:** 🔵 A evaluar con captura

---

## EXTRA IMPLEMENTADO

### E-01 — Fecha editable al registrar incidencia ✅ Resuelto
El modal de registro de incidencia incluye ahora un date picker para la fecha. Antes la fecha se fijaba automáticamente al día actual sin posibilidad de corrección.
**Archivos:** Modal de incidencia (dentro de `ModalMiSemana` o componente propio).

---

## DESCARTADOS / NO RECOMENDADOS

| Ítem | Razón |
|---|---|
| Migración a Tailwind v4 | Incompatible con InsForge MCP + `@layer`; documentado |
| Circuit breaker para API | Complejidad desproporcionada para 4–8 usuarios |
| `httpOnly` cookies para auth | Requiere proxy de auth propio; fuera de alcance con InsForge BaaS |
| Tour interactivo complejo | `OnboardingWelcome` actual es suficiente para V4 |
| Drag & drop en listas de Planificación | No añade valor claro; aumenta complejidad del modelo |

---

## RESUMEN CONSOLIDADO

| Ítem | Tipo | Esfuerzo | Estado |
|---|---|---|---|
| ~~B-01~~ Eliminar tarea 400 | Bug crítico | Bajo | ✅ Resuelto (BD: migración 027) |
| ~~B-02~~ Aprobar OT no actualiza | Bug crítico | Muy bajo | ✅ Resuelto |
| ~~B-03~~ Reprogramada no pasa a atrasada | Bug crítico | Medio | ✅ Resuelto (BD: migración 027 + backfill) |
| ~~U-01~~ Fecha límite bloqueada/editable | UX | Bajo | ✅ Resuelto |
| ~~U-02~~ Incidencias en columna del día | UX | Medio | ✅ Resuelto (+ P2-01 filas) |
| ~~U-03~~ Tipos OT → modal | UI jefe | Bajo | ✅ Resuelto (+ P2-05 label) |
| ~~M-01~~ Resumen del día al abrir Mi Semana | Mejora | Bajo | ✅ Resuelto |
| ~~M-02~~ Chip "Vence hoy" | Mejora | Muy bajo | ✅ Resuelto |
| ~~M-03~~ Confirmar completar tarea atrasada | Mejora | Bajo | ✅ Resuelto |
| ~~M-04~~ Estado OT en tarjeta de tarea | Mejora | Medio | ✅ Resuelto |
| ~~M-05~~ Historial en detalle de tarea | Mejora | Medio | ✅ Resuelto |
| ~~M-06~~ Filtro de miembro en Mi Semana (jefe) | Mejora jefe | — | ✅ Ya existía |
| M-07 Reordenar tareas en el día (DnD) | Mejora | Alto | ⏳ Post-V4 |
| M-08 Exportar semana/planificación PDF | Mejora | Medio-alto | ⚪ Post-V4 |
| M-09 Notificación 1 día antes de vencer | Mejora | Medio | 🔵 Pendiente |
| ~~M-10~~ Modo compacto | Mejora | Bajo | ↪️ Sustituido por P2-03 |
| ~~P2-01~~ Incidencias filas compactas | UX | Bajo | ✅ Resuelto |
| ~~P2-02~~ Deshabilitar drag en completadas | Bug | Muy bajo | ✅ Resuelto |
| ~~P2-03~~ Ocultar completadas | UX | Muy bajo | ✅ Resuelto |
| ~~P2-04~~ Objetivos: columna Responsable | UI | Muy bajo | ✅ Resuelto |
| ~~P2-05~~ OT: Tipos de trabajo + inactivos | UI | Bajo | ✅ Resuelto |
| ~~P2-06~~ OT: columna Creado por | UI | Muy bajo | ✅ Resuelto |
| ~~P2-07~~ OT: filtros simplificados | UX | Bajo | ✅ Resuelto (Propuesta A) |
| P2-08 Planificación/Métricas reorganización | UX | Por definir | 🔵 Con captura |

---

## VERIFICACIÓN TÉCNICA (Lote 2)

- `npm run build` — OK
- `npm test` — 208 tests pasando (Vitest)

**Pendiente operativo:** confirmar migración `027` aplicada en InsForge de producción si B-01/B-03 aún fallan en ese entorno.

*Documento actualizado tras implementación del Lote 2 en frontend (16/05/2026).*
