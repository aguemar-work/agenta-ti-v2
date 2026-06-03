-- =============================================================================
-- SGTD — Migración 017
-- Archivo: 017_fix_todos_enum_estado.sql
--
-- Fix definitivo: todas las RPCs que hacen INSERT o UPDATE en tarea.estado
-- con un valor TEXT literal fallan con error 42804 porque la columna es
-- tipo ENUM (estado_tarea). Este script corrige TODAS de una vez.
--
-- Funciones afectadas:
--   1. sgtd_crear_incidencia          → INSERT estado = v_estado (TEXT)
--   2. sgtd_convertir_nota_en_tarea   → INSERT estado = 'pendiente' (TEXT literal)
--   3. sgtd_snap_tarea_hoy            → UPDATE estado = 'pendiente' (TEXT literal)
--
-- Las funciones sgtd_cambiar_estado_tarea, sgtd_mover_tarea_columna y
-- sgtd_reprogramar_tarea_con_log ya fueron corregidas en migración 013.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. sgtd_crear_incidencia
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
    'no_planificada',
    p_prioridad,
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
    valor_anterior, valor_nuevo,
    justificacion, leido_por_jefe
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
-- 2. sgtd_convertir_nota_en_tarea
-- =============================================================================

DROP FUNCTION IF EXISTS public.sgtd_convertir_nota_en_tarea(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID);

CREATE FUNCTION public.sgtd_convertir_nota_en_tarea(
  p_nota_id           UUID,
  p_titulo            TEXT,
  p_descripcion       TEXT,
  p_prioridad         TEXT,
  p_fecha_planificada TEXT,
  p_semana            TEXT,
  p_asignado_a        UUID,
  p_creado_por        UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_convertida TEXT;
  v_tarea_id   UUID;
BEGIN
  SELECT convertida_en INTO v_convertida
  FROM public.nota_bitacora
  WHERE id = p_nota_id
    AND usuario_id = p_creado_por;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nota no encontrada o sin permiso (id: %)', p_nota_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_convertida IS NOT NULL THEN
    RAISE EXCEPTION 'La nota ya fue convertida en "%"', v_convertida
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.tarea (
    titulo, descripcion, estado, tipo, prioridad,
    fecha_planificada, semana_planificada,
    asignado_a, creado_por, es_imprevisto,
    nota_origen_id
  ) VALUES (
    trim(p_titulo),
    nullif(trim(p_descripcion), ''),
    'pendiente'::public.estado_tarea,
    'planificada',
    p_prioridad,
    p_fecha_planificada::DATE,
    p_semana,
    p_asignado_a,
    p_creado_por,
    false,
    p_nota_id
  )
  RETURNING id INTO v_tarea_id;

  UPDATE public.nota_bitacora
  SET convertida_en = 'tarea', updated_at = now()
  WHERE id = p_nota_id;

  RETURN v_tarea_id;
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_convertir_nota_en_tarea(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,UUID,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_convertir_nota_en_tarea(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,UUID,UUID) TO authenticated;

-- =============================================================================
-- 3. sgtd_snap_tarea_hoy
-- =============================================================================

DROP FUNCTION IF EXISTS public.sgtd_snap_tarea_hoy(UUID, TEXT, TEXT);

CREATE FUNCTION public.sgtd_snap_tarea_hoy(
  p_tarea_id UUID,
  p_hoy      TEXT,
  p_semana   TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_estado public.tarea.estado%TYPE;
BEGIN
  SELECT estado INTO v_estado
  FROM public.tarea
  WHERE id = p_tarea_id
    AND (asignado_a = auth.uid() OR public.sgtd_es_jefe());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarea no encontrada o sin permisos (id: %)', p_tarea_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_estado::TEXT NOT IN ('atrasada', 'pendiente') THEN
    RAISE EXCEPTION 'No se puede reanudar una tarea en estado "%"', v_estado
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.tarea
  SET
    fecha_planificada  = p_hoy::DATE,
    semana_planificada = p_semana,
    estado             = 'pendiente'::public.estado_tarea,
    updated_at         = now()
  WHERE id = p_tarea_id;
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_snap_tarea_hoy(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_snap_tarea_hoy(UUID, TEXT, TEXT) TO authenticated;

-- =============================================================================
-- VERIFICACIÓN
--
-- Confirmar las 3 funciones recién actualizadas:
-- SELECT proname FROM pg_proc
-- WHERE pronamespace = 'public'::regnamespace
--   AND proname IN (
--     'sgtd_crear_incidencia',
--     'sgtd_convertir_nota_en_tarea',
--     'sgtd_snap_tarea_hoy'
--   );
-- → 3 filas
-- =============================================================================

COMMIT;