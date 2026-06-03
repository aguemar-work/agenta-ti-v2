-- =============================================================================
-- SGTD — Migración 009
-- Archivo: 009_trigger_atrasada_y_rpcs_tarea.sql
--
-- Cambios:
--   1. Trigger automático que marca tareas como 'atrasada' en BD
--      (resuelve el problema central: el estado era solo visual en frontend)
--
--   2. RPC sgtd_cambiar_estado_tarea — transición de estado con log atómico
--      Reemplaza los UPDATE directos del frontend para: iniciar, completar,
--      bloquear, desbloquear. Garantiza que cada transición quede registrada.
--
--   3. RPC sgtd_crear_incidencia — crea incidencia con estado configurable
--      Reemplaza crearIncidenciaHoy que forzaba estado='completada' siempre.
--
-- Prerrequisitos: migración 008 aplicada.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. FUNCIÓN Y TRIGGER: marcar tareas atrasadas automáticamente
--
--    Regla: si fecha_planificada < hoy Y estado IN (pendiente, en_progreso)
--    → estado = 'atrasada'
--
--    NO degrada: bloqueada, reprogramada, completada, cancelada, atrasada
--    (bloqueda tiene impedimento externo, no es culpa del técnico)
--
--    El trigger se dispara en INSERT y UPDATE de fecha_planificada o estado.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sgtd_fn_marcar_atrasada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF  NEW.fecha_planificada IS NOT NULL
  AND NEW.fecha_planificada < CURRENT_DATE
  AND NEW.estado IN ('pendiente', 'en_progreso')
  AND NEW.tipo = 'planificada'
  THEN
    NEW.estado := 'atrasada';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tarea_marcar_atrasada ON public.tarea;

CREATE TRIGGER trg_tarea_marcar_atrasada
  BEFORE INSERT OR UPDATE OF fecha_planificada, estado
  ON public.tarea
  FOR EACH ROW
  EXECUTE FUNCTION public.sgtd_fn_marcar_atrasada();

-- Aplicar el trigger sobre datos existentes (pone al día la BD)
UPDATE public.tarea
SET updated_at = now()
WHERE fecha_planificada < CURRENT_DATE
  AND estado IN ('pendiente', 'en_progreso')
  AND tipo = 'planificada';

-- -----------------------------------------------------------------------------
-- 2. RPC sgtd_cambiar_estado_tarea
--    Cambia el estado de una tarea y registra el evento en log_accion.
--    Reemplaza los UPDATE directos del frontend para acciones de estado.
--
--    Parámetros:
--      p_tarea_id    UUID de la tarea
--      p_nuevo_estado Nuevo estado ('en_progreso', 'completada', 'bloqueada',
--                     'pendiente' al desbloquear, 'cancelada')
--      p_justificacion Texto obligatorio para: bloqueada, cancelada
--                      Opcional para: en_progreso, completada, pendiente
--
--    Transiciones válidas:
--      pendiente    → en_progreso, bloqueada, cancelada
--      atrasada     → en_progreso, bloqueada, cancelada, reprogramada
--      en_progreso  → completada, bloqueada, cancelada
--      bloqueada    → pendiente (desbloquear), cancelada
--      reprogramada → en_progreso, pendiente, cancelada
--
--    Retorna: void
-- -----------------------------------------------------------------------------

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
  SELECT estado, asignado_a
    INTO v_estado_actual, v_asignado_a
  FROM public.tarea
  WHERE id = p_tarea_id
    AND (asignado_a = auth.uid() OR public.sgtd_es_jefe());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarea no encontrada o sin permisos (id: %)', p_tarea_id
      USING ERRCODE = 'P0001';
  END IF;

  -- Validar que la transición sea permitida
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

  -- Determinar tipo de log según la transición
  v_tipo_log := CASE p_nuevo_estado
    WHEN 'en_progreso' THEN 'iniciada'
    WHEN 'completada'  THEN 'completada'
    WHEN 'bloqueada'   THEN 'bloqueada'
    WHEN 'pendiente'   THEN 'desbloqueada'
    WHEN 'cancelada'   THEN 'cancelada'
    ELSE 'estado_cambiado'
  END;

  -- Actualizar estado
  UPDATE public.tarea
  SET
    estado          = p_nuevo_estado,
    fecha_completada = CASE WHEN p_nuevo_estado = 'completada' THEN now() ELSE fecha_completada END,
    updated_at      = now()
  WHERE id = p_tarea_id;

  -- Registrar en log_accion
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

-- -----------------------------------------------------------------------------
-- 3. RPC sgtd_crear_incidencia
--    Crea una incidencia (tarea no_planificada + es_imprevisto=true).
--    El estado inicial lo decide el usuario: completada (ya resuelta)
--    o pendiente (a resolver después).
--
--    Parámetros:
--      p_titulo          Título de la incidencia
--      p_descripcion     Descripción opcional
--      p_prioridad       'alta' | 'media' | 'baja'
--      p_fecha           Fecha del día (YYYY-MM-DD)
--      p_semana          Semana ISO (YYYYWW)
--      p_ya_resuelta     true = completada ahora / false = pendiente
--      p_asignado_a      UUID del técnico (null = quien llama)
--      p_objetivo_id     UUID del objetivo (opcional)
--
--    Retorna: UUID de la tarea creada
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sgtd_crear_incidencia(
  p_titulo       TEXT,
  p_descripcion  TEXT,
  p_prioridad    TEXT,
  p_fecha        TEXT,
  p_semana       TEXT,
  p_ya_resuelta  BOOLEAN,
  p_asignado_a   UUID    DEFAULT NULL,
  p_objetivo_id  UUID    DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_asignado  UUID;
  v_estado    TEXT;
  v_tarea_id  UUID;
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
    v_estado,
    'no_planificada',
    p_prioridad,
    p_fecha,
    p_semana,
    CASE WHEN p_ya_resuelta THEN now() ELSE NULL END,
    v_asignado,
    auth.uid(),
    true,
    p_objetivo_id
  )
  RETURNING id INTO v_tarea_id;

  -- Log de creación
  INSERT INTO public.log_accion (
    tarea_id, usuario_id, tipo_accion,
    valor_anterior, valor_nuevo,
    justificacion, leido_por_jefe
  ) VALUES (
    v_tarea_id,
    auth.uid(),
    'creada',
    NULL,
    jsonb_build_object(
      'tipo',   'no_planificada',
      'estado', v_estado,
      'es_imprevisto', true
    ),
    NULL,
    false
  );

  RETURN v_tarea_id;
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_crear_incidencia(TEXT,TEXT,TEXT,TEXT,TEXT,BOOLEAN,UUID,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_crear_incidencia(TEXT,TEXT,TEXT,TEXT,TEXT,BOOLEAN,UUID,UUID) TO authenticated;

-- =============================================================================
-- VERIFICACIÓN
--
-- 1. Comprobar que el trigger existe:
-- SELECT tgname FROM pg_trigger WHERE tgname = 'trg_tarea_marcar_atrasada';
-- → 1 fila
--
-- 2. Comprobar tareas atrasadas actualizadas:
-- SELECT COUNT(*) FROM public.tarea WHERE estado = 'atrasada';
-- → Número mayor o igual al que había antes
--
-- 3. Verificar RPCs:
-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name IN (
--     'sgtd_cambiar_estado_tarea',
--     'sgtd_crear_incidencia'
--   );
-- → 2 filas
-- =============================================================================

COMMIT;