-- =============================================================================
-- SGTD — Migración 032
-- Archivo: 032_notify_tarea_asignada.sql
--
-- Publica evento Realtime `tarea_asignada` al canal `usuario:{asignado_a}`
-- cuando se confirma una asignación (creación o reasignación).
--
-- Cubre:
--   - sgtd_crear_tarea_planificada (jefe → miembro, objetivos, planificación)
--   - sgtd_actualizar_tarea (reasignación de asignado_a)
--
-- No notifica auto-asignación (asignado_a = quien asigna).
-- Frontend: useRealtimeNotificaciones ya escucha `tarea_asignada`.
--
-- Prerrequisitos: 018 (RPCs tarea), 029 (realtime.publish / equipo).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Canal realtime usuario (idempotente)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'realtime' AND table_name = 'channels'
  ) THEN
    INSERT INTO realtime.channels (pattern, description, enabled)
    VALUES ('usuario:%', 'Eventos dirigidos a un usuario (asignaciones, OT)', true)
    ON CONFLICT (pattern) DO UPDATE
      SET enabled = EXCLUDED.enabled,
          description = EXCLUDED.description;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 1. Helper: publicar en canal usuario:{id}
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_publicar_usuario(
  p_usuario_id uuid,
  p_evento     text,
  p_payload    jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_usuario_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM realtime.publish(
    'usuario:' || p_usuario_id::text,
    p_evento,
    p_payload
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sgtd_publicar_usuario(uuid, text, jsonb) FROM PUBLIC;

-- -----------------------------------------------------------------------------
-- 2. Notificar asignación al miembro destino
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_notificar_tarea_asignada(
  p_tarea_id     uuid,
  p_asignado_a   uuid,
  p_titulo       text,
  p_asignado_por uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asignador uuid;
  v_nombre    text;
BEGIN
  v_asignador := COALESCE(p_asignado_por, auth.uid());

  IF p_asignado_a IS NULL OR p_asignado_a = v_asignador THEN
    RETURN;
  END IF;

  SELECT nombre INTO v_nombre
  FROM public.usuario
  WHERE id = v_asignador;

  PERFORM public.sgtd_publicar_usuario(
    p_asignado_a,
    'tarea_asignada',
    jsonb_build_object(
      'tareaId',     p_tarea_id,
      'titulo',      p_titulo,
      'asignadoPor', COALESCE(v_nombre, 'Jefe')
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sgtd_notificar_tarea_asignada(uuid, uuid, text, uuid) FROM PUBLIC;

-- -----------------------------------------------------------------------------
-- 3. sgtd_crear_tarea_planificada — notificar al asignado
-- -----------------------------------------------------------------------------
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

REVOKE ALL    ON FUNCTION public.sgtd_crear_tarea_planificada(TEXT,TEXT,TEXT,TEXT,TEXT,UUID,UUID,UUID,UUID,BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_crear_tarea_planificada(TEXT,TEXT,TEXT,TEXT,TEXT,UUID,UUID,UUID,UUID,BOOLEAN) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. sgtd_actualizar_tarea — notificar en reasignación
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_actualizar_tarea(
  p_tarea_id    UUID,
  p_usuario_id  UUID,
  p_titulo      TEXT,
  p_prioridad   TEXT,
  p_descripcion TEXT DEFAULT NULL,
  p_objetivo_id UUID DEFAULT NULL,
  p_asignado_a  UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_asignado_actual UUID;
  v_asignado_nuevo  UUID;
BEGIN
  SELECT asignado_a
    INTO v_asignado_actual
  FROM public.tarea
  WHERE id = p_tarea_id
    AND (asignado_a = auth.uid() OR public.sgtd_es_jefe());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarea no encontrada o sin permisos (id: %)', p_tarea_id
      USING ERRCODE = 'P0001';
  END IF;

  IF p_titulo IS NULL OR length(trim(p_titulo)) = 0 THEN
    RAISE EXCEPTION 'El título es obligatorio' USING ERRCODE = 'P0002';
  END IF;

  v_asignado_nuevo := COALESCE(p_asignado_a, v_asignado_actual);

  UPDATE public.tarea
  SET
    titulo       = trim(p_titulo),
    prioridad    = p_prioridad::public.prioridad_tarea,
    descripcion  = nullif(trim(coalesce(p_descripcion, '')), ''),
    objetivo_id  = p_objetivo_id,
    asignado_a   = v_asignado_nuevo,
    updated_at   = now()
  WHERE id = p_tarea_id;

  INSERT INTO public.log_accion (
    tarea_id, usuario_id, tipo_accion,
    valor_anterior, valor_nuevo, justificacion, leido_por_jefe
  ) VALUES (
    p_tarea_id, auth.uid(), 'editada',
    NULL,
    jsonb_build_object('titulo', p_titulo, 'prioridad', p_prioridad),
    NULL, false
  );

  IF v_asignado_nuevo IS DISTINCT FROM v_asignado_actual THEN
    PERFORM public.sgtd_notificar_tarea_asignada(
      p_tarea_id,
      v_asignado_nuevo,
      trim(p_titulo),
      auth.uid()
    );
  END IF;
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_actualizar_tarea(UUID, UUID, TEXT, TEXT, TEXT, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_actualizar_tarea(UUID, UUID, TEXT, TEXT, TEXT, UUID, UUID) TO authenticated;

COMMIT;

-- -----------------------------------------------------------------------------
-- Verificación post-aplicar:
--
-- SELECT EXISTS (
--   SELECT 1 FROM pg_proc p
--   JOIN pg_namespace n ON p.pronamespace = n.oid
--   WHERE n.nspname = 'public' AND proname = 'sgtd_notificar_tarea_asignada'
-- ) AS migration_032_ok;
--
-- SELECT pg_get_functiondef(p.oid) LIKE '%sgtd_notificar_tarea_asignada%'
-- FROM pg_proc p
-- JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public' AND proname = 'sgtd_crear_tarea_planificada';
-- Esperado: true
