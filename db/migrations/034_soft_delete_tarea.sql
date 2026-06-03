-- =============================================================================
-- SGTD — Migración 034
-- Archivo: 034_soft_delete_tarea.sql
--
-- Soft-delete de tareas (eliminada_en) en lugar de DELETE físico:
--   - Preserva log_accion.tarea_id (sin hack SET NULL de 027)
--   - Vista tarea_activa con security_invoker (RLS del caller, PG15+)
--   - Trigger/backfill atrasada excluyen filas eliminadas
--
-- Prerrequisitos: 024, 027, 029. Recomendado: 033 (cancel OT al eliminar).
-- RLS: sin cambios — ocultación vía vista/queries, no políticas nuevas.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Columna soft-delete + índice parcial
-- -----------------------------------------------------------------------------
ALTER TABLE public.tarea
  ADD COLUMN IF NOT EXISTS eliminada_en timestamptz NULL;

COMMENT ON COLUMN public.tarea.eliminada_en IS
  'Marca de eliminación lógica; NULL = activa. No usar DELETE en tareas.';

CREATE INDEX IF NOT EXISTS idx_tarea_activa_asignado_semana
  ON public.tarea (asignado_a, semana_planificada)
  WHERE eliminada_en IS NULL;

-- -----------------------------------------------------------------------------
-- 2. Vista operativa (security_invoker → RLS de public.tarea del caller)
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.tarea_activa;

CREATE VIEW public.tarea_activa
  WITH (security_invoker = true) AS
  SELECT *
  FROM public.tarea
  WHERE eliminada_en IS NULL;

GRANT SELECT ON public.tarea_activa TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Trigger atrasada: no tocar tareas eliminadas
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_fn_marcar_atrasada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.eliminada_en IS NOT NULL THEN
    RETURN NEW;
  END IF;

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
-- 4. Backfill / escaneo atrasadas: solo activas
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
  PERFORM set_config('sgtd.skip_sla_notify', '1', true);

  UPDATE public.tarea
  SET estado = 'atrasada',
      updated_at = now()
  WHERE eliminada_en IS NULL
    AND tipo = 'planificada'
    AND fecha_planificada IS NOT NULL
    AND fecha_planificada < CURRENT_DATE
    AND estado IN ('pendiente', 'reprogramada');

  GET DIAGNOSTICS v_count = ROW_COUNT;

  PERFORM set_config('sgtd.skip_sla_notify', '', true);
  RETURN v_count;
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_marcar_atrasadas_vencidas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_marcar_atrasadas_vencidas() TO authenticated;

-- Wrapper usado por el frontend al montar Mi Semana
CREATE OR REPLACE FUNCTION public.sgtd_marcar_atrasadas_equipo()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.sgtd_marcar_atrasadas_vencidas();
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_marcar_atrasadas_equipo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_marcar_atrasadas_equipo() TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. Eliminar tarea → soft-delete + log (sin DELETE, sin flag 027)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_eliminar_tarea_con_motivo(
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
    AND eliminada_en IS NULL
    AND (asignado_a = auth.uid() OR public.sgtd_es_jefe());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarea no encontrada, ya eliminada o sin permisos (id: %)', p_tarea_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_estado IN ('completada', 'cancelada') THEN
    RAISE EXCEPTION 'No se puede eliminar una tarea en estado "%"', v_estado
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.tarea
  SET eliminada_en = now(),
      updated_at   = now()
  WHERE id = p_tarea_id;

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

  -- Opcional si 033 aplicada
  BEGIN
    PERFORM public.sgtd_cancelar_ots_vinculadas_tarea(
      p_tarea_id,
      p_usuario_id,
      'Tarea eliminada; OT vinculada cancelada'
    );
  EXCEPTION
    WHEN undefined_function THEN NULL;
  END;
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_eliminar_tarea_con_motivo(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_eliminar_tarea_con_motivo(UUID, UUID, TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- 6. SLA escaneo + resumen jefe: ignorar eliminadas
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_escanear_sla_equipo()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_backfill_atrasadas   integer;
  v_nuevas_atrasadas     integer;
  v_bloqueadas_criticas  integer := 0;
  v_row                  record;
  v_horas                integer;
  v_nombre               text;
BEGIN
  v_backfill_atrasadas := public.sgtd_marcar_atrasadas_vencidas();

  FOR v_row IN
    SELECT t.id, t.titulo, t.asignado_a, t.updated_at
    FROM public.tarea t
    WHERE t.eliminada_en IS NULL
      AND t.estado = 'bloqueada'
      AND t.updated_at < (now() - INTERVAL '48 hours')
      AND t.sla_bloqueada_notificada_at IS NULL
  LOOP
    SELECT nombre INTO v_nombre
    FROM public.usuario
    WHERE id = v_row.asignado_a;

    v_horas := GREATEST(
      48,
      (EXTRACT(EPOCH FROM (now() - v_row.updated_at)) / 3600)::integer
    );

    PERFORM public.sgtd_publicar_equipo_jefes(
      'tarea_bloqueada_critica',
      jsonb_build_object(
        'tareaId',       v_row.id,
        'titulo',        v_row.titulo,
        'horasBloqueada', v_horas,
        'asignadoA',     v_row.asignado_a,
        'usuarioNombre', COALESCE(v_nombre, 'Miembro')
      )
    );

    UPDATE public.tarea
    SET sla_bloqueada_notificada_at = now()
    WHERE id = v_row.id;

    v_bloqueadas_criticas := v_bloqueadas_criticas + 1;
  END LOOP;

  SELECT count(*)::integer
    INTO v_nuevas_atrasadas
  FROM public.tarea
  WHERE eliminada_en IS NULL
    AND estado = 'atrasada'
    AND updated_at >= (now() - INTERVAL '24 hours');

  IF v_nuevas_atrasadas > 0 OR v_bloqueadas_criticas > 0 THEN
    PERFORM public.sgtd_publicar_equipo_jefes(
      'resumen_sla_diario',
      jsonb_build_object(
        'nuevasAtrasadas',    v_nuevas_atrasadas,
        'bloqueadasCriticas', v_bloqueadas_criticas,
        'backfillAtrasadas',  v_backfill_atrasadas,
        'fecha',              to_char(CURRENT_DATE, 'YYYY-MM-DD')
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'backfill_atrasadas',   v_backfill_atrasadas,
    'nuevas_atrasadas_24h', v_nuevas_atrasadas,
    'bloqueadas_criticas',  v_bloqueadas_criticas
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sgtd_resumen_sla_jefe()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_atrasadas_activas    integer;
  v_atrasadas_nuevas_24h integer;
  v_bloqueadas_criticas  integer;
BEGIN
  IF NOT public.sgtd_es_jefe() THEN
    RAISE EXCEPTION 'Solo el jefe puede consultar el resumen SLA'
      USING ERRCODE = '42501';
  END IF;

  SELECT
    count(*) FILTER (WHERE estado = 'atrasada'),
    count(*) FILTER (
      WHERE estado = 'atrasada'
        AND updated_at >= (now() - INTERVAL '24 hours')
    ),
    count(*) FILTER (
      WHERE estado = 'bloqueada'
        AND updated_at < (now() - INTERVAL '48 hours')
    )
  INTO
    v_atrasadas_activas,
    v_atrasadas_nuevas_24h,
    v_bloqueadas_criticas
  FROM public.tarea
  WHERE eliminada_en IS NULL
    AND tipo = 'planificada';

  RETURN jsonb_build_object(
    'atrasadas_activas',    v_atrasadas_activas,
    'atrasadas_nuevas_24h', v_atrasadas_nuevas_24h,
    'bloqueadas_criticas',  v_bloqueadas_criticas,
    'fecha',                to_char(CURRENT_DATE, 'YYYY-MM-DD')
  );
END;
$$;

COMMIT;
