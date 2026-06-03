-- =============================================================================
-- SGTD — Migración 027
-- Fixes críticos:
--   1. sgtd_eliminar_tarea_con_motivo — FK SET NULL en log_accion disparaba
--      el trigger de inmutabilidad al DELETE tarea.
--   2. sgtd_fn_marcar_atrasada — incluir reprogramada vencida → atrasada.
--   3. sgtd_marcar_atrasadas_vencidas — backfill de filas existentes.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Logs: permitir solo anular tarea_id al eliminar la tarea (SET NULL por FK)
-- -----------------------------------------------------------------------------
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

  RAISE EXCEPTION
    'Los registros de auditoría son inmutables. No se permite UPDATE ni DELETE en %.', TG_TABLE_NAME;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. Eliminar tarea: INSERT log eliminada + DELETE (sin tocar otros logs)
-- -----------------------------------------------------------------------------
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
  IF p_motivo IS NULL OR length(trim(p_motivo)) < 10 THEN
    RAISE EXCEPTION 'El motivo debe tener al menos 10 caracteres'
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

  IF v_estado IN ('completada', 'cancelada') THEN
    RAISE EXCEPTION 'No se puede eliminar una tarea en estado "%"', v_estado
      USING ERRCODE = 'P0001';
  END IF;

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

  PERFORM set_config('sgtd.permitir_null_tarea_id_log', '1', true);
  DELETE FROM public.tarea WHERE id = p_tarea_id;
  PERFORM set_config('sgtd.permitir_null_tarea_id_log', '', true);
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_eliminar_tarea_con_motivo(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_eliminar_tarea_con_motivo(UUID, UUID, TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Trigger: reprogramada vencida → atrasada (igual que pendiente)
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
  AND NEW.estado IN ('pendiente', 'reprogramada')
  AND NEW.tipo = 'planificada'
  THEN
    NEW.estado := 'atrasada';
  END IF;

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. Backfill: tareas ya reprogramadas/pendientes vencidas en BD
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_marcar_atrasadas_vencidas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.tarea
  SET estado = 'atrasada'
  WHERE tipo = 'planificada'
    AND fecha_planificada IS NOT NULL
    AND fecha_planificada < CURRENT_DATE
    AND estado IN ('pendiente', 'reprogramada');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_marcar_atrasadas_vencidas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_marcar_atrasadas_vencidas() TO authenticated;

COMMIT;
