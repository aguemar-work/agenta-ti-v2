-- =============================================================================
-- SGTD — Migración 036
-- Archivo: 036_simplificar_flujo_ot.sql
--
-- Simplifica el flujo de OT a 4 estados activos:
--   borrador → pendiente → aprobada → completada
-- Terminales: rechazada (jefe) · cancelada (creador/jefe)
--
-- Cambios clave:
--   - Elimina estado en_ejecucion y RPC sgtd_iniciar_ejecucion_ot
--   - numero OT-TI-XXXX se asigna al ENVIAR (sgtd_enviar_ot), idempotente
--   - Borradores pueden tener numero NULL hasta el envío
--   - sgtd_completar_ot acepta estado aprobada (antes en_ejecucion)
--
-- Prerrequisitos: 010, 028, 033.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Migrar datos: en_ejecucion → aprobada (cerrables con el nuevo flujo)
-- -----------------------------------------------------------------------------
UPDATE public.orden_trabajo
SET estado = 'aprobada',
    updated_at = now()
WHERE estado = 'en_ejecucion';

-- -----------------------------------------------------------------------------
-- 2. numero nullable en borrador (UNIQUE en PG permite múltiples NULL)
-- -----------------------------------------------------------------------------
ALTER TABLE public.orden_trabajo
  ALTER COLUMN numero DROP NOT NULL;

-- -----------------------------------------------------------------------------
-- 3. CHECK de estados sin en_ejecucion
-- -----------------------------------------------------------------------------
ALTER TABLE public.orden_trabajo
  DROP CONSTRAINT IF EXISTS orden_trabajo_estado_check;

ALTER TABLE public.orden_trabajo
  ADD CONSTRAINT orden_trabajo_estado_check
  CHECK (estado IN (
    'borrador', 'pendiente', 'aprobada',
    'completada', 'rechazada', 'cancelada'
  ));

-- Borradores sin número formal; pendiente+ exige número
ALTER TABLE public.orden_trabajo
  DROP CONSTRAINT IF EXISTS ck_ot_pendiente_tiene_numero;

ALTER TABLE public.orden_trabajo
  ADD CONSTRAINT ck_ot_pendiente_tiene_numero
  CHECK (
    estado = 'borrador'
    OR (numero IS NOT NULL AND btrim(numero) <> '')
  );

-- -----------------------------------------------------------------------------
-- 4. Eliminar RPC de inicio de ejecución
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.sgtd_iniciar_ejecucion_ot(uuid, uuid);

-- -----------------------------------------------------------------------------
-- 5. Enviar OT: genera OT-TI-XXXX solo aquí (idempotente si ya tiene número)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_enviar_ot(
  p_ot_id      uuid,
  p_usuario_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_ot record;
BEGIN
  SELECT id, estado, creado_por, descripcion, area_destino, fecha_estimada, numero
    INTO v_ot
  FROM public.orden_trabajo
  WHERE id = p_ot_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OT no encontrada (id: %)', p_ot_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_ot.estado <> 'borrador' THEN
    RAISE EXCEPTION 'Solo se puede enviar una OT en borrador (estado actual: "%")', v_ot.estado
      USING ERRCODE = 'P0002';
  END IF;

  IF v_ot.creado_por <> p_usuario_id AND NOT public.sgtd_es_jefe() THEN
    RAISE EXCEPTION 'Sin permiso para enviar esta OT'
      USING ERRCODE = 'P0003';
  END IF;

  IF btrim(coalesce(v_ot.descripcion, '')) IN ('', '(borrador)') THEN
    RAISE EXCEPTION 'La descripción es obligatoria para enviar'
      USING ERRCODE = 'P0004';
  END IF;

  IF btrim(coalesce(v_ot.area_destino, '')) IN ('', '(pendiente)') THEN
    RAISE EXCEPTION 'El área destino es obligatoria para enviar'
      USING ERRCODE = 'P0005';
  END IF;

  IF v_ot.fecha_estimada IS NULL THEN
    RAISE EXCEPTION 'La fecha estimada es obligatoria para enviar'
      USING ERRCODE = 'P0006';
  END IF;

  IF v_ot.fecha_estimada < CURRENT_DATE THEN
    RAISE EXCEPTION 'La fecha estimada no puede ser anterior a hoy'
      USING ERRCODE = 'P0007';
  END IF;

  -- Número correlativo solo si aún no existe (reenvío idempotente)
  IF v_ot.numero IS NULL OR btrim(v_ot.numero) = '' THEN
    UPDATE public.orden_trabajo
    SET numero = public.generar_numero_ot(),
        updated_at = now()
    WHERE id = p_ot_id;
  END IF;

  UPDATE public.orden_trabajo
  SET estado = 'pendiente',
      updated_at = now()
  WHERE id = p_ot_id;

  INSERT INTO public.log_ot (ot_id, usuario_id, accion, estado_anterior, estado_nuevo)
  VALUES (p_ot_id, p_usuario_id, 'enviada', 'borrador', 'pendiente');
END;
$$;

REVOKE ALL ON FUNCTION public.sgtd_enviar_ot(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_enviar_ot(uuid, uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 6. Aprobar OT: proxy de inicio (fecha_inicio_real al aprobar)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_aprobar_ot(
  p_ot_id      uuid,
  p_usuario_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_estado text;
BEGIN
  IF NOT public.sgtd_es_jefe() THEN
    RAISE EXCEPTION 'Solo el jefe puede aprobar OTs'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT estado INTO v_estado
  FROM public.orden_trabajo
  WHERE id = p_ot_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OT no encontrada (id: %)', p_ot_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_estado <> 'pendiente' THEN
    RAISE EXCEPTION 'Solo se puede aprobar una OT pendiente (estado actual: "%")', v_estado
      USING ERRCODE = 'P0003';
  END IF;

  UPDATE public.orden_trabajo
  SET estado           = 'aprobada',
      aprobado_por     = p_usuario_id,
      fecha_aprobacion = now(),
      fecha_inicio_real = coalesce(fecha_inicio_real, now()),
      updated_at       = now()
  WHERE id = p_ot_id;

  INSERT INTO public.log_ot (ot_id, usuario_id, accion, estado_anterior, estado_nuevo)
  VALUES (p_ot_id, p_usuario_id, 'aprobada', 'pendiente', 'aprobada');
END;
$$;

REVOKE ALL ON FUNCTION public.sgtd_aprobar_ot(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_aprobar_ot(uuid, uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 7. Completar OT desde aprobada (033: sync tarea vinculada)
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
  v_estado       text;
  v_solicitante  uuid;
  v_tarea_id     uuid;
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

  IF v_estado <> 'aprobada' THEN
    RAISE EXCEPTION 'Solo se puede completar una OT aprobada (estado actual: "%")', v_estado
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

  IF btrim(p_receptor_dni) !~ '^[0-9]{8}$' THEN
    RAISE EXCEPTION 'El DNI debe tener exactamente 8 dígitos'
      USING ERRCODE = 'P0006';
  END IF;

  UPDATE public.orden_trabajo
  SET estado               = 'completada',
      fecha_fin_real       = now(),
      receptor_nombre      = btrim(p_receptor_nombre),
      receptor_dni         = btrim(p_receptor_dni),
      receptor_cargo       = nullif(btrim(coalesce(p_receptor_cargo, '')), ''),
      observaciones_cierre = nullif(btrim(coalesce(p_observaciones_cierre, '')), ''),
      updated_at           = now()
  WHERE id = p_ot_id;

  INSERT INTO public.log_ot (ot_id, usuario_id, accion, estado_anterior, estado_nuevo)
  VALUES (p_ot_id, p_usuario_id, 'completada', 'aprobada', 'completada');

  IF v_tarea_id IS NOT NULL THEN
    SELECT estado::text INTO v_estado_tarea
    FROM public.tarea
    WHERE id = v_tarea_id
      AND eliminada_en IS NULL;

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
-- 8. Crear OT borrador desde tarea — sin número hasta enviar
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
  v_tarea  record;
  v_ot_id  uuid;
  v_existe uuid;
BEGIN
  SELECT titulo, descripcion, asignado_a, objetivo_id, fecha_planificada
    INTO v_tarea
  FROM public.tarea
  WHERE id = p_tarea_id
    AND es_imprevisto = false
    AND estado NOT IN ('completada', 'cancelada')
    AND eliminada_en IS NULL
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

  INSERT INTO public.orden_trabajo (
    numero, creado_por, tipo_trabajo_id,
    tarea_id, objetivo_id,
    estado, descripcion,
    area_destino, modalidad,
    fecha_estimada, prioridad
  ) VALUES (
    NULL,
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

-- =============================================================================
-- VERIFICACIÓN
--
-- npx @insforge/cli db query "SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND proname = 'sgtd_enviar_ot') AS migration_036_ok"
--
-- SELECT NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND proname = 'sgtd_iniciar_ejecucion_ot') AS iniciar_dropped;
--
-- SELECT pg_get_functiondef(p.oid) LIKE '%aprobada%'
-- FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public' AND proname = 'sgtd_completar_ot';
-- =============================================================================
