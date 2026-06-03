-- =============================================================================
-- SGTD — Migración 030
-- Revisión de justificaciones por el jefe: aceptar (tarea sin cambio) o devolver
-- (tarea a pendiente + nota del jefe). Marca el log original como revisado.
-- =============================================================================

BEGIN;

ALTER TABLE public.log_accion
  ADD COLUMN IF NOT EXISTS resultado_revision_jefe text
  CHECK (
    resultado_revision_jefe IS NULL
    OR resultado_revision_jefe IN ('aceptado', 'devuelto')
  );

CREATE OR REPLACE FUNCTION public.sgtd_fn_log_inmutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND current_setting('sgtd.permitir_null_tarea_id_log', true) = '1'
     AND OLD.tarea_id IS NOT NULL
     AND NEW.tarea_id IS NULL
     AND to_jsonb(OLD) - 'tarea_id' = to_jsonb(NEW) - 'tarea_id'
  THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND current_setting('sgtd.permitir_revision_log_jefe', true) = '1'
     AND OLD.id = NEW.id
     AND OLD.leido_por_jefe = false
     AND NEW.leido_por_jefe = true
     AND NEW.resultado_revision_jefe IN ('aceptado', 'devuelto')
     AND (to_jsonb(OLD) - 'leido_por_jefe' - 'resultado_revision_jefe')
       = (to_jsonb(NEW) - 'leido_por_jefe' - 'resultado_revision_jefe')
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'Los registros de auditoría son inmutables. No se permite UPDATE ni DELETE en %.', TG_TABLE_NAME;
END;
$$;

-- -----------------------------------------------------------------------------
-- Aceptar: la tarea no cambia; solo se cierra la revisión del log del miembro.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_aceptar_justificacion_jefe(p_log_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT public.sgtd_es_jefe() THEN
    RAISE EXCEPTION 'Solo el jefe puede revisar justificaciones'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.log_accion
    WHERE id = p_log_id
      AND leido_por_jefe = false
      AND justificacion IS NOT NULL
      AND length(trim(justificacion)) >= 10
  ) THEN
    RAISE EXCEPTION 'Justificación no encontrada o ya revisada (id: %)', p_log_id
      USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('sgtd.permitir_revision_log_jefe', '1', true);
  UPDATE public.log_accion
  SET leido_por_jefe = true,
      resultado_revision_jefe = 'aceptado'
  WHERE id = p_log_id;
  PERFORM set_config('sgtd.permitir_revision_log_jefe', '', true);
END;
$$;

-- -----------------------------------------------------------------------------
-- Devolver: tarea → pendiente + log de devolución del jefe + cierre del log original.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_devolver_justificacion_jefe(
  p_log_id    UUID,
  p_nota_jefe TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tarea_id          UUID;
  v_estado            TEXT;
  v_fecha             DATE;
  v_semana            TEXT;
  v_titulo            TEXT;
BEGIN
  IF NOT public.sgtd_es_jefe() THEN
    RAISE EXCEPTION 'Solo el jefe puede devolver justificaciones'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_nota_jefe IS NULL OR length(trim(p_nota_jefe)) < 10 THEN
    RAISE EXCEPTION 'La nota del jefe debe tener al menos 10 caracteres'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT l.tarea_id
    INTO v_tarea_id
  FROM public.log_accion l
  WHERE l.id = p_log_id
    AND l.leido_por_jefe = false
    AND l.justificacion IS NOT NULL
    AND l.tarea_id IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Justificación no encontrada, ya revisada o sin tarea vinculada (id: %)', p_log_id
      USING ERRCODE = 'P0002';
  END IF;

  SELECT estado::TEXT, fecha_planificada, semana_planificada, titulo
    INTO v_estado, v_fecha, v_semana, v_titulo
  FROM public.tarea
  WHERE id = v_tarea_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarea vinculada no encontrada (id: %)', v_tarea_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_fecha IS NULL THEN
    v_fecha := CURRENT_DATE;
  END IF;

  IF v_estado IN ('pendiente', 'atrasada', 'reprogramada', 'en_progreso') THEN
    PERFORM public.sgtd_reprogramar_tarea_con_log(
      v_tarea_id,
      auth.uid(),
      v_fecha::TEXT,
      trim(p_nota_jefe),
      'pendiente'
    );
  ELSIF v_estado IN ('bloqueada', 'completada', 'cancelada') THEN
    UPDATE public.tarea
    SET
      estado     = 'pendiente'::public.estado_tarea,
      updated_at = now()
    WHERE id = v_tarea_id;

    INSERT INTO public.log_accion (
      tarea_id, usuario_id, tipo_accion,
      valor_anterior, valor_nuevo,
      justificacion, leido_por_jefe
    ) VALUES (
      v_tarea_id,
      auth.uid(),
      'estado_cambiado',
      jsonb_build_object('estado', v_estado, 'titulo', v_titulo),
      jsonb_build_object('estado', 'pendiente'),
      trim(p_nota_jefe),
      false
    );
  ELSE
    RAISE EXCEPTION 'No se puede devolver una tarea en estado "%"', v_estado
      USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('sgtd.permitir_revision_log_jefe', '1', true);
  UPDATE public.log_accion
  SET leido_por_jefe = true,
      resultado_revision_jefe = 'devuelto'
  WHERE id = p_log_id;
  PERFORM set_config('sgtd.permitir_revision_log_jefe', '', true);
END;
$$;

REVOKE ALL ON FUNCTION public.sgtd_aceptar_justificacion_jefe(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_aceptar_justificacion_jefe(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.sgtd_devolver_justificacion_jefe(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_devolver_justificacion_jefe(UUID, TEXT) TO authenticated;

COMMIT;
