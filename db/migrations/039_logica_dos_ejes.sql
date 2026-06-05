-- =============================================================================
-- SGTD — Migración 039  ·  Modelo de tarea v1.1 — FASE LÓGICA
--
-- Deja de escribir estados derivados (atrasada / reprogramada / bloqueada) y
-- reemplaza el SLA basado en triggers por un cron sobre la situación calculada.
-- NO toca aún los enums (eso es la 040): los valores viejos siguen existiendo
-- como red de seguridad, pero ya nadie los escribe.
--
-- REFINAMIENTO sobre el plan original: el remapeo de datos se hace AQUÍ (no en
-- la 040), justo después de quitar los triggers que marcaban 'atrasada', para
-- que ninguna fila quede en un estado fantasma durante la ventana 039→040.
--
-- Prerrequisitos: 038 aplicada.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Quitar los triggers que escribían estados derivados o notificaban por
--    transición de estado. (Se conserva tarea_updated_at.)
--    Las funciones quedan huérfanas pero inofensivas; se borran en la 040.
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS sgtd_tarea_evaluar_atrasada ON public.tarea;
DROP TRIGGER IF EXISTS trg_tarea_marcar_atrasada   ON public.tarea;
DROP TRIGGER IF EXISTS trg_notify_sla              ON public.tarea;
DROP TRIGGER IF EXISTS trg_tarea_reset_sla_flags   ON public.tarea;

-- -----------------------------------------------------------------------------
-- 2. Neutralizar el backfill de 'atrasada'. El frontend aún llama a
--    sgtd_marcar_atrasadas_equipo al montar Mi Semana (hasta el paso 5); si
--    siguiera escribiendo 'atrasada' re-introduciría el estado. Se vuelve no-op.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_marcar_atrasadas_vencidas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 'atrasada' ahora es situación calculada (vista tarea_activa). No-op.
  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.sgtd_marcar_atrasadas_equipo()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 0;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. sgtd_cambiar_estado_tarea — máquina de 4 estados.
--    Transiciones válidas: pendiente → en_progreso | cancelada
--                          en_progreso → completada | cancelada
--    Sin 'bloqueada' ni 'reprogramada'. Justificación obligatoria para cancelar.
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
  v_tipo_log      TEXT;
BEGIN
  SELECT estado::TEXT
    INTO v_estado_actual
  FROM public.tarea
  WHERE id = p_tarea_id
    AND (asignado_a = auth.uid() OR public.sgtd_es_jefe());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarea no encontrada o sin permisos (id: %)', p_tarea_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (
       (v_estado_actual = 'pendiente'   AND p_nuevo_estado IN ('en_progreso','cancelada'))
    OR (v_estado_actual = 'en_progreso' AND p_nuevo_estado IN ('completada','cancelada'))
  ) THEN
    RAISE EXCEPTION 'Transición inválida: % → %', v_estado_actual, p_nuevo_estado
      USING ERRCODE = 'P0002';
  END IF;

  IF p_nuevo_estado = 'cancelada' THEN
    IF p_justificacion IS NULL OR length(trim(p_justificacion)) < 10 THEN
      RAISE EXCEPTION 'Se requiere justificación de al menos 10 caracteres para cancelar'
        USING ERRCODE = 'P0003';
    END IF;
  END IF;

  v_tipo_log := CASE p_nuevo_estado
    WHEN 'en_progreso' THEN 'iniciada'
    WHEN 'completada'  THEN 'completada'
    WHEN 'cancelada'   THEN 'cancelada'
    ELSE 'estado_cambiado'
  END;

  UPDATE public.tarea
  SET
    estado           = p_nuevo_estado::public.estado_tarea,
    fecha_completada = CASE WHEN p_nuevo_estado = 'completada' THEN now() ELSE fecha_completada END,
    updated_at       = now()
  WHERE id = p_tarea_id;

  INSERT INTO public.log_accion (
    tarea_id, usuario_id, tipo_accion,
    valor_anterior, valor_nuevo, justificacion, leido_por_jefe
  ) VALUES (
    p_tarea_id, auth.uid(), v_tipo_log,
    jsonb_build_object('estado', v_estado_actual),
    jsonb_build_object('estado', p_nuevo_estado),
    nullif(trim(coalesce(p_justificacion, '')), ''),
    false
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. sgtd_reprogramar_tarea_con_log — NO cambia estado; suma reprogramaciones.
--    Firma intacta (p_nuevo_estado se ignora, por compatibilidad PostgREST).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_reprogramar_tarea_con_log(
  p_tarea_id      UUID,
  p_usuario_id    UUID,
  p_nueva_fecha   TEXT,
  p_justificacion TEXT,
  p_nuevo_estado  TEXT DEFAULT NULL   -- ignorado: reprogramar ya no cambia estado
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_estado_actual   TEXT;
  v_fecha_anterior  DATE;
  v_semana_anterior TEXT;
  v_nueva_semana    TEXT;
BEGIN
  IF p_justificacion IS NULL OR length(trim(p_justificacion)) < 10 THEN
    RAISE EXCEPTION 'Se requiere justificación de al menos 10 caracteres'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT estado::TEXT, fecha_planificada, semana_planificada
    INTO v_estado_actual, v_fecha_anterior, v_semana_anterior
  FROM public.tarea
  WHERE id = p_tarea_id
    AND (asignado_a = auth.uid() OR public.sgtd_es_jefe());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarea no encontrada o sin permisos (id: %)', p_tarea_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_estado_actual NOT IN ('pendiente','en_progreso') THEN
    RAISE EXCEPTION 'Solo se reprograman tareas pendientes o en progreso (estado: %)', v_estado_actual
      USING ERRCODE = 'P0002';
  END IF;

  SELECT to_char(date_trunc('week', p_nueva_fecha::DATE), 'IYYYIW')
    INTO v_nueva_semana;

  UPDATE public.tarea
  SET
    fecha_planificada  = p_nueva_fecha::DATE,
    semana_planificada = v_nueva_semana,
    reprogramaciones   = reprogramaciones + 1,   -- eje 2 (situación)
    updated_at         = now()
    -- estado: SIN CAMBIOS (reprogramar ≠ reabrir)
  WHERE id = p_tarea_id;

  INSERT INTO public.log_accion (
    tarea_id, usuario_id, tipo_accion,
    valor_anterior, valor_nuevo, justificacion, leido_por_jefe
  ) VALUES (
    p_tarea_id, auth.uid(), 'reprogramada',
    jsonb_build_object('fecha_planificada', v_fecha_anterior::TEXT, 'semana_planificada', v_semana_anterior),
    jsonb_build_object('fecha_planificada', p_nueva_fecha,          'semana_planificada', v_nueva_semana),
    trim(p_justificacion),
    false
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. SLA por cron sobre la situación calculada (reemplaza los triggers).
--    Mantiene el evento realtime 'tarea_atrasada'. Dedup diario por tarea con
--    sla_atrasada_notificada_at. Se elimina el flujo de "bloqueadas críticas".
--    Nota: consulta public.tarea directamente (no la vista) porque es DEFINER.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_escanear_sla_equipo()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row              record;
  v_nombre           text;
  v_dias             integer;
  v_notificadas      integer := 0;
BEGIN
  -- 5a. Limpiar dedup en tareas que ya NO están atrasadas
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

  -- 5b. Notificar atrasadas no notificadas hoy
  FOR v_row IN
    SELECT id, titulo, asignado_a, fecha_planificada
    FROM public.tarea
    WHERE eliminada_en IS NULL
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
      'tarea_atrasada',
      jsonb_build_object(
        'tareaId',       v_row.id,
        'titulo',        v_row.titulo,
        'diasAtraso',    v_dias,
        'asignadoA',     v_row.asignado_a,
        'usuarioNombre', COALESCE(v_nombre, 'Miembro')
      )
    );

    UPDATE public.tarea
    SET sla_atrasada_notificada_at = now()
    WHERE id = v_row.id;

    v_notificadas := v_notificadas + 1;
  END LOOP;

  IF v_notificadas > 0 THEN
    PERFORM public.sgtd_publicar_equipo_jefes(
      'resumen_sla_diario',
      jsonb_build_object(
        'notificadasHoy', v_notificadas,
        'fecha',          to_char(CURRENT_DATE, 'YYYY-MM-DD')
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'notificadas_hoy', v_notificadas,
    'fecha',           to_char(CURRENT_DATE, 'YYYY-MM-DD')
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. Resumen SLA del jefe — calcula atraso por situación derivada (no por estado)
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
    -- "nuevas 24h" se redefine como: notificadas hoy y aún atrasadas
    count(*) FILTER (
      WHERE fecha_planificada < CURRENT_DATE
        AND estado::text IN ('pendiente','en_progreso')
        AND sla_atrasada_notificada_at >= CURRENT_DATE
    )
  INTO v_atrasadas_activas, v_atrasadas_nuevas_24h
  FROM public.tarea
  WHERE eliminada_en IS NULL
    AND tipo = 'planificada';

  RETURN jsonb_build_object(
    'atrasadas_activas',    v_atrasadas_activas,
    'atrasadas_nuevas_24h', v_atrasadas_nuevas_24h,
    'bloqueadas_criticas',  0,   -- deprecado: 'bloqueada' eliminado
    'fecha',                to_char(CURRENT_DATE, 'YYYY-MM-DD')
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. Remapeo de datos: ningún registro debe quedar en un estado/tipo muerto.
--    Se hace DESPUÉS de quitar los triggers (paso 1) para que no se re-marquen.
--    La situación derivada sigue mostrando 'atrasada'/'reprogramada' igual.
-- -----------------------------------------------------------------------------
UPDATE public.tarea
SET estado = 'pendiente'::public.estado_tarea,
    updated_at = now()
WHERE estado::text IN ('atrasada','reprogramada','bloqueada');

UPDATE public.tarea
SET tipo = 'planificada'::public.tipo_tarea,
    updated_at = now()
WHERE tipo::text = 'libre';

COMMIT;

-- -----------------------------------------------------------------------------
-- Verificación (correr aparte tras el COMMIT):
--
--   -- Ya no quedan estados/tipos muertos en datos:
--   SELECT estado, count(*) FROM public.tarea GROUP BY 1 ORDER BY 1;
--   SELECT tipo,   count(*) FROM public.tarea GROUP BY 1 ORDER BY 1;
--
--   -- La situación sigue calculándose igual (atrasada/creada/reprogramada):
--   SELECT situacion, count(*) FROM public.tarea_activa GROUP BY 1 ORDER BY 1;
--
--   -- Triggers de atrasada/SLA ya no están (solo debe quedar tarea_updated_at):
--   SELECT trigger_name FROM information_schema.triggers
--   WHERE event_object_table = 'tarea' ORDER BY 1;
-- -----------------------------------------------------------------------------
