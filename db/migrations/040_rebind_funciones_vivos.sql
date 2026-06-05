-- Fragmento de la 040 — NO ejecutar solo.
-- Re-crea RPCs que referencian ::public.estado_tarea / ::public.tipo_tarea
-- tras el ALTER COLUMN y ANTES de DROP TYPE *_old.

-- sgtd_cambiar_estado_tarea (039)
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

-- sgtd_crear_tarea_planificada (032)
CREATE OR REPLACE FUNCTION public.sgtd_crear_tarea_planificada(
  p_titulo             TEXT,
  p_descripcion        TEXT DEFAULT NULL,
  p_prioridad          TEXT DEFAULT 'media',
  p_fecha_planificada  TEXT DEFAULT NULL,
  p_semana_planificada TEXT DEFAULT NULL,
  p_asignado_a         UUID DEFAULT NULL,
  p_creado_por         UUID DEFAULT NULL,
  p_objetivo_id        UUID DEFAULT NULL,
  p_nota_origen_id     UUID DEFAULT NULL,
  p_es_imprevisto      BOOLEAN DEFAULT FALSE
)
RETURNS SETOF public.tarea
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_asignado  UUID;
  v_creador   UUID;
  v_tarea_id  UUID;
BEGIN
  v_asignado := COALESCE(p_asignado_a, auth.uid());
  v_creador  := COALESCE(p_creado_por, auth.uid());

  IF p_titulo IS NULL OR length(trim(p_titulo)) = 0 THEN
    RAISE EXCEPTION 'El título es obligatorio' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.tarea (
    titulo, descripcion,
    estado, tipo, prioridad,
    fecha_planificada, semana_planificada,
    asignado_a, creado_por,
    objetivo_id, nota_origen_id,
    es_imprevisto
  ) VALUES (
    trim(p_titulo),
    nullif(trim(coalesce(p_descripcion, '')), ''),
    'pendiente'::public.estado_tarea,
    'planificada'::public.tipo_tarea,
    p_prioridad::public.prioridad_tarea,
    p_fecha_planificada::DATE,
    p_semana_planificada,
    v_asignado,
    v_creador,
    p_objetivo_id,
    p_nota_origen_id,
    p_es_imprevisto
  )
  RETURNING id INTO v_tarea_id;

  INSERT INTO public.log_accion (
    tarea_id, usuario_id, tipo_accion,
    valor_anterior, valor_nuevo, justificacion, leido_por_jefe
  ) VALUES (
    v_tarea_id, auth.uid(), 'creada',
    NULL,
    jsonb_build_object('tipo', 'planificada', 'estado', 'pendiente'),
    NULL, false
  );

  PERFORM public.sgtd_notificar_tarea_asignada(
    v_tarea_id,
    v_asignado,
    trim(p_titulo),
    v_creador
  );

  RETURN QUERY SELECT * FROM public.tarea WHERE id = v_tarea_id;
END;
$$;

-- sgtd_crear_incidencia (017 + cast tipo)
CREATE OR REPLACE FUNCTION public.sgtd_crear_incidencia(
  p_titulo       TEXT,
  p_descripcion  TEXT,
  p_prioridad    TEXT,
  p_fecha        TEXT,
  p_semana       TEXT,
  p_ya_resuelta  BOOLEAN,
  p_asignado_a   UUID DEFAULT NULL,
  p_objetivo_id  UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_asignado UUID;
  v_estado   TEXT;
  v_tarea_id UUID;
BEGIN
  v_asignado := COALESCE(p_asignado_a, auth.uid());
  v_estado   := CASE WHEN p_ya_resuelta THEN 'completada' ELSE 'pendiente' END;

  INSERT INTO public.tarea (
    titulo, descripcion, estado, tipo, prioridad,
    fecha_planificada, semana_planificada,
    fecha_completada,
    asignado_a, creado_por,
    es_imprevisto, objetivo_id
  ) VALUES (
    trim(p_titulo),
    nullif(trim(coalesce(p_descripcion, '')), ''),
    v_estado::public.estado_tarea,
    'no_planificada'::public.tipo_tarea,
    p_prioridad::public.prioridad_tarea,
    p_fecha::DATE,
    p_semana,
    CASE WHEN p_ya_resuelta THEN now() ELSE NULL END,
    v_asignado,
    auth.uid(),
    true,
    p_objetivo_id
  )
  RETURNING id INTO v_tarea_id;

  INSERT INTO public.log_accion (
    tarea_id, usuario_id, tipo_accion,
    valor_anterior, valor_nuevo,
    justificacion, leido_por_jefe
  ) VALUES (
    v_tarea_id, auth.uid(), 'creada',
    NULL,
    jsonb_build_object('tipo', 'no_planificada', 'estado', v_estado, 'es_imprevisto', true),
    NULL, false
  );

  RETURN v_tarea_id;
END;
$$;

-- sgtd_completar_tarea_con_resumen (033)
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

-- sgtd_convertir_nota_en_tarea (017 + cast tipo)
CREATE OR REPLACE FUNCTION public.sgtd_convertir_nota_en_tarea(
  p_nota_id           UUID,
  p_titulo            TEXT,
  p_descripcion       TEXT,
  p_prioridad         TEXT,
  p_fecha_planificada TEXT,
  p_semana            TEXT,
  p_asignado_a        UUID,
  p_creado_por        UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_convertida TEXT;
  v_tarea_id   UUID;
BEGIN
  SELECT convertida_en INTO v_convertida
  FROM public.nota_bitacora
  WHERE id = p_nota_id
    AND usuario_id = p_creado_por;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nota no encontrada o sin permiso (id: %)', p_nota_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_convertida IS NOT NULL THEN
    RAISE EXCEPTION 'La nota ya fue convertida en "%"', v_convertida
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.tarea (
    titulo, descripcion, estado, tipo, prioridad,
    fecha_planificada, semana_planificada,
    asignado_a, creado_por, es_imprevisto,
    nota_origen_id
  ) VALUES (
    trim(p_titulo),
    nullif(trim(p_descripcion), ''),
    'pendiente'::public.estado_tarea,
    'planificada'::public.tipo_tarea,
    p_prioridad::public.prioridad_tarea,
    p_fecha_planificada::DATE,
    p_semana,
    p_asignado_a,
    p_creado_por,
    false,
    p_nota_id
  )
  RETURNING id INTO v_tarea_id;

  UPDATE public.nota_bitacora
  SET convertida_en = 'tarea', updated_at = now()
  WHERE id = p_nota_id;

  RETURN v_tarea_id;
END;
$$;

-- sgtd_snap_tarea_hoy — sin estado 'atrasada' (v1.1)
CREATE OR REPLACE FUNCTION public.sgtd_snap_tarea_hoy(
  p_tarea_id UUID,
  p_hoy      TEXT,
  p_semana   TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_estado public.tarea.estado%TYPE;
BEGIN
  SELECT estado INTO v_estado
  FROM public.tarea
  WHERE id = p_tarea_id
    AND (asignado_a = auth.uid() OR public.sgtd_es_jefe());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarea no encontrada o sin permisos (id: %)', p_tarea_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_estado::TEXT <> 'pendiente' THEN
    RAISE EXCEPTION 'Solo se puede mover a hoy una tarea pendiente (estado actual: "%")', v_estado
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.tarea
  SET
    fecha_planificada  = p_hoy::DATE,
    semana_planificada = p_semana,
    updated_at         = now()
  WHERE id = p_tarea_id;
END;
$$;

-- sgtd_completar_ot (036)
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
