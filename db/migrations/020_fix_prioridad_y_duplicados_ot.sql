-- =============================================================================
-- SGTD — Migración 020
-- Archivo: 020_fix_prioridad_y_duplicados_ot.sql
--
-- 1. sgtd_crear_incidencia: falta cast ::public.prioridad_tarea en el INSERT.
--    La migración 017 corrigió estado y tipo pero no prioridad.
--
-- 2. sgtd_cancelar_ot y sgtd_completar_ot tienen 2 versiones cada una.
--    Eliminar las versiones antiguas.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Fix sgtd_crear_incidencia — cast prioridad
-- =============================================================================

DROP FUNCTION IF EXISTS public.sgtd_crear_incidencia(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, UUID, UUID);

CREATE FUNCTION public.sgtd_crear_incidencia(
  p_titulo       TEXT,
  p_descripcion  TEXT,
  p_prioridad    TEXT,
  p_fecha        TEXT,
  p_semana       TEXT,
  p_ya_resuelta  BOOLEAN,
  p_asignado_a   UUID DEFAULT NULL,
  p_objetivo_id  UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_asignado UUID;
  v_estado   TEXT;
  v_tarea_id UUID;
BEGIN
  v_asignado := COALESCE(p_asignado_a, auth.uid());
  v_estado   := CASE WHEN p_ya_resuelta THEN 'completada' ELSE 'pendiente' END;

  INSERT INTO public.tarea (
    titulo, descripcion, estado, tipo, prioridad,
    fecha_planificada, semana_planificada,
    fecha_completada,
    asignado_a, creado_por,
    es_imprevisto, objetivo_id
  ) VALUES (
    trim(p_titulo),
    nullif(trim(coalesce(p_descripcion, '')), ''),
    v_estado::public.estado_tarea,
    'no_planificada'::public.tipo_tarea,
    p_prioridad::public.prioridad_tarea,
    p_fecha::DATE,
    p_semana,
    CASE WHEN p_ya_resuelta THEN now() ELSE NULL END,
    v_asignado,
    auth.uid(),
    true,
    p_objetivo_id
  )
  RETURNING id INTO v_tarea_id;

  INSERT INTO public.log_accion (
    tarea_id, usuario_id, tipo_accion,
    valor_anterior, valor_nuevo, justificacion, leido_por_jefe
  ) VALUES (
    v_tarea_id, auth.uid(), 'creada',
    NULL,
    jsonb_build_object('tipo', 'no_planificada', 'estado', v_estado, 'es_imprevisto', true),
    NULL, false
  );

  RETURN v_tarea_id;
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_crear_incidencia(TEXT,TEXT,TEXT,TEXT,TEXT,BOOLEAN,UUID,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_crear_incidencia(TEXT,TEXT,TEXT,TEXT,TEXT,BOOLEAN,UUID,UUID) TO authenticated;

-- =============================================================================
-- 2. Eliminar duplicados de OT
--    Primero ver qué firmas existen, luego el DROP exacto.
--    Como no podemos consultar pg_proc aquí, eliminamos todas las variantes
--    conocidas y dejamos solo las que tienen la firma correcta del schema.
-- =============================================================================

-- sgtd_cancelar_ot — firmas conocidas del schema original
DROP FUNCTION IF EXISTS public.sgtd_cancelar_ot(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.sgtd_cancelar_ot(UUID, UUID);
DROP FUNCTION IF EXISTS public.sgtd_cancelar_ot(UUID);

-- Recrear con la firma correcta (2 params: ot_id, usuario_id)
-- Leer la lógica original de migración 007
CREATE OR REPLACE FUNCTION public.sgtd_cancelar_ot(
  p_ot_id      UUID,
  p_usuario_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_estado    TEXT;
  v_solicitante UUID;
BEGIN
  SELECT estado, creado_por
    INTO v_estado, v_solicitante
  FROM public.orden_trabajo
  WHERE id = p_ot_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OT no encontrada (id: %)', p_ot_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_estado IN ('completada', 'cancelada') THEN
    RAISE EXCEPTION 'No se puede cancelar una OT en estado "%"', v_estado
      USING ERRCODE = 'P0002';
  END IF;

  IF v_solicitante <> p_usuario_id AND NOT public.sgtd_es_jefe() THEN
    RAISE EXCEPTION 'Sin permiso para cancelar esta OT'
      USING ERRCODE = 'P0003';
  END IF;

  UPDATE public.orden_trabajo
  SET estado = 'cancelada', updated_at = now()
  WHERE id = p_ot_id;

  INSERT INTO public.log_ot (ot_id, usuario_id, accion, estado_anterior, estado_nuevo)
  VALUES (p_ot_id, p_usuario_id, 'cancelada', v_estado, 'cancelada');
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_cancelar_ot(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_cancelar_ot(UUID, UUID) TO authenticated;

-- sgtd_completar_ot — eliminar todas las variantes y recrear
DROP FUNCTION IF EXISTS public.sgtd_completar_ot(UUID, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.sgtd_completar_ot(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.sgtd_completar_ot(UUID, UUID);

CREATE OR REPLACE FUNCTION public.sgtd_completar_ot(
  p_ot_id               UUID,
  p_usuario_id          UUID,
  p_observaciones_cierre TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_estado TEXT;
BEGIN
  SELECT estado INTO v_estado
  FROM public.orden_trabajo
  WHERE id = p_ot_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OT no encontrada (id: %)', p_ot_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_estado <> 'en_ejecucion' THEN
    RAISE EXCEPTION 'Solo se puede completar una OT en ejecución (estado actual: "%")', v_estado
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.orden_trabajo
  SET
    estado               = 'completada',
    fecha_fin_real       = now(),
    observaciones_cierre = COALESCE(p_observaciones_cierre, observaciones_cierre),
    updated_at           = now()
  WHERE id = p_ot_id;

  INSERT INTO public.log_ot (ot_id, usuario_id, accion, estado_anterior, estado_nuevo)
  VALUES (p_ot_id, p_usuario_id, 'completada', 'en_ejecucion', 'completada');
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_completar_ot(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_completar_ot(UUID, UUID, TEXT) TO authenticated;

-- =============================================================================
-- VERIFICACIÓN
--
-- SELECT proname, COUNT(*) as versiones
-- FROM pg_proc
-- WHERE pronamespace = 'public'::regnamespace
--   AND proname LIKE 'sgtd_%'
-- GROUP BY proname
-- HAVING COUNT(*) > 1;
-- → 0 filas (sin duplicados)
--
-- SELECT proname, pg_get_function_arguments(oid)
-- FROM pg_proc
-- WHERE pronamespace = 'public'::regnamespace
--   AND proname = 'sgtd_crear_incidencia';
-- → 1 fila con firma correcta
-- =============================================================================

COMMIT;