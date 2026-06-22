-- =============================================================================
-- Migración 059 — Permitir al jefe gestionar módulos de su empresa
-- =============================================================================
-- Objetivo:
--   Extender RPCs 050 para que, además del plataforma_owner, también pueda
--   ejecutar el jefe del workspace activo, pero SOLO sobre el mismo workspace
--   que la RPC va a modificar/listar.
--
-- Seguridad (tightening):
--   La 050 resuelve internamente v_ws_id (workspace más antiguo de la org).
--   Para evitar desalineación futura en escenarios multi-workspace, el gate
--   del jefe exige:
--     sgtd_es_jefe() AND sgtd_workspace_id() = v_ws_id
--
-- Nota:
--   Hoy el modelo operativo asume 1 workspace activo por organización. Si en
--   futuro se soporta multi-workspace por org, este punto debe revisarse.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- RPC 1 — Listar estado de módulos (owner OR jefe del mismo workspace)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_listar_modulos_organizacion(
  p_organizacion_id uuid
)
RETURNS TABLE (
  modulo text,
  activo boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ws_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organizacion o
    WHERE o.id = p_organizacion_id
      AND o.activa = true
  ) THEN
    RAISE EXCEPTION 'La organización no existe o está inactiva.' USING ERRCODE = 'P0002';
  END IF;

  SELECT w.id INTO v_ws_id
  FROM public.workspace w
  WHERE w.organizacion_id = p_organizacion_id
    AND w.activo = true
  ORDER BY w.created_at ASC
  LIMIT 1;

  IF v_ws_id IS NULL THEN
    RAISE EXCEPTION 'La organización no tiene un espacio de trabajo activo.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    public.sgtd_es_plataforma_owner()
    OR (
      public.sgtd_es_jefe()
      AND public.sgtd_workspace_id() IS NOT NULL
      AND public.sgtd_workspace_id() = v_ws_id
    )
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para ver los módulos.' USING ERRCODE = 'P0007';
  END IF;

  RETURN QUERY
  SELECT
    cat.modulo,
    COALESCE(wm.activo, false) AS activo
  FROM (
    VALUES ('areas'), ('proyectos'), ('clientes'),
           ('ordenes_trabajo'), ('objetivos'), ('bitacora')
  ) AS cat(modulo)
  LEFT JOIN public.workspace_modulo wm
    ON wm.workspace_id = v_ws_id
   AND wm.modulo = cat.modulo
  ORDER BY cat.modulo;
END;
$$;

REVOKE ALL ON FUNCTION public.sgtd_listar_modulos_organizacion(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_listar_modulos_organizacion(uuid) TO authenticated;

COMMENT ON FUNCTION public.sgtd_listar_modulos_organizacion IS
  'V5 059: estado de módulos por organización (owner o jefe del workspace objetivo). '
  'Gate jefe exige sgtd_workspace_id() = workspace resuelto por la RPC.';

-- ---------------------------------------------------------------------------
-- RPC 2 — Activar/desactivar módulo (owner OR jefe del mismo workspace)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_set_modulo_organizacion(
  p_organizacion_id uuid,
  p_modulo          text,
  p_activo          boolean
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ws_id uuid;
  v_catalogo text[] := ARRAY['areas','proyectos','clientes','ordenes_trabajo','objetivos','bitacora'];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = 'P0001';
  END IF;

  IF NOT (p_modulo = ANY(v_catalogo)) THEN
    RAISE EXCEPTION 'Módulo "%" no válido.', p_modulo USING ERRCODE = 'P0003';
  END IF;

  IF p_activo IS NULL THEN
    RAISE EXCEPTION 'Debe indicar si el módulo se activa o desactiva.' USING ERRCODE = 'P0003';
  END IF;

  IF p_modulo = 'bitacora' AND p_activo = false THEN
    RAISE EXCEPTION 'El módulo "bitacora" es obligatorio y no se puede desactivar.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organizacion o
    WHERE o.id = p_organizacion_id
      AND o.activa = true
  ) THEN
    RAISE EXCEPTION 'La organización no existe o está inactiva.' USING ERRCODE = 'P0002';
  END IF;

  SELECT w.id INTO v_ws_id
  FROM public.workspace w
  WHERE w.organizacion_id = p_organizacion_id
    AND w.activo = true
  ORDER BY w.created_at ASC
  LIMIT 1;

  IF v_ws_id IS NULL THEN
    RAISE EXCEPTION 'La organización no tiene un espacio de trabajo activo.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    public.sgtd_es_plataforma_owner()
    OR (
      public.sgtd_es_jefe()
      AND public.sgtd_workspace_id() IS NOT NULL
      AND public.sgtd_workspace_id() = v_ws_id
    )
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para gestionar módulos.' USING ERRCODE = 'P0007';
  END IF;

  INSERT INTO public.workspace_modulo (workspace_id, modulo, activo)
  VALUES (v_ws_id, p_modulo, p_activo)
  ON CONFLICT (workspace_id, modulo) DO UPDATE
  SET activo = EXCLUDED.activo,
      updated_at = now();

  RETURN jsonb_build_object(
    'organizacion_id', p_organizacion_id,
    'workspace_id', v_ws_id,
    'modulo', p_modulo,
    'activo', p_activo
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sgtd_set_modulo_organizacion(uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_set_modulo_organizacion(uuid, text, boolean) TO authenticated;

COMMENT ON FUNCTION public.sgtd_set_modulo_organizacion IS
  'V5 059: set módulo por organización (owner o jefe del workspace objetivo). '
  'Bitacora obligatoria. Gate jefe exige sgtd_workspace_id() = workspace resuelto.';

COMMIT;

