-- =============================================================================
-- SGTD — Migración 035
-- Archivo: 035_fix_grant_cancelar_ots.sql
--
-- Fix 42501: sgtd_cancelar_ots_vinculadas_tarea es SECURITY DEFINER pero
-- REVOKE ALL sin GRANT → los callers INVOKER (eliminar/completar tarea) fallan.
--
-- Prerrequisito: 033 aplicada.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.sgtd_cancelar_ots_vinculadas_tarea(
  p_tarea_id   uuid,
  p_usuario_id uuid,
  p_motivo     text DEFAULT 'Tarea completada sin cierre formal de OT'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ot record;
BEGIN
  IF p_usuario_id <> auth.uid() AND NOT public.sgtd_es_jefe() THEN
    RAISE EXCEPTION 'Sin permiso (usuario_id no coincide con la sesión)'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.tarea t
    WHERE t.id = p_tarea_id
      AND (t.asignado_a = auth.uid() OR public.sgtd_es_jefe())
  ) THEN
    RAISE EXCEPTION 'Sin permiso para cancelar OTs vinculadas a esta tarea'
      USING ERRCODE = '42501';
  END IF;

  FOR v_ot IN
    SELECT id, estado
    FROM public.orden_trabajo
    WHERE tarea_id = p_tarea_id
      AND estado NOT IN ('completada', 'cancelada', 'rechazada')
  LOOP
    UPDATE public.orden_trabajo
    SET estado = 'cancelada',
        updated_at = now()
    WHERE id = v_ot.id;

    INSERT INTO public.log_ot (ot_id, usuario_id, accion, estado_anterior, estado_nuevo, motivo)
    VALUES (
      v_ot.id,
      p_usuario_id,
      'cancelada',
      v_ot.estado,
      'cancelada',
      nullif(trim(coalesce(p_motivo, '')), '')
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.sgtd_cancelar_ots_vinculadas_tarea(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_cancelar_ots_vinculadas_tarea(uuid, uuid, text) TO authenticated;

COMMIT;
