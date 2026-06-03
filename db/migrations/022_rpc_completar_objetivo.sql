-- =============================================================================
-- SGTD — Migración 022
-- Archivo: 022_rpc_completar_objetivo.sql
--
-- Crea sgtd_completar_objetivo para cerrar un objetivo manualmente.
-- Reglas:
--   - Jefe: puede completar en cualquier momento
--   - Responsable del objetivo: puede completar cuando pct = 100
--   - Cualquier otro: sin permiso
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.sgtd_completar_objetivo(
  p_objetivo_id UUID,
  p_usuario_id  UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_responsable UUID;
  v_estado      TEXT;
  v_total       INT;
  v_completadas INT;
  v_pct         INT;
BEGIN
  SELECT responsable_id, estado INTO v_responsable, v_estado
  FROM public.objetivo
  WHERE id = p_objetivo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Objetivo no encontrado (id: %)', p_objetivo_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_estado NOT IN ('activo') THEN
    RAISE EXCEPTION 'El objetivo ya está en estado "%"', v_estado
      USING ERRCODE = 'P0002';
  END IF;

  -- Calcular progreso actual
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE estado::TEXT = 'completada')
  INTO v_total, v_completadas
  FROM public.tarea
  WHERE objetivo_id = p_objetivo_id
    AND tipo::TEXT = 'planificada';

  v_pct := CASE WHEN v_total = 0 THEN 0 ELSE (v_completadas * 100 / v_total) END;

  -- Validar permisos
  IF NOT public.sgtd_es_jefe() THEN
    -- Miembro/responsable solo puede completar si es responsable Y pct = 100
    IF p_usuario_id <> v_responsable THEN
      RAISE EXCEPTION 'Sin permiso para completar este objetivo'
        USING ERRCODE = 'P0003';
    END IF;
    IF v_pct < 100 THEN
      RAISE EXCEPTION 'Solo puedes completar el objetivo cuando todas las tareas estén completadas (progreso actual: %)', v_pct
        USING ERRCODE = 'P0004';
    END IF;
  END IF;

  UPDATE public.objetivo
  SET estado = 'completado', updated_at = now()
  WHERE id = p_objetivo_id;
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_completar_objetivo(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_completar_objetivo(UUID, UUID) TO authenticated;

COMMIT;