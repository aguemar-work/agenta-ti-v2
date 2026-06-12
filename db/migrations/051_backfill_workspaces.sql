-- =============================================================================
-- Migración 051 — Backfill workspaces para orgs pre-V5
-- =============================================================================
-- Problema : Organizaciones insertadas directamente en public.organizacion sin
--             pasar por sgtd_crear_organizacion (047) no tienen fila en
--             public.workspace. sgtd_listar_modulos_organizacion (050, línea 81)
--             lanza P0002 → HTTP 400 al abrir "Gestionar módulos" en el panel.
--
-- Alcance   : Esta migración desbloquea sgtd_listar_modulos_organizacion y
--             sgtd_set_modulo_organizacion para esas orgs.
--             NO crea workspace_member ni organizacion_member: los usuarios
--             normales de la org siguen sin acceso operativo hasta que se
--             les asigne explícitamente. El dueño puede operar la org porque
--             048 le da bypass en helpers RLS.
--
-- Fuera de alcance:
--   - Workspaces con activo = false (escenario distinto; tratar por separado).
--   - Datos legados (tareas, OT) siguen ligados al workspace de 043 si existe.
--     Si la org tiene datos en otro workspace, el backfill solo habilita el
--     panel de módulos; los datos no se reasignan.
--
-- Prerequisito : Migraciones 043–050 aplicadas.
-- Idempotente  : Sí. WHERE NOT EXISTS garantiza que orgs ya con workspace
--                no se duplican.
-- Reversible   : Ver ROLLBACK al final (staging únicamente).
--
-- PRE-APPLY (ejecutar antes de aplicar):
-- Identificar exactamente qué orgs quedan afectadas y si son filas fantasma
-- o la org operativa real. Ajustar expectativas antes de aplicar en prod.
--
--   SELECT o.id, o.nombre, o.slug, o.activa,
--          (SELECT COUNT(*) FROM workspace w WHERE w.organizacion_id = o.id) AS n_workspaces
--   FROM organizacion o
--   WHERE o.activa = true
--     AND NOT EXISTS (SELECT 1 FROM workspace w WHERE w.organizacion_id = o.id);
--
-- Identificador de validación post-apply:
--   SELECT COUNT(*) FROM organizacion o
--   WHERE o.activa = true
--     AND NOT EXISTS (SELECT 1 FROM workspace w WHERE w.organizacion_id = o.id);
--   esperado: 0
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_count integer;
BEGIN
  -- Paso 1: workspace 'Principal' para cada org activa sin workspace
  -- Paso 2: módulo 'bitacora' (obligatorio) para cada workspace nuevo
  -- La CTE garantiza atomicidad: solo los workspaces creados ahora reciben bitacora.
  WITH nuevos_ws AS (
    INSERT INTO public.workspace (organizacion_id, nombre, tipo, activo)
    SELECT
      o.id,
      'Principal',
      'interno',
      true
    FROM public.organizacion o
    WHERE o.activa = true
      AND NOT EXISTS (
        SELECT 1 FROM public.workspace w
        WHERE w.organizacion_id = o.id
      )
    RETURNING id
  ),
  bitacora_insert AS (
    INSERT INTO public.workspace_modulo (workspace_id, modulo, activo)
    SELECT id, 'bitacora', true
    FROM nuevos_ws
    RETURNING workspace_id
  )
  SELECT COUNT(*) INTO v_count FROM bitacora_insert;

  RAISE NOTICE '051_backfill_workspaces: % workspace(s) creado(s) para orgs sin workspace activo.', v_count;
END;
$$;

COMMIT;


-- =============================================================================
-- SMOKE TESTS — ejecutar tras apply
-- =============================================================================

-- T1: ninguna org activa debe quedar sin workspace (esperado: 0 filas)
--   SELECT o.id, o.nombre
--   FROM public.organizacion o
--   WHERE o.activa = true
--     AND NOT EXISTS (SELECT 1 FROM public.workspace w WHERE w.organizacion_id = o.id);

-- T2: sin duplicados accidentales (esperado: 0 filas)
--   SELECT organizacion_id, COUNT(*) AS n
--   FROM public.workspace
--   GROUP BY organizacion_id HAVING COUNT(*) > 1;

-- T3: sgtd_listar_modulos_organizacion ya no lanza 400 para la org afectada
--   SELECT * FROM sgtd_listar_modulos_organizacion('<org-id-afectada>');
--   esperado: 6 filas; bitacora activo = true, el resto false

-- T4: sgtd_set_modulo_organizacion funciona en la org backfilleada
--   SELECT sgtd_set_modulo_organizacion('<org-id-afectada>', 'areas', true);
--   esperado: {organizacion_id, workspace_id, modulo:'areas', activo:true}

-- T5: regresión — orgs V5 (con workspace existente) no se duplican (T2 cubre esto)


-- =============================================================================
-- ROLLBACK — solo staging
-- =============================================================================
-- Los workspaces creados por esta migración tienen:
--   nombre = 'Principal' AND no tienen workspace_member (nunca se asignaron usuarios)
-- Si ya se asignaron usuarios al workspace backfilleado, el rollback NO lo borrará
-- (comportamiento deseable: no se pierden membresías creadas intencionalmente).
--
-- BEGIN;
-- DELETE FROM public.workspace_modulo
-- WHERE workspace_id IN (
--   SELECT w.id FROM public.workspace w
--   WHERE w.nombre = 'Principal'
--     AND NOT EXISTS (
--       SELECT 1 FROM public.workspace_member wm WHERE wm.workspace_id = w.id
--     )
-- );
-- DELETE FROM public.workspace
-- WHERE nombre = 'Principal'
--   AND NOT EXISTS (
--     SELECT 1 FROM public.workspace_member wm WHERE wm.workspace_id = workspace.id
--   );
-- COMMIT;
