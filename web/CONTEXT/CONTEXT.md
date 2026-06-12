# CONTEXT — Materen / SGTD (Agenda TI v3) · V4

**Última actualización:** 2026-06-10

Este archivo es la **fuente de verdad del schema y convenciones** referenciada por las reglas del agente. El contexto operativo completo (módulos, deploy, checklist de migraciones) vive en `.cursor/rules/CONTEXT.mdc`.

---

## Documentos relacionados

| Documento | Contenido |
|-----------|-----------|
| [MATEREN-V5-WORKSPACE.md](./MATEREN-V5-WORKSPACE.md) | **V5 (diseño):** multi-org, multi-workspace, roles por membresía, tipos interno/agencia |
| [TAREA-MODEL.md](./TAREA-MODEL.md) | Modelo de tarea v1.1 (dos ejes, RPCs, filtros, QA) |
| [PRIVACIDAD-LEY29733.md](./PRIVACIDAD-LEY29733.md) | Plantilla tratamiento de datos (Ley 29733) — revisión Legal |
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

## V5 — Workspace y módulos (post migración 050)

Detalle completo: [MATEREN-V5-WORKSPACE.md](./MATEREN-V5-WORKSPACE.md).

### Tabla `workspace_modulo` (044, módulos libres desde 045)

| Columna | Tipo | Notas |
|---------|------|-------|
| `workspace_id` | uuid FK → workspace | PK compuesta |
| `modulo` | text | `areas`, `proyectos`, `clientes`, `ordenes_trabajo`, `objetivos`, `bitacora` |
| `activo` | boolean | `false` = ocultar en UI; datos se conservan |
| `activado_en`, `updated_at` | timestamptz | |

**Catálogo vs nav:** `/semana` = core (no configurable). `/planificacion` y `/metricas` = rol jefe. `/objetivos` y `/ordenes-trabajo` se filtran por módulo activo (AppShell Fase 2).

**Módulos libres (045):** cualquier workspace puede activar cualquier módulo del catálogo. `workspace.tipo` (`interno`/`agencia`) queda como **etiqueta informativa** — sin poder de restricción. Trigger `workspace_modulo_validar` solo protege **`bitacora`** (obligatorio; `objetivos` opcional desde 047) y `updated_at`. RLS de catálogos (`cliente`, `proyecto`, `area`) y `orden_trabajo` exigen módulo activo vía `sgtd_workspace_tiene_modulo`.

**RPCs V5 (operativas):** `sgtd_crear_organizacion` (solo dueño; acepta combinación del catálogo + fuerza `bitacora`), `sgtd_workspace_tiene_modulo`. ~~`sgtd_modulo_valido_para_tipo`~~ eliminada en 045.

**RPCs V5 (panel del dueño):**

| RPC | Propósito |
|-----|-----------|
| `sgtd_es_plataforma_owner()` | Boolean — ¿auth.uid() es dueño de plataforma? |
| `sgtd_crear_organizacion(...)` | Crear org + workspace bootstrap (solo dueño, 047) |
| `sgtd_listar_usuarios_plataforma()` | Lista usuarios en `public.usuario` (solo dueño, 049) |
| `sgtd_asignar_usuario_a_organizacion(...)` | Asigna jefe/miembro en `workspace_member` (solo dueño, 049) |
| `sgtd_listar_modulos_organizacion(...)` | Lista módulos de una org por `organizacion_id` (050) |
| `sgtd_set_modulo_organizacion(...)` | Activa/desactiva módulo por org (050; protege `bitacora`) |

---

## Migraciones V5 (043–050)

| # | Archivo | Estado | Contenido |
|---|---------|--------|-----------|
| 043 | `043_workspace_foundation.sql` | ✅ Dev | Org, workspace, RLS V5, backfill |
| 044 | `044_workspace_modulo.sql` | ✅ Dev | Módulos por workspace, bootstrap org |
| 045 | `045_modulos_libres.sql` | ✅ Dev | Módulos libres; RLS por módulo; `tipo` = etiqueta |
| 046 | `046_workspace_id_rpcs_catalogos` | ✅ Dev | Fix `workspace_id` en RPCs + catálogos en tarea |
| 047 | `047_duenio_plataforma.sql` | ✅ Dev | Dueño plataforma; solo `bitacora` obligatorio |
| 048 | `048_superadmin_plataforma_owner.sql` | ✅ Dev | Superadmin: dueño opera todas las orgs |
| 049 | `049_gestion_usuario.sql` | ✅ Dev | Listar + asignar usuarios a org |
| 050 | `050_modulos_organizacion.sql` | ✅ Dev | Gestionar módulos por org desde panel |

Al publicar cada migración:

1. Actualizar `.cursor/rules/CONTEXT.mdc` §9 y §12
2. Actualizar [MATEREN-V5-WORKSPACE.md](./MATEREN-V5-WORKSPACE.md) si cambia el schema
3. Actualizar [CONTEXT.md](./CONTEXT.md) si cambia el schema de tarea u otra tabla canónica
