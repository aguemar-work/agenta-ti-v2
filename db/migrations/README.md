# Migraciones SGTD — `db/migrations/`

Scripts SQL numerados (`002` … `034`) aplicados **manualmente** en InsForge (SQL Editor o CLI). El schema canónico consolidado está en `../schema.sql`.

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

## Referencias

- **Módulo OT (reglas):** `.cursor/rules/sgtd-ot.mdc`
- Reglas de negocio generales: `.cursor/rules/sgtd-business-rules.mdc`
- Auditoría deploy: `web/auditorias/auditoria_16052026_final.md`
- CLI InsForge: `npx @insforge/cli db query --help` · skill `.claude/skills/insforge-cli`
