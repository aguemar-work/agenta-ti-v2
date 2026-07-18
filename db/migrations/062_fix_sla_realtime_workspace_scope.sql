-- =============================================================================
-- SGTD — Migración 062
-- Archivo: 062_fix_sla_realtime_workspace_scope.sql
--
-- SEGURIDAD (auditoría 2026-07-17, hallazgo #1 — fuga cross-org en realtime SLA):
--   * sgtd_publicar_equipo_jefes (029) publicaba a TODOS los jefes de la
--     plataforma (usuario.rol = 'jefe'), sin filtro de organización/workspace.
--   * sgtd_escanear_sla_equipo (039) recorría TODAS las tareas de la plataforma
--     y emitía payloads con titulo + usuarioNombre a jefes de otras orgs.
--   * sgtd_resumen_sla_jefe (039) contaba tareas de toda la plataforma.
--
-- Cambios:
--   1. sgtd_publicar_equipo_jefes gana p_workspace_id y publica solo a los
--      jefes ACTIVOS de ese workspace (workspace_member.rol = 'jefe'), con
--      workspace y organización activos. Se elimina la firma antigua (2 args).
--   2. sgtd_escanear_sla_equipo agrupa por workspace_id de la tarea y publica
--      por workspace; el resumen diario también se emite por workspace.
--      Los payloads incluyen workspaceId (aditivo, no rompe el frontend).
--   3. sgtd_resumen_sla_jefe filtra por sgtd_workspace_id() (header V5).
--
-- Prerrequisitos: 039, 043 (workspace foundation), 048 (helpers superadmin).
-- Frontend: sin cambios (canal equipo:{jefeId} se mantiene).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Publicar SOLO a los jefes del workspace de la tarea.
--    Se elimina la firma antigua para que no quede la versión con fuga.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.sgtd_publicar_equipo_jefes(text, jsonb);

CREATE OR REPLACE FUNCTION public.sgtd_publicar_equipo_jefes(
  p_workspace_id uuid,
  p_evento       text,
  p_payload      jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jefe record;
BEGIN
  IF p_workspace_id IS NULL THEN
    RETURN;  -- sin workspace no hay destinatarios válidos
  END IF;

  FOR v_jefe IN
    SELECT wm.usuario_id
    FROM public.workspace_member wm
    JOIN public.workspace w    ON w.id = wm.workspace_id
    JOIN public.organizacion o ON o.id = w.organizacion_id
    WHERE wm.workspace_id = p_workspace_id
      AND wm.rol          = 'jefe'
      AND wm.activo       = true
      AND wm.joined_at    IS NOT NULL
      AND w.activo        = true
      AND o.activa        = true
  LOOP
    PERFORM realtime.publish(
      'equipo:' || v_jefe.usuario_id::text,
      p_evento,
      p_payload
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.sgtd_publicar_equipo_jefes(uuid, text, jsonb) FROM PUBLIC;

-- -----------------------------------------------------------------------------
-- 2. Escaneo diario por workspace (cron). Dedup igual que 039; el payload
--    añade workspaceId y el resumen diario se agrega por workspace.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_escanear_sla_equipo()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row               record;
  v_ws                record;
  v_nombre            text;
  v_dias              integer;
  v_notificadas       integer := 0;
  v_inicio            timestamptz := now();  -- constante en la transacción:
                                             -- identifica las filas de ESTA corrida
BEGIN
  -- 2a. Limpiar dedup en tareas que ya NO están atrasadas (sin cambios de 039)
  UPDATE public.tarea
  SET sla_atrasada_notificada_at = NULL
  WHERE sla_atrasada_notificada_at IS NOT NULL
    AND NOT (
      eliminada_en IS NULL
      AND tipo = 'planificada'
      AND fecha_planificada IS NOT NULL
      AND fecha_planificada < CURRENT_DATE
      AND estado::text IN ('pendiente','en_progreso')
    );

  -- 2b. Notificar atrasadas no notificadas hoy, a los jefes de SU workspace
  FOR v_row IN
    SELECT id, titulo, asignado_a, fecha_planificada, workspace_id
    FROM public.tarea
    WHERE eliminada_en IS NULL
      AND workspace_id IS NOT NULL
      AND tipo = 'planificada'
      AND fecha_planificada IS NOT NULL
      AND fecha_planificada < CURRENT_DATE
      AND estado::text IN ('pendiente','en_progreso')
      AND (sla_atrasada_notificada_at IS NULL
           OR sla_atrasada_notificada_at < CURRENT_DATE)
  LOOP
    SELECT nombre INTO v_nombre FROM public.usuario WHERE id = v_row.asignado_a;
    v_dias := GREATEST(1, CURRENT_DATE - v_row.fecha_planificada);

    PERFORM public.sgtd_publicar_equipo_jefes(
      v_row.workspace_id,
      'tarea_atrasada',
      jsonb_build_object(
        'tareaId',       v_row.id,
        'titulo',        v_row.titulo,
        'diasAtraso',    v_dias,
        'asignadoA',     v_row.asignado_a,
        'usuarioNombre', COALESCE(v_nombre, 'Miembro'),
        'workspaceId',   v_row.workspace_id
      )
    );

    UPDATE public.tarea
    SET sla_atrasada_notificada_at = now()
    WHERE id = v_row.id;

    v_notificadas := v_notificadas + 1;
  END LOOP;

  -- 2c. Resumen diario POR WORKSPACE (antes: uno global a toda la plataforma).
  --     Solo las tareas notificadas en esta corrida (marcadas con now() = v_inicio).
  IF v_notificadas > 0 THEN
    FOR v_ws IN
      SELECT workspace_id, count(*)::integer AS notificadas
      FROM public.tarea
      WHERE sla_atrasada_notificada_at = v_inicio
        AND workspace_id IS NOT NULL
      GROUP BY workspace_id
    LOOP
      PERFORM public.sgtd_publicar_equipo_jefes(
        v_ws.workspace_id,
        'resumen_sla_diario',
        jsonb_build_object(
          'notificadasHoy', v_ws.notificadas,
          'fecha',          to_char(CURRENT_DATE, 'YYYY-MM-DD'),
          'workspaceId',    v_ws.workspace_id
        )
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'notificadas_hoy', v_notificadas,
    'fecha',           to_char(CURRENT_DATE, 'YYYY-MM-DD')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sgtd_escanear_sla_equipo() FROM PUBLIC;
-- Sin GRANT a authenticated: solo cron / service / SQL Editor (igual que 029/039).

-- -----------------------------------------------------------------------------
-- 3. Resumen SLA del jefe acotado al workspace del header (V5)
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
BEGIN
  IF NOT public.sgtd_es_jefe() THEN
    RAISE EXCEPTION 'Solo el jefe puede consultar el resumen SLA'
      USING ERRCODE = '42501';
  END IF;

  SELECT
    count(*) FILTER (
      WHERE fecha_planificada < CURRENT_DATE
        AND estado::text IN ('pendiente','en_progreso')
    ),
    count(*) FILTER (
      WHERE fecha_planificada < CURRENT_DATE
        AND estado::text IN ('pendiente','en_progreso')
        AND sla_atrasada_notificada_at >= CURRENT_DATE
    )
  INTO v_atrasadas_activas, v_atrasadas_nuevas_24h
  FROM public.tarea
  WHERE eliminada_en IS NULL
    AND tipo = 'planificada'
    AND workspace_id = public.sgtd_workspace_id();

  RETURN jsonb_build_object(
    'atrasadas_activas',    v_atrasadas_activas,
    'atrasadas_nuevas_24h', v_atrasadas_nuevas_24h,
    'bloqueadas_criticas',  0,   -- deprecado desde 039
    'fecha',                to_char(CURRENT_DATE, 'YYYY-MM-DD')
  );
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_resumen_sla_jefe() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_resumen_sla_jefe() TO authenticated;

COMMIT;

-- -----------------------------------------------------------------------------
-- Verificación (ejecutar tras COMMIT)
-- -----------------------------------------------------------------------------
-- 1) La firma antigua (con fuga) ya no existe; la nueva sí:
-- SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
--   FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
--  WHERE n.nspname = 'public' AND p.proname = 'sgtd_publicar_equipo_jefes';
--   → una sola fila: (uuid, text, jsonb)
--
-- 2) El resumen del jefe solo cuenta el workspace del header:
-- -- con x-workspace-id del WS A vs WS B deben salir conteos distintos.
--
-- 3) Prueba de aislamiento (dos orgs con tareas atrasadas):
-- SELECT public.sgtd_escanear_sla_equipo();
-- -- el jefe de la org B NO debe recibir eventos 'tarea_atrasada' de la org A
-- -- en su canal equipo:{jefeId}.
