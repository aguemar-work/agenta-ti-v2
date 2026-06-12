# Migraciones SGTD — `db/migrations/`

Scripts SQL numerados (`002` … `054`) aplicados **manualmente** en InsForge (SQL Editor o CLI).

**Fuente operativa:** este directorio. `../schema.sql` es referencia (puede ir desfasado); en entornos vivos aplicar migraciones en orden.

**Checklist vivo por entorno:** `.cursor/rules/CONTEXT.mdc` → sección **12. Gestión de migraciones**.

---

## Validación rápida

### 1. Enlazar el entorno correcto

```bash
npx @insforge/cli whoami
npx @insforge/cli current
```

Si no hay proyecto: `npx @insforge/cli link`.

### 2. Nivel proyecto (recomendado)

Comprobar **objetos** que solo existen o cambian con nuestra migración.

| Migración | Identificador | Query mínima |
|-----------|---------------|--------------|
| **027** | RPC `sgtd_marcar_atrasadas_vencidas` | Ver abajo |

```bash
npx @insforge/cli db query "SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND proname = 'sgtd_marcar_atrasadas_vencidas') AS ok"
```

También útil:

```bash
npx @insforge/cli db functions
```

### 3. Nivel plataforma InsForge (opcional)

Migraciones internas del servicio — **no** lista los archivos `00N_*.sql` de este repo:

```bash
npx @insforge/cli db query "SELECT * FROM system.migrations ORDER BY run_on DESC"
```

---

## Migración 027 — validación completa

**Archivo:** `027_fix_eliminar_atrasada_ot.sql`  
**Negocio:** B-01 eliminar tarea sin P0001 · B-03 `reprogramada` vencida → `atrasada`

### Aplicar (si `ok = false`)

1. Ejecutar el archivo SQL completo en el entorno.
2. Backfill una sola vez:
   ```sql
   SELECT public.sgtd_marcar_atrasadas_vencidas();
   ```

### Comprobaciones SQL

```sql
-- RPC nueva de 027
SELECT proname FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND proname = 'sgtd_marcar_atrasadas_vencidas';

-- Trigger atrasada incluye reprogramada
SELECT pg_get_functiondef(p.oid) LIKE '%reprogramada%' AS trigger_incluye_reprogramada
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND proname = 'sgtd_fn_marcar_atrasada';
```

### QA manual (app)

- Eliminar tarea con motivo ≥ 10 caracteres → sin error P0001; log `eliminada`.
- Tarea `reprogramada` con `fecha_planificada` en el pasado → estado `atrasada` (tras backfill o al guardar).

### Actualizar checklist

Marcar ✅ en `CONTEXT.mdc` §12 para el entorno validado (Dev / Staging / Prod).

---

## Convenciones al crear `028_*.sql`

1. Nombre: `028_descripcion_corta.sql`
2. Transacción `BEGIN` / `COMMIT` si aplica.
3. Prefijo `sgtd_` en RPCs nuevas.
4. Actualizar `../schema.sql` en el mismo PR (o inmediatamente después).
5. Añadir fila en `CONTEXT.mdc` §9 y §12 con **identificador técnico** y query de verificación.
6. Documentar en esta tabla:

| Migración | Identificador | Query |
|-----------|---------------|-------|
| **028** | `ck_ot_completada_tiene_receptor` | Ver sección **Migración 028** abajo |

---

## Migración 028 — validación completa

**Archivo:** `028_check_ot_completada_receptor.sql`  
**Negocio:** A-03 — OT `completada` exige `receptor_nombre` y `receptor_dni` (cargo opcional).

### Pre-flight (obligatorio)

```sql
SELECT id, numero, estado, receptor_nombre, receptor_dni
FROM public.orden_trabajo
WHERE estado = 'completada'
  AND (
    receptor_nombre IS NULL OR btrim(receptor_nombre) = ''
    OR receptor_dni    IS NULL OR btrim(receptor_dni)    = ''
  );
```

→ **0 filas** antes de aplicar el SQL. Si hay filas, corregir o anular esas OTs.

### Aplicar

1. Ejecutar el archivo completo en el entorno.
2. En `web/.env` (local) y Vercel cuando corresponda:
   ```
   VITE_OT_MIGRATION_028=true
   ```
3. Reiniciar `npm run dev`.

### Comprobaciones SQL

```bash
npx @insforge/cli db query "SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.orden_trabajo'::regclass AND conname = 'ck_ot_completada_tiene_receptor') AS migration_028_ok"
```

### QA manual (app)

- Completar OT con nombre + DNI → OK.
- Intentar cierre sin DNI → error RPC (P0005).
- Listado de OTs completadas carga sin `SchemaParseError` (con flag activo).

---

## Migración 031 — validación completa

**Archivo:** `031_seguridad_rol_y_notas_equipo.sql`  
**Negocio:** anti-escalada de `rol` en `usuario` · miembro lee notas del equipo con `visibilidad = 'todos'`.

### Comprobaciones SQL

```bash
npx @insforge/cli db query "SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sgtd_proteger_rol_usuario') AS migration_031_ok"
```

```sql
-- Política SELECT de notas incluye visibilidad
SELECT pg_get_expr(polqual, polrelid) LIKE '%visibilidad%'
FROM pg_policy
WHERE polrelid = 'public.nota_bitacora'::regclass
  AND polname = 'sgtd_miembro_nota_select';
```

### QA manual (app)

- Login como **miembro**: `UPDATE usuario SET rol = 'jefe'` sobre fila propia → error 42501.
- Panel **Notas** en Mi Semana: aparece nota ajena con `todos`; no aparece `solo_jefe`/`privado` ajena.
- Login como **jefe**: panel muestra todas las notas recientes (sin filtro `.or` en API).

Tras aplicar: desplegar frontend con `getNotasBitacoraRecientes(..., esJefe)`.

---

## Migración 032 — validación completa

**Archivo:** `032_notify_tarea_asignada.sql`  
**Negocio:** toast `tarea_asignada` al miembro cuando el jefe (u otro) le asigna o reasigna una tarea.

### Comprobaciones SQL

```bash
npx @insforge/cli db query "SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND proname = 'sgtd_notificar_tarea_asignada') AS migration_032_ok"
```

### QA manual (app)

- Login **jefe** + **miembro** en dos ventanas (realtime conectado en ambos).
- Jefe crea tarea planificada para el miembro (Planificación, Objetivos o Mi Semana) → miembro recibe toast «Nueva tarea asignada (Nombre Jefe): …» y la tarea aparece en su semana.
- Jefe reasigna tarea existente a otro miembro → nuevo asignado recibe toast.
- Miembro crea tarea para sí mismo → **sin** toast.

---

## Migración 033 — validación completa

**Archivo:** `033_sync_tarea_ot.sql`  
**Negocio:** vínculo bidireccional tarea ↔ OT; completar tarea cancela OTs abiertas; completar OT cierra tarea vinculada; botón «Generar OT» en Mi Semana.

### Comprobaciones SQL

```bash
npx @insforge/cli db query "SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND proname = 'sgtd_crear_ot_desde_tarea') AS migration_033_ok"
```

### QA manual (app)

- Tarea con OT borrador → «Generar OT» no duplica; abre la OT existente en `/ordenes-trabajo`.
- Tarea sin OT → «Generar OT» crea borrador y abre formulario.
- Completar tarea en progreso → OT vinculada pasa a `cancelada`.
- Completar OT en ejecución con tarea vinculada → tarea pasa a `completada`.

---

## Migración 034 — validación completa

**Archivo:** `034_soft_delete_tarea.sql`  
**Negocio:** eliminar tarea = soft-delete (`eliminada_en`); log `eliminada` conserva `tarea_id`; lecturas operativas vía `tarea_activa` (RLS invoker).

### Comprobaciones SQL

```bash
npx @insforge/cli db query "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tarea' AND column_name = 'eliminada_en') AS migration_034_ok"
```

### QA manual (app)

- Eliminar tarea con motivo ≥10 chars → desaparece de Mi Semana; log persiste con `tarea_id`.
- Planificación → justificación «Eliminación» muestra título (mapa o `valor_anterior`).
- Tarea soft-deleted con `estado=atrasada` no reaparece en grilla (ni por `.or(estado.eq.atrasada)`).
- Jefe puede consultar fila en `tarea` (RLS sin cambios) para historial futuro.

---

## Migración 035 — validación completa

**Archivo:** `035_fix_grant_cancelar_ots.sql`  
**Negocio:** fix 42501 al eliminar/completar tarea con OT vinculada.

```bash
npx @insforge/cli db query "SELECT has_function_privilege('authenticated', 'public.sgtd_cancelar_ots_vinculadas_tarea(uuid,uuid,text)', 'EXECUTE') AS migration_035_ok"
```

---

## Migración 036 — validación completa

**Archivo:** `036_simplificar_flujo_ot.sql`  
**Negocio:** flujo OT 4 estados; número al enviar; sin `en_ejecucion`.

**Prerrequisitos:** 033, 034.

```bash
npx @insforge/cli db query "SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND proname = 'sgtd_enviar_ot') AS migration_036_ok"
```

QA: `.cursor/rules/sgtd-ot.mdc` § QA manual.

---

## Migración 037 — validación completa

**Archivo:** `037_fix_ck_ot_numero_cancelada.sql`  
**Negocio:** cancelar borrador sin número no viola CHECK.

```bash
npx @insforge/cli db query "SELECT (pg_get_constraintdef(c.oid) LIKE '%cancelada%') AS migration_037_ok FROM pg_constraint c WHERE c.conrelid = 'public.orden_trabajo'::regclass AND c.conname = 'ck_ot_pendiente_tiene_numero'"
```

---

## Migración 038 — validación completa

**Archivo:** `038_tarea_model_fase_aditiva.sql`  
**Negocio:** fase aditiva del modelo v1.1 — sin tocar enums de estado.

```bash
npx @insforge/cli db query "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tarea' AND column_name='reprogramaciones') AS migration_038_ok"
```

```sql
SELECT situacion, count(*) FROM public.tarea_activa GROUP BY 1 ORDER BY 1;
```

---

## Migración 039 — validación completa

**Archivo:** `039_logica_dos_ejes.sql`  
**Negocio:** reprogramar no cambia `estado`; SLA depreca `bloqueadas_criticas`.

```bash
npx @insforge/cli db query "SELECT pg_get_functiondef(p.oid) NOT LIKE '%bloqueada%' AS sin_bloqueada FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='public' AND proname='sgtd_cambiar_estado_tarea'"
```

---

## Migración 040 — validación completa

**Archivo:** `040_reduccion_enums_y_limpieza.sql`  
**Negocio:** enum 4 estados + 2 tipos; elimina RPCs bloquear/desbloquear.

```bash
npx @insforge/cli db query "SELECT count(*) AS estados FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='estado_tarea'"
```

Esperado: `estados = 4`. RPCs `sgtd_bloquear_tarea_con_log` y `sgtd_desbloquear_tarea_con_log` ausentes.

**No re-ejecutar** en un entorno donde 040 ya aplicó correctamente.

Detalle del modelo: `web/CONTEXT/TAREA-MODEL.md`.

---

## Migración 042 — validación completa

**Archivo:** `042_rpc_objetivos_con_progreso.sql`  
**Negocio:** progreso de objetivos agregado en servidor (reemplaza fetch masivo de tareas en cliente).

```bash
npx @insforge/cli db query "SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND proname = 'sgtd_objetivos_con_progreso') AS ok"
```

Esperado: `ok = true`.

---

## Migración 041 — validación completa

**Archivo:** `041_indice_ot_tarea_id.sql`  
**Negocio:** acelera lookup OT por `tarea_id` (Mi Semana, sync tarea↔OT).

```bash
npx @insforge/cli db query "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'orden_trabajo' AND indexname = 'idx_orden_trabajo_tarea_id'"
```

Esperado: 1 fila.

---

## Migración 043 — validación completa

**Archivo:** `043_workspace_foundation.sql`  
**Negocio:** V5 multi-tenant — org, workspace, membresías, `workspace_id` en tablas de dominio, RLS por workspace.

**Prerrequisito:** 002–042 según checklist §12.

### Comprobaciones SQL

```bash
npx @insforge/cli db query "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='workspace_member') AS migration_043_ok"
```

Estado parcial o diagnóstico completo: ejecutar `043_check_status.sql`.

Esperado: `tablas_v5_ok = true`, `funciones_v5_ok = true`, `estado = APLICADA_OK`.

### QA manual (app)

- Login → bootstrap workspace (auto o selector).
- Header `x-workspace-id` en peticiones PostgREST.
- Jefe/miembro operan solo datos del workspace activo.

---

## Migración 044 — validación completa

**Archivo:** `044_workspace_modulo.sql`  
**Negocio:** módulos configurables por workspace; RPC bootstrap `sgtd_crear_organizacion`; backfill por tipo (`interno` / `agencia`).

**Prerrequisito:** 043 aplicada.

### Comprobaciones SQL

```bash
npx @insforge/cli db query "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='workspace_modulo') AS migration_044_ok"
```

```bash
npx @insforge/cli db query "SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND proname = 'sgtd_crear_organizacion') AS rpc_crear_org_ok"
```

### QA manual (app)

- Backfill ws `interno`: `ordenes_trabajo`, `objetivos`, `bitacora` (sin `areas`).
- Backfill ws `agencia`: `areas`, `proyectos`, `clientes`, `objetivos`, `bitacora`.
- `sgtd_workspace_tiene_modulo(ws_id, 'objetivos')` → true.
- Frontend pendiente: cargar módulos en `workspaceStore` y filtrar nav.

Smoke tests T1–T9: comentarios al final de `044_workspace_modulo.sql`.

---

## Migración 045 — validación completa

**Archivo:** `045_modulos_libres.sql`  
**Negocio:** módulos libres — sin enforcement `workspace.tipo`↔módulo; RLS de catálogos y OT por módulo activo; `tipo` = etiqueta.

**Prerrequisito:** 044 aplicada.

### Comprobaciones SQL

```bash
npx @insforge/cli db query "SELECT NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname='public' AND p.proname='sgtd_modulo_valido_para_tipo') AS migration_045_ok"
```

Esperado: `migration_045_ok = true`.

Complemento: políticas `cliente_insert`, `proyecto_insert`, `area_insert` y `orden_trabajo` usan `sgtd_workspace_tiene_modulo` (verificar con `pg_policies`).

### QA manual (app)

- Activar `clientes` en workspace `tipo = interno` → INSERT OK (antes fallaba en 044).
- Desactivar `bitacora` → EXCEPTION obligatorio (trigger; desde 047 solo `bitacora` es obligatorio).
- `sgtd_crear_organizacion(..., 'interno', ARRAY['areas','clientes','ordenes_trabajo'])` → modulos incluye combinación + obligatorios.
- Nav AppShell oculta `/objetivos` y `/ordenes-trabajo` si módulo inactivo.

Smoke tests T1–T5: comentarios al final de `045_modulos_libres.sql`.

---

## Migración 046 — validación completa

**Archivo:** `046_workspace_id_rpcs_catalogos`  
**Negocio:** corrige 11 RPCs que insertaban en `tarea`/`log_accion`/`log_ot` sin `workspace_id` (NOT NULL desde 043 → crear tareas fallaba). Agrega cliente/proyecto/área a las RPCs de tarea.

**Prerrequisito:** 043–045.

### Comprobaciones SQL

Smoke test principal: crear una tarea planificada debe funcionar (era el bug crítico).

### QA manual (app)

- Crear tarea planificada en workspace V5 → sin error NOT NULL en `workspace_id`.
- Formulario de tarea acepta cliente/proyecto/área cuando los módulos están activos.

---

## Migración 047 — validación completa

**Archivo:** `047_duenio_plataforma.sql`  
**Negocio:** tabla `plataforma_owner` + `sgtd_es_plataforma_owner()`; solo el dueño crea orgs; `objetivos` deja de ser obligatorio (solo `bitacora`).

**Prerrequisito:** 043–046.

### Comprobaciones SQL

```bash
npx @insforge/cli db query "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='plataforma_owner') AS owner_047_ok;"
```

Esperado: `owner_047_ok = true`.

### QA manual (app)

- Dueño crea org (ok, sin forzar `objetivos`).
- No-dueño al crear org → «No tienes permiso».

---

## Migración 048 — validación completa

**Archivo:** `048_superadmin_plataforma_owner.sql`  
**Negocio:** el dueño ve y opera todas las orgs. Bypass centralizado en helpers (`sgtd_puede_acceder_workspace`, `sgtd_es_jefe`, `sgtd_es_miembro_activo`) + `organizacion_select`.

**Prerrequisito:** 047 aplicada.

### Comprobaciones SQL

```bash
npx @insforge/cli db query "SELECT bool_and(pg_get_functiondef(p.oid) LIKE '%plataforma_owner%') FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='public' AND p.proname IN ('sgtd_puede_acceder_workspace','sgtd_es_jefe','sgtd_es_miembro_activo');"
```

Esperado: `true`.

### QA manual (app)

- Dueño entra a org ajena → opera como jefe (header `x-workspace-id` fijado).
- **Crítico:** un NO-dueño NO gana acceso extra (sigue viendo solo su org). Miembro normal opera igual que antes.

---

## Migración 049 — validación completa

**Archivo:** `049_gestion_usuario.sql`  
**Negocio:** `sgtd_listar_usuarios_plataforma()` + `sgtd_asignar_usuario_a_organizacion()` (solo dueño).

**Prerrequisito:** 048 aplicada.

### Comprobaciones SQL

```bash
npx @insforge/cli db query "SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='public' AND p.proname='sgtd_asignar_usuario_a_organizacion') AS asignar_049_ok;"
```

Esperado: `asignar_049_ok = true`.

### QA manual (app)

- Dueño asigna un usuario a una org → al entrar, el usuario ve esa org.
- No-dueño → «No tienes permiso».

---

## Migración 050 — validación completa

**Archivo:** `050_modulos_organizacion.sql`  
**Negocio:** `sgtd_listar_modulos_organizacion()` + `sgtd_set_modulo_organizacion()` (solo dueño). Gestionar módulos por org desde el panel (sin header). Protege `bitacora`.

**Prerrequisito:** 049 aplicada.

### Comprobaciones SQL

```bash
npx @insforge/cli db query "SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='public' AND p.proname='sgtd_set_modulo_organizacion') AS modulos_050_ok;"
```

Esperado: `modulos_050_ok = true`.

### QA manual (app)

- Desactivar un módulo lo oculta del nav pero conserva datos; reactivar lo vuelve a mostrar.
- No se puede desactivar `bitacora`.

---

## Migración 051 — validación completa

**Archivo:** `051_backfill_workspaces.sql`
**Negocio:** Orgs activas sin workspace bloquean el panel de módulos con HTTP 400 (P0002 en `sgtd_listar_modulos_organizacion`). Esta migración crea un workspace `'Principal' / interno` e inserta el módulo obligatorio `bitacora` para cada org afectada.

**Prerrequisito:** 043–050 aplicadas.

### Pre-apply (obligatorio antes de prod)

Identificar las orgs afectadas y confirmar que son legítimas (no filas fantasma):

```sql
SELECT o.id, o.nombre, o.slug, o.activa,
       (SELECT COUNT(*) FROM workspace w WHERE w.organizacion_id = o.id) AS n_workspaces
FROM organizacion o
WHERE o.activa = true
  AND NOT EXISTS (SELECT 1 FROM workspace w WHERE w.organizacion_id = o.id);
```

### Comprobaciones SQL post-apply

```bash
# Validación principal (esperado: 0)
npx @insforge/cli db query "SELECT COUNT(*) AS orgs_sin_workspace FROM organizacion o WHERE o.activa = true AND NOT EXISTS (SELECT 1 FROM workspace w WHERE w.organizacion_id = o.id)"

# Sin duplicados (esperado: 0 filas)
npx @insforge/cli db query "SELECT organizacion_id, COUNT(*) AS n FROM workspace GROUP BY organizacion_id HAVING COUNT(*) > 1"
```

### QA manual (app)

- Abrir "Gestionar módulos" en una org que antes fallaba → modal muestra 6 módulos (`bitacora` activo, resto inactivo); sin error 400.
- Activar un módulo → `sgtd_set_modulo_organizacion` responde OK; modal refleja el cambio.
- "Entrar" a la org → el dueño entra (bypass 048); usuarios normales sin membresía siguen sin acceso operativo.

### Alcance y límites

- **Desbloquea:** panel de módulos (`sgtd_listar_modulos_organizacion`, `sgtd_set_modulo_organizacion`).
- **No resuelve:** membresías operativas; workspaces con `activo = false`; datos legados reasignados a otro workspace.
- **Módulos iniciales:** solo `bitacora` (obligatorio). El resto se activa manualmente desde el panel.

---

## Migración 052 — no-op (hipótesis descartada)

**Archivo:** `052_reactivar_workspaces.sql`
**Estado:** No-op. Se redactó suponiendo que orgs con workspace `activo = false` explicaban el HTTP 400 del panel de módulos. La auditoría pre-apply en dev mostró que todas las orgs tenían workspace `activo = true`. La causa real fue ERRCODE 42702 (ver 053). El archivo se conserva por numeración; si se aplica, solo emite NOTICE sin mutar datos.

---

## Migración 053 — validación completa

**Archivo:** `053_fix_listar_modulos_ambiguedad.sql`
**Negocio:** `sgtd_listar_modulos_organizacion` (050) declara `RETURNS TABLE (modulo text, activo boolean)`, creando una variable PL/pgSQL implícita `activo`. En el cuerpo, `AND activo = true` sin calificar era ambiguo entre `workspace.activo` (columna de tabla) y la variable de output. PostgreSQL lanzaba ERRCODE 42702 en cada llamada → HTTP 400 en el modal de módulos. La función compiló en 050 (`CREATE OR REPLACE` no ejecuta el cuerpo), pero falló en runtime.

**Fix:** recrear la función con alias `w` en la query de workspace (`w.activo`) y sin alias `AS activo` en `RETURN QUERY` (mapeo por posición).

**Prerrequisito:** 050 aplicada.

### Comprobaciones SQL post-apply

```bash
npx @insforge/cli db query "SELECT * FROM sgtd_listar_modulos_organizacion('<org-id>')"
```

Esperado: 6 filas (`areas`, `proyectos`, `clientes`, `ordenes_trabajo`, `objetivos`, `bitacora`) sin error.

### QA manual (app)

- Abrir "Gestionar módulos" en cualquier org del panel → modal muestra 6 checkboxes sin error.
- Toggle un módulo → `sgtd_set_modulo_organizacion` responde OK.
- `bitacora` siempre marcado y bloqueado.

---

## Migración 054 — validación completa

**Archivo:** `054_desactivar_organizacion.sql`  
**Negocio:** Soft-delete de org desde el panel (`sgtd_desactivar_organizacion`). La org queda con `activa = false, desactivada_en = now()`. El dueño puede reactivarla en hasta 3 meses; si no, `sgtd_purgar_organizaciones_inactivas` la elimina permanentemente junto con sus datos. El panel muestra la sección "Papelera" con cuenta regresiva.

**Prerrequisito:** 043–053 aplicadas. pg_cron habilitado (si existe → cron.job se registra; si no → solo NOTICE).

### Pre-apply (obligatorio antes de prod)

```sql
-- Verificar que no hay orgs con activa=false y desactivada_en IS NOT NULL (pre-054 no deberían)
SELECT COUNT(*) AS orgs_soft_deleted_pre054
FROM public.organizacion
WHERE activa = false AND desactivada_en IS NOT NULL;
-- Esperado: 0 (si hay, investigar antes de aplicar)
```

### Comprobaciones SQL post-apply

```bash
# Columna existe
npx @insforge/cli db query "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='organizacion' AND column_name='desactivada_en'"

# Las 4 RPCs existen
npx @insforge/cli db query "SELECT proname FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='public' AND proname IN ('sgtd_desactivar_organizacion','sgtd_reactivar_organizacion','sgtd_listar_orgs_desactivadas','sgtd_purgar_organizaciones_inactivas') ORDER BY proname"
# Esperado: 4 filas

# Cron registrado (solo si pg_cron está disponible)
npx @insforge/cli db query "SELECT jobname, schedule FROM cron.job WHERE jobname = 'sgtd-purgar-orgs-inactivas'"
# Esperado: 1 fila con schedule = '0 3 * * *'

# purga no tiene GRANT a authenticated
npx @insforge/cli db query "SELECT has_function_privilege('authenticated', 'public.sgtd_purgar_organizaciones_inactivas()', 'EXECUTE') AS no_debe_ser_true"
# Esperado: false (o error "no existe el privilegio" — ambos correctos)
```

### QA manual (app)

- Dueño entra a `/panel` → cada org activa tiene botón basura.
- Clic basura → modal de confirmación muestra nombre, fecha de purga (~3 meses) y advertencia.
- Confirmar → org desaparece de la lista de activas y aparece en sección "Papelera" con días restantes.
- Clic "Reactivar" en papelera → org vuelve a la lista de activas.
- Org desactivada: miembro intenta acceder → workspace no disponible (consultas de dominio fallan).
- No-dueño: llamar `sgtd_desactivar_organizacion` → P0007.

### Alcance y límites

- **Orgs legacy `activa = false` sin `desactivada_en`:** no aparecen en papelera ni se purgan. El `COMMENT ON COLUMN` documenta esto. Backfill manual opcional si se necesita gestionar esas orgs.
- **Purga silenciosa:** si una FK inesperada bloquea el DELETE de dominio, la org queda en papelera indefinidamente y se emite `RAISE WARNING` en los logs del cron. Verificar logs de pg_cron en staging tras T7.
- **"3 meses"** = `interval '3 months'` (~89–92 días según el mes). Ver comentario en migración si el negocio requiere exactamente 90 días.

---

## Referencias

- **Modelo tarea v1.1:** `web/CONTEXT/TAREA-MODEL.md`
- **Módulo OT (reglas):** `.cursor/rules/sgtd-ot.mdc`
- Reglas de negocio generales: `.cursor/rules/sgtd-business-rules.mdc`
- Auditoría deploy: `web/auditorias/auditoria_16052026_final.md`
- CLI InsForge: `npx @insforge/cli db query --help` · skill `.claude/skills/insforge-cli`
