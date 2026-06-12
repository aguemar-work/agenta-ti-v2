-- =============================================================================
-- Migración 053 — Fix ERRCODE 42702 en sgtd_listar_modulos_organizacion
-- =============================================================================
-- Problema : sgtd_listar_modulos_organizacion (050) declara
--             RETURNS TABLE (modulo text, activo boolean).
--             Esto crea una variable PL/pgSQL implícita llamada "activo".
--             En el cuerpo, la query de resolución de workspace usa:
--
--               WHERE organizacion_id = p_organizacion_id AND activo = true
--
--             sin calificar la columna. PostgreSQL no puede distinguir entre
--             workspace.activo (columna de tabla) y la variable de output "activo"
--             → ERRCODE 42702 "column reference activo is ambiguous" → HTTP 400.
--
--             La función compiló correctamente en 050 (CREATE OR REPLACE no
--             ejecuta el cuerpo), pero falla en cada llamada desde el cliente.
--             sgtd_set_modulo_organizacion (050) no tiene el problema porque
--             su return type es jsonb, sin variable de output llamada "activo".
--
-- Fix      : Recrear sgtd_listar_modulos_organizacion con tabla alias "w" en
--             la query de workspace → w.activo es inequívoco.
--             También se remueve el alias "AS activo" en RETURN QUERY para
--             eliminar cualquier referencia al nombre del output variable
--             (RETURN QUERY mapea columnas por posición, no por nombre).
--
-- Prerequisito : 043–051 aplicadas (o al menos 050). 052 es no-op opcional.
-- Idempotente  : Sí (CREATE OR REPLACE).
-- Reversible   : Restaurar con 050_modulos_organizacion.sql (solo staging).
--
-- Identificador de validación:
--   SELECT sgtd_listar_modulos_organizacion('<org-id>');
--   esperado: 6 filas (areas, proyectos, clientes, ordenes_trabajo, objetivos, bitacora)
--   sin ERRCODE 42702.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.sgtd_listar_modulos_organizacion(
  p_organizacion_id uuid
)
RETURNS TABLE (
  modulo  text,
  activo  boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ws_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.sgtd_es_plataforma_owner() THEN
    RAISE EXCEPTION 'No tienes permiso para ver los módulos.' USING ERRCODE = 'P0007';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organizacion WHERE id = p_organizacion_id AND activa = true
  ) THEN
    RAISE EXCEPTION 'La organización no existe o está inactiva.' USING ERRCODE = 'P0002';
  END IF;

  -- FIX 053: alias "w" en la query de workspace para que w.activo sea
  -- inequívoco respecto a la variable de output "activo" de RETURNS TABLE.
  SELECT w.id INTO v_ws_id
  FROM public.workspace w
  WHERE w.organizacion_id = p_organizacion_id AND w.activo = true
  ORDER BY w.created_at ASC
  LIMIT 1;

  IF v_ws_id IS NULL THEN
    RAISE EXCEPTION 'La organización no tiene un espacio de trabajo activo.' USING ERRCODE = 'P0002';
  END IF;

  -- FIX 053: sin alias "AS activo" en RETURN QUERY — RETURN QUERY mapea por
  -- posición (no por nombre), eliminando la referencia al nombre del output var.
  RETURN QUERY
  SELECT
    cat.modulo,
    COALESCE(wm.activo, false)
  FROM (
    VALUES ('areas'), ('proyectos'), ('clientes'),
           ('ordenes_trabajo'), ('objetivos'), ('bitacora')
  ) AS cat(modulo)
  LEFT JOIN public.workspace_modulo wm
    ON wm.workspace_id = v_ws_id AND wm.modulo = cat.modulo
  ORDER BY cat.modulo;
END;
$$;

REVOKE ALL ON FUNCTION public.sgtd_listar_modulos_organizacion(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_listar_modulos_organizacion(uuid) TO authenticated;

COMMENT ON FUNCTION public.sgtd_listar_modulos_organizacion IS
  'V5 053: fix 42702 — alias w en workspace query; sin alias AS activo en RETURN QUERY.';

COMMIT;


-- =============================================================================
-- SMOKE TESTS — ejecutar tras apply
-- =============================================================================

-- T1 (dueño): listar módulos — ya no debe lanzar 42702
--   SELECT * FROM sgtd_listar_modulos_organizacion('<org-id>');
--   esperado: 6 filas, sin error

-- T2 (dueño): activar un módulo sigue funcionando (no tocamos sgtd_set_modulo_organizacion)
--   SELECT sgtd_set_modulo_organizacion('<org-id>', 'areas', true);
--   esperado: {organizacion_id, workspace_id, modulo:'areas', activo:true}

-- T3 (no-dueño): debe rechazarse con P0007
--   esperado: EXCEPTION 'No tienes permiso para ver los módulos.'

-- T4 (regresión): sgtd_set_modulo_organizacion sigue sin cambios ni errores
--   SELECT sgtd_set_modulo_organizacion('<org-id>', 'areas', false);
--   esperado: {activo:false}


-- =============================================================================
-- ROLLBACK — solo staging
-- =============================================================================
-- Reaplicar la función original de 050_modulos_organizacion.sql.
