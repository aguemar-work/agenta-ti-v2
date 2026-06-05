# Modelo de tarea v1.1 — Nexora / SGTD

**Última actualización:** 2026-06-05  
**Migraciones:** `038` (aditiva) → `039` (lógica) → `040` (enum + limpieza)  
**Fuente de verdad en código:** `web/src/types/index.ts`, `web/src/lib/tableroEstado.ts`, `web/src/lib/estadoConfig.ts`

---

## Resumen

El modelo separa **dos ejes** que antes estaban mezclados en un solo enum `estado_tarea`:

| Eje | Dónde vive | Mutación | Uso en UI |
|-----|------------|----------|-----------|
| **1 — Estado persistido** | columna `tarea.estado` | RPCs / UPDATE | Transiciones, permisos, kanban (3 columnas activas) |
| **2 — Situación calculada** | columna `situacion` en vista `tarea_activa` | Solo lectura (vista) | Badges, conteos, filtros de alerta |

La UI une ambos ejes con **`claveVisualTarea()`** (`lib/tableroEstado.ts`) para badges y agrupación.

---

## Eje 1 — `estado` (enum `estado_tarea`)

Valores permitidos (migración **040**):

```
pendiente · en_progreso · completada · cancelada
```

### Máquina de estados

```
pendiente ──→ en_progreso ──→ completada
    │              │
    └──────┬───────┘
           ↓
       cancelada
```

- **Iniciar:** `pendiente → en_progreso` (RPC `sgtd_cambiar_estado_tarea`, log `iniciada`)
- **Completar:** `en_progreso → completada` (log `completada`)
- **Cancelar:** desde `pendiente` o `en_progreso` → `cancelada` (justificación ≥10 chars, log `cancelada`)

### Eliminado en v1.1

- `bloqueada` / `desbloqueada` — sin RPC ni UI
- `atrasada` / `reprogramada` como valor de `estado` — migrados a eje 2

---

## Eje 2 — `situacion` (vista `tarea_activa`)

Tipo TypeScript: `SituacionTarea = 'atrasada' | 'reprogramada' | 'creada'`  
En terminales (`completada`, `cancelada`): `situacion = null`.

### Fórmula (post-040)

```sql
CASE
  WHEN estado IN ('completada','cancelada') THEN NULL
  WHEN tipo = 'planificada'
       AND fecha_planificada < CURRENT_DATE
       AND estado IN ('pendiente','en_progreso')
    THEN 'atrasada'
  WHEN reprogramaciones > 0 THEN 'reprogramada'
  ELSE 'creada'
END
```

**Prioridad:** `atrasada` gana sobre `reprogramada` (una tarea reprogramada y vencida muestra badge atrasada).

### Columna `reprogramaciones`

- Entero ≥ 0 en `tarea.reprogramaciones` (migración **038**)
- Se incrementa en `sgtd_reprogramar_tarea_con_log` y en DnD de día (migración **039**)
- Reprogramar **no cambia** `estado` — solo fecha + contador + log `reprogramada`

### Cálculo en frontend (fallback)

Si la query no trae `situacion`, `claveVisualTarea()` replica la lógica con `fechaLocalYmd(hoy)` — ver `lib/tableroEstado.ts`. Preferir siempre leer desde `tarea_activa`.

---

## Clave visual (`ClaveVisualTarea`)

Unión de eje 1 + alertas del eje 2 para UI:

| `claveVisualTarea()` | Origen |
|--------------------|--------|
| `pendiente` | `estado = pendiente`, sin situación de alerta |
| `en_progreso` | `estado = en_progreso` |
| `completada` / `cancelada` | `estado` terminal |
| `atrasada` | `situacion = atrasada` |
| `reprogramada` | `situacion = reprogramada` (y no atrasada) |

**Config visual:** `TAREA_BADGE`, `TAREA_PILL`, `TAREA_LABEL` en `lib/estadoConfig.ts` — claves = `ClaveVisualTarea`, no el enum de BD.

---

## Tipo de tarea (`tipo_tarea`)

Solo dos valores (migración **040**):

| Tipo | `fecha_planificada` | `semana_planificada` |
|------|---------------------|----------------------|
| `planificada` | obligatoria | obligatoria (`YYYYWW`) |
| `no_planificada` | = hoy (imprevistos) | = semana actual |

**Eliminado:** `libre` — ideas sin fecha viven en `nota_bitacora`.

---

## Prioridad (`prioridad_tarea`)

```
critica · alta · media · baja
```

Pesos para métricas (`lib/constants.ts`):

| Prioridad | Peso |
|-----------|------|
| `critica` | 4 |
| `alta` | 3 |
| `media` | 2 |
| `baja` | 1 |

---

## Consultas y filtros (frontend)

- **Tabla operativa:** `tarea_activa` (no `tarea` directa salvo casos puntuales)
- **Mi Semana — semana + atrasadas de otras semanas:**
  ```ts
  .or(`semana_planificada.eq.${semanaISO},situacion.eq.atrasada`)
  ```
- **Kanban interno:** 3 columnas (`pendiente`, `en_progreso`, `completada`) — tareas con situación atrasada/reprogramada caen en `pendiente` visualmente en el tablero
- **No filtrar** `estado.eq.atrasada` ni `estado.eq.reprogramada` — esos valores ya no existen en BD

---

## RPCs vivas (tarea)

| RPC | Propósito |
|-----|-----------|
| `sgtd_crear_tarea_planificada` | Alta planificada |
| `sgtd_cambiar_estado_tarea` | Iniciar / completar / cancelar |
| `sgtd_reprogramar_tarea_con_log` | Nueva fecha + `reprogramaciones++` (sin cambiar estado) |
| `sgtd_eliminar_tarea_con_motivo` | Soft-delete (`eliminada_en`) + log |
| `sgtd_mover_tarea_dia` | DnD entre días en Mi Semana |
| `sgtd_mover_tarea_columna` | Cambio de columna kanban (si aplica) |
| `sgtd_completar_tarea_con_resumen` | Completar con resumen (sync OT) |

### RPCs eliminadas (040)

- `sgtd_bloquear_tarea_con_log`
- `sgtd_desbloquear_tarea_con_log`
- `sgtd_fn_marcar_atrasada` / triggers SLA por estado bloqueada

### No-op (compatibilidad)

- `sgtd_marcar_atrasadas_vencidas` / `sgtd_marcar_atrasadas_equipo` — retornan 0 (039)

---

## Log de acciones (`log_accion`)

Tipos **activos** para nuevas acciones: `creada`, `iniciada`, `reprogramada`, `cancelada`, `completada`, `eliminada`, `editada`, etc.

Tipos **legacy** (solo lectura en historial): `bloqueada`, `desbloqueada` — pueden existir en filas antiguas; la UI muestra label pero no ofrece la acción.

Justificación obligatoria (≥10 chars) para: **reprogramar**, **cancelar**, **eliminar**.

---

## SLA y notificaciones (jefe)

- Alertas basadas en **`situacion = atrasada`**, no en estado `bloqueada`
- `sgtd_resumen_sla_jefe`: `bloqueadas_criticas` deprecado → siempre `0` (039)
- Evento realtime `tarea_bloqueada_critica` eliminado del frontend
- Columna `sla_bloqueada_notificada_at` eliminada (040); dedup de atraso: `sla_atrasada_notificada_at` (038)

---

## Archivos frontend clave

| Archivo | Rol |
|---------|-----|
| `types/index.ts` | `EstadoTarea`, `SituacionTarea`, `ClaveVisualTarea` |
| `lib/schemas.ts` | Zod — rechaza estados legacy |
| `lib/tableroEstado.ts` | `claveVisualTarea()`, `esEstadoPersistido()` |
| `lib/estadoConfig.ts` | Badges/pills por `ClaveVisualTarea` |
| `lib/tareaTables.ts` | Constante `TAREA_ACTIVA = 'tarea_activa'` |
| `api/semana.ts`, `hooks/useTareas.ts` | Filtros con `situacion.eq.atrasada` |

---

## Secuencia de migraciones

| # | Qué hace |
|---|----------|
| **038** | `reprogramaciones`, `sla_atrasada_notificada_at`, prioridad `critica`, vista `tarea_activa` con dual-read |
| **039** | Quita triggers de atrasada/bloqueada; RPCs de 4 estados; reprogramar sin cambiar estado; cron SLA |
| **040** | Enum 4+2; DROP RPCs bloquear/desbloquear; vista `situacion` final; DROP `sla_bloqueada_notificada_at` |

**Checklist por entorno:** `.cursor/rules/CONTEXT.mdc` §12.

---

## QA rápido post-migración

1. Mi Semana muestra atrasadas de semanas anteriores (filtro `situacion`)
2. Reprogramar por DnD: badge «Reprogramada», `estado` sigue `pendiente`
3. Iniciar solo desde `pendiente` (incluye visualmente atrasada/reprogramada)
4. Métricas: sin columna bloqueadas; atrasadas/reprogramadas por clave visual
5. Prioridad **Crítica** visible en formularios y badges
