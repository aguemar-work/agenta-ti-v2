-- =============================================================================
-- SGTD — Migración 033
-- Archivo: 033_sync_tarea_ot.sql
--
-- Sincroniza el vínculo bidireccional tarea ↔ OT:
--   1. sgtd_completar_tarea_con_resumen (RPC faltante en repo) + cancela OTs abiertas
--   2. sgtd_completar_ot — al cerrar OT, completa la tarea vinculada
--   3. sgtd_crear_ot_desde_tarea — atajo desde Mi Semana (planificada, no imprevisto)
--
-- Prerrequisitos: 010, 028, log_ot.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Cancelar OTs abiertas vinculadas a una tarea (uso interno)
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 2. Completar tarea con resumen (+ cierra OTs abiertas vinculadas)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_completar_tarea_con_resumen(
  p_tarea_id   uuid,
  p_usuario_id uuid,
  p_resumen    text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_estado text;
BEGIN
  IF p_resumen IS NULL OR length(trim(p_resumen)) < 10 THEN
    RAISE EXCEPTION 'Se requiere un resumen de al menos 10 caracteres'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT estado::text INTO v_estado
  FROM public.tarea
  WHERE id = p_tarea_id
    AND (asignado_a = auth.uid() OR public.sgtd_es_jefe());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarea no encontrada o sin permisos (id: %)', p_tarea_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_estado <> 'en_progreso' THEN
    RAISE EXCEPTION 'Solo se puede completar una tarea en progreso (estado actual: "%")', v_estado
      USING ERRCODE = 'P0003';
  END IF;

  UPDATE public.tarea
  SET estado = 'completada'::public.estado_tarea,
      fecha_completada = now(),
      updated_at = now()
  WHERE id = p_tarea_id;

  INSERT INTO public.log_accion (
    tarea_id, usuario_id, tipo_accion,
    valor_anterior, valor_nuevo, justificacion, leido_por_jefe
  ) VALUES (
    p_tarea_id,
    auth.uid(),
    'completada',
    jsonb_build_object('estado', v_estado),
    jsonb_build_object('estado', 'completada'),
    trim(p_resumen),
    false
  );

  PERFORM public.sgtd_cancelar_ots_vinculadas_tarea(
    p_tarea_id,
    p_usuario_id,
    'Tarea completada directamente; OT vinculada cancelada'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sgtd_completar_tarea_con_resumen(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_completar_tarea_con_resumen(uuid, uuid, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Completar OT → completar tarea vinculada (028 + sync)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_completar_ot(
  p_ot_id                uuid,
  p_usuario_id           uuid,
  p_receptor_nombre      text,
  p_receptor_dni         text,
  p_receptor_cargo       text,
  p_observaciones_cierre text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_estado      text;
  v_solicitante uuid;
  v_tarea_id    uuid;
  v_estado_tarea text;
BEGIN
  SELECT estado, creado_por, tarea_id
    INTO v_estado, v_solicitante, v_tarea_id
  FROM public.orden_trabajo
  WHERE id = p_ot_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OT no encontrada (id: %)', p_ot_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_estado <> 'en_ejecucion' THEN
    RAISE EXCEPTION 'Solo se puede completar una OT en ejecución (estado actual: "%")', v_estado
      USING ERRCODE = 'P0002';
  END IF;

  IF v_solicitante <> p_usuario_id AND NOT public.sgtd_es_jefe() THEN
    RAISE EXCEPTION 'Sin permiso para completar esta OT'
      USING ERRCODE = 'P0003';
  END IF;

  IF btrim(coalesce(p_receptor_nombre, '')) = '' THEN
    RAISE EXCEPTION 'El nombre del receptor es obligatorio'
      USING ERRCODE = 'P0004';
  END IF;

  IF btrim(coalesce(p_receptor_dni, '')) = '' THEN
    RAISE EXCEPTION 'El DNI del receptor es obligatorio'
      USING ERRCODE = 'P0005';
  END IF;

  UPDATE public.orden_trabajo
  SET estado                = 'completada',
      fecha_fin_real        = now(),
      receptor_nombre       = btrim(p_receptor_nombre),
      receptor_dni          = btrim(p_receptor_dni),
      receptor_cargo        = nullif(btrim(coalesce(p_receptor_cargo, '')), ''),
      observaciones_cierre  = nullif(btrim(coalesce(p_observaciones_cierre, '')), ''),
      updated_at            = now()
  WHERE id = p_ot_id;

  INSERT INTO public.log_ot (ot_id, usuario_id, accion, estado_anterior, estado_nuevo)
  VALUES (p_ot_id, p_usuario_id, 'completada', 'en_ejecucion', 'completada');

  IF v_tarea_id IS NOT NULL THEN
    SELECT estado::text INTO v_estado_tarea
    FROM public.tarea
    WHERE id = v_tarea_id;

    IF FOUND AND v_estado_tarea NOT IN ('completada', 'cancelada') THEN
      UPDATE public.tarea
      SET estado = 'completada'::public.estado_tarea,
          fecha_completada = now(),
          updated_at = now()
      WHERE id = v_tarea_id;

      INSERT INTO public.log_accion (
        tarea_id, usuario_id, tipo_accion,
        valor_anterior, valor_nuevo, justificacion, leido_por_jefe
      ) VALUES (
        v_tarea_id,
        p_usuario_id,
        'completada',
        jsonb_build_object('estado', v_estado_tarea),
        jsonb_build_object('estado', 'completada'),
        'Completada automáticamente al cerrar OT vinculada',
        false
      );
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.sgtd_completar_ot(uuid, uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_completar_ot(uuid, uuid, text, text, text, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. Crear OT borrador desde tarea planificada
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_crear_ot_desde_tarea(
  p_tarea_id        uuid,
  p_tipo_trabajo_id uuid DEFAULT NULL,
  p_fecha_estimada  text DEFAULT NULL,
  p_prioridad       text DEFAULT 'normal'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tarea   record;
  v_numero  text;
  v_ot_id   uuid;
  v_existe  uuid;
BEGIN
  SELECT titulo, descripcion, asignado_a, objetivo_id, fecha_planificada
    INTO v_tarea
  FROM public.tarea
  WHERE id = p_tarea_id
    AND es_imprevisto = false
    AND estado NOT IN ('completada', 'cancelada')
    AND (asignado_a = auth.uid() OR public.sgtd_es_jefe());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarea no encontrada, cerrada o sin permisos'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_existe
  FROM public.orden_trabajo
  WHERE tarea_id = p_tarea_id
    AND estado NOT IN ('completada', 'cancelada', 'rechazada')
  LIMIT 1;

  IF v_existe IS NOT NULL THEN
    RAISE EXCEPTION 'Ya existe una OT activa vinculada a esta tarea'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT public.generar_numero_ot() INTO v_numero;

  INSERT INTO public.orden_trabajo (
    numero, creado_por, tipo_trabajo_id,
    tarea_id, objetivo_id,
    estado, descripcion,
    area_destino, modalidad,
    fecha_estimada, prioridad
  ) VALUES (
    v_numero,
    auth.uid(),
    p_tipo_trabajo_id,
    p_tarea_id,
    v_tarea.objetivo_id,
    'borrador',
    coalesce(nullif(trim(v_tarea.descripcion), ''), v_tarea.titulo),
    'Por definir',
    'presencial',
    coalesce(p_fecha_estimada::date, v_tarea.fecha_planificada, CURRENT_DATE),
    coalesce(p_prioridad, 'normal')
  )
  RETURNING id INTO v_ot_id;

  INSERT INTO public.log_ot (ot_id, usuario_id, accion, estado_anterior, estado_nuevo)
  VALUES (v_ot_id, auth.uid(), 'creada', NULL, 'borrador');

  RETURN v_ot_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sgtd_crear_ot_desde_tarea(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_crear_ot_desde_tarea(uuid, uuid, text, text) TO authenticated;

COMMIT;
