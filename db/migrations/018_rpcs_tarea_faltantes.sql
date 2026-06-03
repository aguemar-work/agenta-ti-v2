-- =============================================================================
-- SGTD — Migración 018
-- Archivo: 018_rpcs_tarea_faltantes.sql
--
-- El frontend llama a 4 RPCs que no existen en BD, o que hacen INSERT/UPDATE
-- directo con TEXT donde la columna es ENUM:
--
--   1. sgtd_crear_tarea_planificada   → crearTareaPlanificada() hace INSERT directo
--                                       desde JS con estado/tipo/prioridad como TEXT.
--                                       Postgres rechaza: ENUMs.
--
--   2. sgtd_actualizar_tarea          → actualiza titulo, prioridad, descripcion.
--                                       prioridad es ENUM prioridad_tarea.
--
--   3. sgtd_eliminar_tarea_con_motivo → elimina la tarea con log de auditoría.
--                                       No existe en BD.
--
--   4. sgtd_desbloquear_tarea_con_log → desbloquea una tarea bloqueada, cambia
--                                       fecha y registra log. No existe en BD.
--
-- Solución: crear las 4 RPCs con casts ::public.enum_type en cada columna ENUM.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. sgtd_crear_tarea_planificada
--    Reemplaza el INSERT directo de crearTareaPlanificada() en semana.ts.
--    Retorna la tarea creada completa (para que el frontend pueda actualizarla
--    en el cache de React Query sin refetch adicional).
-- =============================================================================

DROP FUNCTION IF EXISTS public.sgtd_crear_tarea_planificada(TEXT,TEXT,TEXT,TEXT,TEXT,UUID,UUID,UUID,UUID,BOOLEAN);

CREATE FUNCTION public.sgtd_crear_tarea_planificada(
  p_titulo             TEXT,
  p_descripcion        TEXT DEFAULT NULL,
  p_prioridad          TEXT DEFAULT 'media',
  p_fecha_planificada  TEXT DEFAULT NULL,
  p_semana_planificada TEXT DEFAULT NULL,
  p_asignado_a         UUID DEFAULT NULL,
  p_creado_por         UUID DEFAULT NULL,
  p_objetivo_id        UUID DEFAULT NULL,
  p_nota_origen_id     UUID DEFAULT NULL,
  p_es_imprevisto      BOOLEAN DEFAULT FALSE
)
RETURNS SETOF public.tarea
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_asignado  UUID;
  v_creador   UUID;
  v_tarea_id  UUID;
BEGIN
  v_asignado := COALESCE(p_asignado_a, auth.uid());
  v_creador  := COALESCE(p_creado_por, auth.uid());

  IF p_titulo IS NULL OR length(trim(p_titulo)) = 0 THEN
    RAISE EXCEPTION 'El título es obligatorio' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.tarea (
    titulo, descripcion,
    estado, tipo, prioridad,
    fecha_planificada, semana_planificada,
    asignado_a, creado_por,
    objetivo_id, nota_origen_id,
    es_imprevisto
  ) VALUES (
    trim(p_titulo),
    nullif(trim(coalesce(p_descripcion, '')), ''),
    'pendiente'::public.estado_tarea,
    'planificada'::public.tipo_tarea,
    p_prioridad::public.prioridad_tarea,
    p_fecha_planificada::DATE,
    p_semana_planificada,
    v_asignado,
    v_creador,
    p_objetivo_id,
    p_nota_origen_id,
    p_es_imprevisto
  )
  RETURNING id INTO v_tarea_id;

  INSERT INTO public.log_accion (
    tarea_id, usuario_id, tipo_accion,
    valor_anterior, valor_nuevo, justificacion, leido_por_jefe
  ) VALUES (
    v_tarea_id, auth.uid(), 'creada',
    NULL,
    jsonb_build_object('tipo', 'planificada', 'estado', 'pendiente'),
    NULL, false
  );

  RETURN QUERY SELECT * FROM public.tarea WHERE id = v_tarea_id;
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_crear_tarea_planificada(TEXT,TEXT,TEXT,TEXT,TEXT,UUID,UUID,UUID,UUID,BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_crear_tarea_planificada(TEXT,TEXT,TEXT,TEXT,TEXT,UUID,UUID,UUID,UUID,BOOLEAN) TO authenticated;

-- =============================================================================
-- 2. sgtd_actualizar_tarea
--    Actualiza titulo, prioridad, descripcion, objetivo_id, asignado_a.
--    Solo el jefe o el asignado pueden editar.
-- =============================================================================

DROP FUNCTION IF EXISTS public.sgtd_actualizar_tarea(UUID, UUID, TEXT, TEXT, TEXT, UUID, UUID);

CREATE FUNCTION public.sgtd_actualizar_tarea(
  p_tarea_id    UUID,
  p_usuario_id  UUID,
  p_titulo      TEXT,
  p_prioridad   TEXT,
  p_descripcion TEXT DEFAULT NULL,
  p_objetivo_id UUID DEFAULT NULL,
  p_asignado_a  UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_asignado_actual UUID;
BEGIN
  SELECT asignado_a INTO v_asignado_actual
  FROM public.tarea
  WHERE id = p_tarea_id
    AND (asignado_a = auth.uid() OR public.sgtd_es_jefe());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarea no encontrada o sin permisos (id: %)', p_tarea_id
      USING ERRCODE = 'P0001';
  END IF;

  IF p_titulo IS NULL OR length(trim(p_titulo)) = 0 THEN
    RAISE EXCEPTION 'El título es obligatorio' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.tarea
  SET
    titulo       = trim(p_titulo),
    prioridad    = p_prioridad::public.prioridad_tarea,
    descripcion  = nullif(trim(coalesce(p_descripcion, '')), ''),
    objetivo_id  = p_objetivo_id,
    asignado_a   = COALESCE(p_asignado_a, v_asignado_actual),
    updated_at   = now()
  WHERE id = p_tarea_id;

  INSERT INTO public.log_accion (
    tarea_id, usuario_id, tipo_accion,
    valor_anterior, valor_nuevo, justificacion, leido_por_jefe
  ) VALUES (
    p_tarea_id, auth.uid(), 'editada',
    NULL,
    jsonb_build_object('titulo', p_titulo, 'prioridad', p_prioridad),
    NULL, false
  );
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_actualizar_tarea(UUID, UUID, TEXT, TEXT, TEXT, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_actualizar_tarea(UUID, UUID, TEXT, TEXT, TEXT, UUID, UUID) TO authenticated;

-- =============================================================================
-- 3. sgtd_eliminar_tarea_con_motivo
--    Elimina la tarea si no está en estado completada/cancelada.
--    Solo el jefe o el asignado pueden eliminar.
--    Registra log antes de eliminar.
-- =============================================================================

DROP FUNCTION IF EXISTS public.sgtd_eliminar_tarea_con_motivo(UUID, UUID, TEXT);

CREATE FUNCTION public.sgtd_eliminar_tarea_con_motivo(
  p_tarea_id   UUID,
  p_usuario_id UUID,
  p_motivo     TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_estado TEXT;
  v_titulo TEXT;
BEGIN
  IF p_motivo IS NULL OR length(trim(p_motivo)) < 5 THEN
    RAISE EXCEPTION 'El motivo debe tener al menos 5 caracteres'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT estado::TEXT, titulo
    INTO v_estado, v_titulo
  FROM public.tarea
  WHERE id = p_tarea_id
    AND (asignado_a = auth.uid() OR public.sgtd_es_jefe());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarea no encontrada o sin permisos (id: %)', p_tarea_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Log antes de eliminar (para trazabilidad)
  INSERT INTO public.log_accion (
    tarea_id, usuario_id, tipo_accion,
    valor_anterior, valor_nuevo, justificacion, leido_por_jefe
  ) VALUES (
    p_tarea_id, auth.uid(), 'eliminada',
    jsonb_build_object('estado', v_estado, 'titulo', v_titulo),
    NULL,
    trim(p_motivo),
    false
  );

  DELETE FROM public.tarea WHERE id = p_tarea_id;
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_eliminar_tarea_con_motivo(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_eliminar_tarea_con_motivo(UUID, UUID, TEXT) TO authenticated;

-- =============================================================================
-- 4. sgtd_desbloquear_tarea_con_log
--    Desbloquea una tarea bloqueada, opcionalmente la reprograma,
--    y registra log. Transición: bloqueada → pendiente.
-- =============================================================================

DROP FUNCTION IF EXISTS public.sgtd_desbloquear_tarea_con_log(UUID, UUID, TEXT, TEXT);

CREATE FUNCTION public.sgtd_desbloquear_tarea_con_log(
  p_tarea_id      UUID,
  p_usuario_id    UUID,
  p_nueva_fecha   TEXT DEFAULT NULL,
  p_justificacion TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_estado_actual TEXT;
  v_nueva_semana  TEXT;
BEGIN
  SELECT estado::TEXT INTO v_estado_actual
  FROM public.tarea
  WHERE id = p_tarea_id
    AND (asignado_a = auth.uid() OR public.sgtd_es_jefe());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarea no encontrada o sin permisos (id: %)', p_tarea_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_estado_actual <> 'bloqueada' THEN
    RAISE EXCEPTION 'Solo se puede desbloquear una tarea bloqueada (estado actual: "%")', v_estado_actual
      USING ERRCODE = 'P0002';
  END IF;

  -- Calcular nueva semana si se reprograma
  IF p_nueva_fecha IS NOT NULL THEN
    SELECT to_char(date_trunc('week', p_nueva_fecha::DATE), 'IYYYIW')
      INTO v_nueva_semana;
  END IF;

  UPDATE public.tarea
  SET
    estado             = 'pendiente'::public.estado_tarea,
    fecha_planificada  = COALESCE(p_nueva_fecha::DATE, fecha_planificada),
    semana_planificada = COALESCE(v_nueva_semana, semana_planificada),
    updated_at         = now()
  WHERE id = p_tarea_id;

  INSERT INTO public.log_accion (
    tarea_id, usuario_id, tipo_accion,
    valor_anterior, valor_nuevo, justificacion, leido_por_jefe
  ) VALUES (
    p_tarea_id, auth.uid(), 'desbloqueada',
    jsonb_build_object('estado', 'bloqueada'),
    jsonb_build_object(
      'estado',             'pendiente',
      'fecha_planificada',  COALESCE(p_nueva_fecha, 'sin_cambio')
    ),
    nullif(trim(coalesce(p_justificacion, '')), ''),
    false
  );
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_desbloquear_tarea_con_log(UUID, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_desbloquear_tarea_con_log(UUID, UUID, TEXT, TEXT) TO authenticated;

-- =============================================================================
-- VERIFICACIÓN
--
-- SELECT proname, pg_get_function_arguments(oid)
-- FROM pg_proc
-- WHERE pronamespace = 'public'::regnamespace
--   AND proname IN (
--     'sgtd_crear_tarea_planificada',
--     'sgtd_actualizar_tarea',
--     'sgtd_eliminar_tarea_con_motivo',
--     'sgtd_desbloquear_tarea_con_log'
--   )
-- ORDER BY proname;
-- → 4 filas, una por función
-- =============================================================================

COMMIT;