# CONTEXT — Nexora / SGTD (Agenda TI v3) · V4

**Última actualización:** 2026-06-05

Este archivo es la **fuente de verdad del schema y convenciones** referenciada por las reglas del agente. El contexto operativo completo (módulos, deploy, checklist de migraciones) vive en `.cursor/rules/CONTEXT.mdc`.

---

## Documentos relacionados

| Documento | Contenido |
|-----------|-----------|
| [TAREA-MODEL.md](./TAREA-MODEL.md) | Modelo de tarea v1.1 (dos ejes, RPCs, filtros, QA) |
| `.cursor/rules/CONTEXT.mdc` | Stack, rutas, módulos, migraciones 002–040, checklist por entorno |
| `.cursor/rules/sgtd-business-rules.mdc` | Reglas de negocio obligatorias |
| `.cursor/rules/sgtd-ot.mdc` | Flujo de Órdenes de Trabajo |

---

## Schema de tarea (v1.1 — post migración 040)

### Tabla `tarea` (columnas relevantes)

| Columna | Tipo | Notas |
|---------|------|-------|
| `estado` | `estado_tarea` enum | `pendiente`, `en_progreso`, `completada`, `cancelada` |
| `tipo` | `tipo_tarea` enum | `planificada`, `no_planificada` |
| `prioridad` | `prioridad_tarea` enum | `critica`, `alta`, `media`, `baja` |
| `fecha_planificada` | `date` | Obligatoria si `planificada` |
| `semana_planificada` | `text` | Formato `YYYYWW` |
| `reprogramaciones` | `integer` | Contador; base de `situacion=reprogramada` |
| `eliminada_en` | `timestamptz` | Soft-delete (034) |
| `sla_atrasada_notificada_at` | `timestamptz` | Dedup notificación atraso (038) |

### Vista `tarea_activa`

- `security_invoker = true` — respeta RLS del caller
- Expone todas las columnas de `tarea` + **`situacion`** calculada
- Filtro: `eliminada_en IS NULL`
- **Usar esta vista** en queries del frontend (`TAREA_ACTIVA` en `lib/tareaTables.ts`)

Detalle de fórmulas y transiciones: **[TAREA-MODEL.md](./TAREA-MODEL.md)**.

---

## Otros enums principales

### `estado_objetivo`
`activo` · `completado` · `cancelado`

### `log_accion.tipo_accion` (text + CHECK)
Valores activos + legacy `bloqueada`/`desbloqueada` en historial.

### OT `orden_trabajo.estado`
`borrador` → `pendiente` → `aprobada` → `completada` (+ `rechazada`, `cancelada`)

---

## Convenciones frontend (no romper)

```
Page → useXxxPage → api/xxx.ts → InsForge SDK
```

- Estados visuales: `claveVisualTarea()` + `estadoConfig.ts` (`ClaveVisualTarea`)
- No escribir `atrasada`/`reprogramada`/`bloqueada` en `estado`
- No calcular `atrasada` mutando filas — leer `situacion` de `tarea_activa`
- Zod en `lib/schemas.ts` rechaza estados legacy

---

## Próxima migración

La siguiente migración del repo sería **`041_*.sql`**. Al añadirla:

1. Crear archivo en `db/migrations/`
2. Actualizar `.cursor/rules/CONTEXT.mdc` §9 y §12
3. Actualizar este archivo si cambia el schema de tarea u otra tabla canónica
