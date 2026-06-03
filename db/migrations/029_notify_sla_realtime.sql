-- =============================================================================
-- SGTD — Migración 029
-- Archivo: 029_notify_sla_realtime.sql
--
-- Notificaciones SLA in-app vía InsForge Realtime (sin email/Slack):
--   1. Columna dedup para bloqueadas >48h
--   2. Helper sgtd_publicar_equipo_jefes → realtime.publish('equipo:{jefeId}', …)
--   3. Trigger AFTER UPDATE: transición a 'atrasada' → evento tarea_atrasada
--   4. RPC sgtd_escanear_sla_equipo (cron 08:00): backfill atrasadas + bloqueadas críticas + resumen
--   5. RPC sgtd_resumen_sla_jefe (jefe al abrir la app)
--
-- Prerrequisitos: 009, 015, 027 aplicadas.
-- Frontend: useRealtimeNotificaciones + notificationPrefs (eventos nuevos).
--
-- Post-aplicar (una vez por entorno, opcional backfill inmediato):
--   SELECT public.sgtd_escanear_sla_equipo();
--
-- Cron InsForge / pg_cron (08:00 America/Lima o TZ del equipo):
--   SELECT public.sgtd_escanear_sla_equipo();
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Canal realtime equipo (idempotente; omitir si la tabla no existe en el entorno)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'realtime' AND table_name = 'channels'
  ) THEN
    INSERT INTO realtime.channels (pattern, description, enabled)
    VALUES ('equipo:%', 'Eventos de equipo / SLA para jefes', true)
    ON CONFLICT (pattern) DO UPDATE
      SET enabled = EXCLUDED.enabled,
          description = EXCLUDED.description;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 1. Dedup: no re-notificar la misma tarea bloqueada >48h cada día
-- -----------------------------------------------------------------------------
ALTER TABLE public.tarea
  ADD COLUMN IF NOT EXISTS sla_bloqueada_notificada_at timestamptz;

COMMENT ON COLUMN public.tarea.sla_bloqueada_notificada_at IS
  'Marca de envío del evento tarea_bloqueada_critica; se limpia al salir de bloqueada.';

-- -----------------------------------------------------------------------------
-- 2. Publicar a todos los jefes activos (patrón equipo:{id} del frontend)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_publicar_equipo_jefes(
  p_evento  text,
  p_payload jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jefe record;
BEGIN
  FOR v_jefe IN
    SELECT id FROM public.usuario
    WHERE rol = 'jefe' AND COALESCE(activo, true)
  LOOP
    PERFORM realtime.publish(
      'equipo:' || v_jefe.id::text,
      p_evento,
      p_payload
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.sgtd_publicar_equipo_jefes(text, jsonb) FROM PUBLIC;

-- -----------------------------------------------------------------------------
-- 3. Limpiar dedup al desbloquear / cambiar estado desde bloqueada
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_fn_reset_sla_flags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.estado = 'bloqueada' AND NEW.estado IS DISTINCT FROM OLD.estado THEN
    NEW.sla_bloqueada_notificada_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tarea_reset_sla_flags ON public.tarea;
CREATE TRIGGER trg_tarea_reset_sla_flags
  BEFORE UPDATE OF estado
  ON public.tarea
  FOR EACH ROW
  EXECUTE FUNCTION public.sgtd_fn_reset_sla_flags();

-- -----------------------------------------------------------------------------
-- 4. Notificar transición a atrasada (después del BEFORE de mig 009/027)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_fn_notify_sla()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nombre_asignado text;
  v_dias            integer;
BEGIN
  IF current_setting('sgtd.skip_sla_notify', true) = '1' THEN
    RETURN NEW;
  END IF;

  IF NEW.estado = 'atrasada'
     AND (OLD.estado IS NULL OR OLD.estado IS DISTINCT FROM 'atrasada')
  THEN
    SELECT nombre INTO v_nombre_asignado
    FROM public.usuario
    WHERE id = NEW.asignado_a;

    v_dias := GREATEST(
      1,
      COALESCE(CURRENT_DATE - NEW.fecha_planificada, 1)
    );

    PERFORM public.sgtd_publicar_equipo_jefes(
      'tarea_atrasada',
      jsonb_build_object(
        'tareaId',         NEW.id,
        'titulo',          NEW.titulo,
        'diasAtraso',      v_dias,
        'asignadoA',       NEW.asignado_a,
        'usuarioNombre',   COALESCE(v_nombre_asignado, 'Miembro')
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_sla ON public.tarea;
CREATE TRIGGER trg_notify_sla
  AFTER UPDATE OF estado
  ON public.tarea
  FOR EACH ROW
  WHEN (OLD.estado IS DISTINCT FROM NEW.estado)
  EXECUTE FUNCTION public.sgtd_fn_notify_sla();

-- -----------------------------------------------------------------------------
-- 5. Backfill atrasadas sin spam de toasts (solo resumen en escanear)
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
  WHERE tipo = 'planificada'
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

-- -----------------------------------------------------------------------------
-- 6. Escaneo diario: atrasadas + bloqueadas >48h + resumen agregado
--    Ejecutar desde cron / SQL Editor (no expuesto a miembros).
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
    WHERE t.estado = 'bloqueada'
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
  WHERE estado = 'atrasada'
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

REVOKE ALL ON FUNCTION public.sgtd_escanear_sla_equipo() FROM PUBLIC;
-- Sin GRANT a authenticated: solo cron / service / SQL Editor.

-- -----------------------------------------------------------------------------
-- 7. Resumen para el jefe al abrir la app (Capa 3)
-- -----------------------------------------------------------------------------
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
  WHERE tipo = 'planificada';

  RETURN jsonb_build_object(
    'atrasadas_activas',    v_atrasadas_activas,
    'atrasadas_nuevas_24h', v_atrasadas_nuevas_24h,
    'bloqueadas_criticas',  v_bloqueadas_criticas,
    'fecha',                to_char(CURRENT_DATE, 'YYYY-MM-DD')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sgtd_resumen_sla_jefe() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_resumen_sla_jefe() TO authenticated;

COMMIT;

-- -----------------------------------------------------------------------------
-- Verificación (ejecutar tras COMMIT)
-- -----------------------------------------------------------------------------
-- SELECT proname FROM pg_proc p
--   JOIN pg_namespace n ON p.pronamespace = n.oid
--  WHERE n.nspname = 'public'
--    AND proname IN (
--      'sgtd_publicar_equipo_jefes',
--      'sgtd_fn_notify_sla',
--      'sgtd_escanear_sla_equipo',
--      'sgtd_resumen_sla_jefe'
--    );
--
-- SELECT tgname FROM pg_trigger
--  WHERE tgname IN ('trg_notify_sla', 'trg_tarea_reset_sla_flags');
--
-- SELECT column_name FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'tarea'
--    AND column_name = 'sla_bloqueada_notificada_at';
