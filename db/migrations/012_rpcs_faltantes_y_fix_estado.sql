-- =============================================================================
-- SGTD — Migración 012
-- Archivo: 012_rpcs_faltantes_y_fix_estado.sql
--
-- Problema:
--   El frontend llama a tres RPCs que no existen en BD:
--     1. sgtd_mover_tarea_columna   → usada por iniciar, bloquear, desbloquear
--     2. sgtd_reprogramar_tarea_con_log → usada por reprogramar tarea
--
--   Además, sgtd_cambiar_estado_tarea falla con error 42804 porque la
--   columna estado puede ser tipo ENUM (estado_tarea) en producción,
--   y el UPDATE asigna un TEXT sin cast explícito.
--
-- Solución:
--   1. Recrear sgtd_cambiar_estado_tarea con cast explícito en el UPDATE.
--   2. Crear sgtd_mover_tarea_columna como alias con la misma lógica.
--   3. Crear sgtd_reprogramar_tarea_con_log con lógica completa.
--
-- Prerrequisitos: migraciones 001–011 aplicadas.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Fix sgtd_cambiar_estado_tarea
--    Problema: UPDATE estado = p_nuevo_estado (TEXT) falla si la columna
--    es de tipo ENUM. Se agrega cast explícito.
--    Lógica de transiciones sin cambios.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sgtd_cambiar_estado_tarea(
  p_tarea_id      UUID,
  p_nuevo_estado  TEXT,
  p_justificacion TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_estado_actual TEXT;
  v_asignado_a    UUID;
  v_tipo_log      TEXT;
BEGIN
  SELECT estado::TEXT, asignado_a
    INTO v_estado_actual, v_asignado_a
  FROM public.tarea
  WHERE id = p_tarea_id
    AND (asignado_a = auth.uid() OR public.sgtd_es_jefe());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarea no encontrada o sin permisos (id: %)', p_tarea_id
      USING ERRCODE = 'P0001';
  END IF;

  -- Validar transición permitida
  IF NOT (
    (v_estado_actual = 'pendiente'    AND p_nuevo_estado IN ('en_progreso','bloqueada','cancelada'))
    OR (v_estado_actual = 'atrasada'  AND p_nuevo_estado IN ('en_progreso','bloqueada','cancelada','reprogramada'))
    OR (v_estado_actual = 'en_progreso' AND p_nuevo_estado IN ('completada','bloqueada','cancelada'))
    OR (v_estado_actual = 'bloqueada' AND p_nuevo_estado IN ('pendiente','cancelada'))
    OR (v_estado_actual = 'reprogramada' AND p_nuevo_estado IN ('en_progreso','pendiente','cancelada'))
  ) THEN
    RAISE EXCEPTION 'Transición inválida: % → %', v_estado_actual, p_nuevo_estado
      USING ERRCODE = 'P0002';
  END IF;

  -- Justificación obligatoria para bloquear y cancelar
  IF p_nuevo_estado IN ('bloqueada', 'cancelada') THEN
    IF p_justificacion IS NULL OR length(trim(p_justificacion)) < 10 THEN
      RAISE EXCEPTION 'Se requiere justificación de al menos 10 caracteres para "%"', p_nuevo_estado
        USING ERRCODE = 'P0003';
    END IF;
  END IF;

  v_tipo_log := CASE p_nuevo_estado
    WHEN 'en_progreso' THEN 'iniciada'
    WHEN 'completada'  THEN 'completada'
    WHEN 'bloqueada'   THEN 'bloqueada'
    WHEN 'pendiente'   THEN 'desbloqueada'
    WHEN 'cancelada'   THEN 'cancelada'
    ELSE 'estado_cambiado'
  END;

  -- UPDATE con cast explícito para compatibilidad TEXT y ENUM
  UPDATE public.tarea
  SET
    estado           = p_nuevo_estado::TEXT,
    fecha_completada = CASE WHEN p_nuevo_estado = 'completada' THEN now() ELSE fecha_completada END,
    updated_at       = now()
  WHERE id = p_tarea_id;

  INSERT INTO public.log_accion (
    tarea_id, usuario_id, tipo_accion,
    valor_anterior, valor_nuevo,
    justificacion, leido_por_jefe
  ) VALUES (
    p_tarea_id,
    auth.uid(),
    v_tipo_log,
    jsonb_build_object('estado', v_estado_actual),
    jsonb_build_object('estado', p_nuevo_estado),
    nullif(trim(coalesce(p_justificacion, '')), ''),
    false
  );
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_cambiar_estado_tarea(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_cambiar_estado_tarea(UUID, TEXT, TEXT) TO authenticated;

-- =============================================================================
-- 2. sgtd_mover_tarea_columna
--    El frontend (Tablero + useMiSemana) llama a esta función para iniciar,
--    bloquear y cambiar estado arrastrando entre columnas.
--    Es un alias de sgtd_cambiar_estado_tarea con parámetro p_usuario_id
--    para compatibilidad con la firma que usa el frontend.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sgtd_mover_tarea_columna(
  p_tarea_id      UUID,
  p_nuevo_estado  TEXT,
  p_usuario_id    UUID,
  p_justificacion TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Delega en sgtd_cambiar_estado_tarea (tiene toda la lógica y validaciones)
  PERFORM public.sgtd_cambiar_estado_tarea(
    p_tarea_id,
    p_nuevo_estado,
    p_justificacion
  );
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_mover_tarea_columna(UUID, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_mover_tarea_columna(UUID, TEXT, UUID, TEXT) TO authenticated;

-- =============================================================================
-- 3. sgtd_reprogramar_tarea_con_log
--    Cambia la fecha planificada de una tarea, actualiza semana_planificada,
--    aplica el estado correcto (reprogramada o pendiente) y registra el log.
--
--    Parámetros:
--      p_tarea_id      UUID de la tarea
--      p_usuario_id    UUID del usuario que reprograma
--      p_nueva_fecha   Nueva fecha en formato YYYY-MM-DD
--      p_justificacion Texto obligatorio (mínimo 10 chars)
--      p_nuevo_estado  Estado resultante: 'reprogramada' | 'pendiente' | NULL
--                      Si NULL, se calcula automáticamente:
--                        - atrasada o planificada para hoy → 'reprogramada'
--                        - cualquier otro caso → 'pendiente'
--
--    Retorna: void
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sgtd_reprogramar_tarea_con_log(
  p_tarea_id      UUID,
  p_usuario_id    UUID,
  p_nueva_fecha   TEXT,
  p_justificacion TEXT,
  p_nuevo_estado  TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_estado_actual     TEXT;
  v_fecha_anterior    DATE;
  v_semana_anterior   TEXT;
  v_estado_resultante TEXT;
  v_nueva_semana      TEXT;
BEGIN
  -- Validar justificación
  IF p_justificacion IS NULL OR length(trim(p_justificacion)) < 10 THEN
    RAISE EXCEPTION 'Se requiere justificación de al menos 10 caracteres'
      USING ERRCODE = 'P0001';
  END IF;

  -- Leer estado y fecha actual
  SELECT estado::TEXT, fecha_planificada, semana_planificada
    INTO v_estado_actual, v_fecha_anterior, v_semana_anterior
  FROM public.tarea
  WHERE id = p_tarea_id
    AND (asignado_a = auth.uid() OR public.sgtd_es_jefe());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarea no encontrada o sin permisos (id: %)', p_tarea_id
      USING ERRCODE = 'P0001';
  END IF;

  -- Solo se pueden reprogramar tareas en estados activos
  IF v_estado_actual NOT IN ('pendiente', 'atrasada', 'reprogramada', 'en_progreso') THEN
    RAISE EXCEPTION 'No se puede reprogramar una tarea en estado "%"', v_estado_actual
      USING ERRCODE = 'P0002';
  END IF;

  -- Calcular semana ISO (YYYYWW) a partir de la nueva fecha
  SELECT to_char(
    date_trunc('week', p_nueva_fecha::DATE),
    'IYYYIW'
  )::TEXT INTO v_nueva_semana;

  -- Determinar el estado resultante
  IF p_nuevo_estado IS NOT NULL AND p_nuevo_estado IN ('reprogramada', 'pendiente') THEN
    v_estado_resultante := p_nuevo_estado;
  ELSIF v_estado_actual = 'atrasada' THEN
    v_estado_resultante := 'reprogramada';
  ELSIF v_estado_actual = 'pendiente' AND v_fecha_anterior = CURRENT_DATE THEN
    v_estado_resultante := 'reprogramada';
  ELSE
    v_estado_resultante := 'pendiente';
  END IF;

  -- Actualizar tarea
  UPDATE public.tarea
  SET
    fecha_planificada  = p_nueva_fecha::DATE,
    semana_planificada = v_nueva_semana,
    estado             = v_estado_resultante::TEXT,
    updated_at         = now()
  WHERE id = p_tarea_id;

  -- Registrar en log_accion
  INSERT INTO public.log_accion (
    tarea_id, usuario_id, tipo_accion,
    valor_anterior, valor_nuevo,
    justificacion, leido_por_jefe
  ) VALUES (
    p_tarea_id,
    auth.uid(),
    'reprogramada',
    jsonb_build_object(
      'estado', v_estado_actual,
      'fecha_planificada', v_fecha_anterior::TEXT,
      'semana_planificada', v_semana_anterior
    ),
    jsonb_build_object(
      'estado', v_estado_resultante,
      'fecha_planificada', p_nueva_fecha,
      'semana_planificada', v_nueva_semana
    ),
    trim(p_justificacion),
    false
  );
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_reprogramar_tarea_con_log(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_reprogramar_tarea_con_log(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;

-- =============================================================================
-- VERIFICACIÓN
--
-- Confirmar que las tres funciones existen:
-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name IN (
--     'sgtd_cambiar_estado_tarea',
--     'sgtd_mover_tarea_columna',
--     'sgtd_reprogramar_tarea_con_log'
--   );
-- → 3 filas
--
-- Test rápido de reprogramar (ajustar IDs reales):
-- SELECT sgtd_reprogramar_tarea_con_log(
--   '<uuid-tarea>',
--   '<uuid-usuario>',
--   '2026-05-10',
--   'Reprogramado por prueba de migración',
--   NULL
-- );
-- =============================================================================

COMMIT;