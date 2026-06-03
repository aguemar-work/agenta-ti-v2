-- =============================================================================
-- SGTD — Migración 010
-- Archivo: 010_mejoras_orden_trabajo.sql
--
-- Cambios en orden_trabajo:
--   1. Campo prioridad: 'normal' | 'urgente' (default normal)
--   2. Campo objetivo_id: vinculación opcional a objetivo
--   3. Tabla log_ot: auditoría completa de todas las transiciones de OT
--   4. RPC sgtd_crear_ot_desde_incidencia: atajo para generar OT desde incidencia
--   5. RLS en log_ot: jefe acceso total, miembro solo sus OTs
--   6. Índices nuevos
--
-- Prerrequisito: migración 009 aplicada.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. AGREGAR prioridad A orden_trabajo
-- -----------------------------------------------------------------------------

ALTER TABLE public.orden_trabajo
  ADD COLUMN IF NOT EXISTS prioridad text NOT NULL DEFAULT 'normal'
  CHECK (prioridad IN ('normal', 'urgente'));

CREATE INDEX IF NOT EXISTS idx_orden_trabajo_prioridad
  ON public.orden_trabajo (prioridad);

-- -----------------------------------------------------------------------------
-- 2. AGREGAR objetivo_id A orden_trabajo
--    Vinculación opcional: permite al jefe ver qué OTs se generaron
--    para cumplir un objetivo específico.
-- -----------------------------------------------------------------------------

ALTER TABLE public.orden_trabajo
  ADD COLUMN IF NOT EXISTS objetivo_id uuid
  REFERENCES public.objetivo (id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orden_trabajo_objetivo_id
  ON public.orden_trabajo (objetivo_id);

-- -----------------------------------------------------------------------------
-- 3. TABLA log_ot
--    Auditoría de todas las transiciones de estado de una OT.
--    Inmutable: no UPDATE ni DELETE permitidos por RLS.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.log_ot (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ot_id        uuid        NOT NULL REFERENCES public.orden_trabajo (id) ON DELETE CASCADE,
  usuario_id   uuid        NOT NULL REFERENCES public.usuario (id),
  accion       text        NOT NULL CHECK (accion IN (
    'creada', 'enviada', 'aprobada', 'rechazada',
    'iniciada', 'completada', 'cancelada', 'editada'
  )),
  estado_anterior text,
  estado_nuevo    text,
  motivo          text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_log_ot_ot_id
  ON public.log_ot (ot_id);

CREATE INDEX IF NOT EXISTS idx_log_ot_usuario_id
  ON public.log_ot (usuario_id);

-- RLS en log_ot
ALTER TABLE public.log_ot ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sgtd_jefe_log_ot_all ON public.log_ot;
CREATE POLICY sgtd_jefe_log_ot_all ON public.log_ot
  FOR ALL TO authenticated
  USING (public.sgtd_es_jefe())
  WITH CHECK (public.sgtd_es_jefe());

DROP POLICY IF EXISTS sgtd_miembro_log_ot_select ON public.log_ot;
CREATE POLICY sgtd_miembro_log_ot_select ON public.log_ot
  FOR SELECT TO authenticated
  USING (
    public.sgtd_es_miembro_activo()
    AND ot_id IN (
      SELECT id FROM public.orden_trabajo WHERE creado_por = auth.uid()
    )
  );

DROP POLICY IF EXISTS sgtd_miembro_log_ot_insert ON public.log_ot;
CREATE POLICY sgtd_miembro_log_ot_insert ON public.log_ot
  FOR INSERT TO authenticated
  WITH CHECK (
    public.sgtd_es_miembro_activo()
    AND usuario_id = auth.uid()
  );

-- -----------------------------------------------------------------------------
-- 4. ACTUALIZAR RPCs de OT para escribir en log_ot
--    Se reescriben sgtd_aprobar_ot, sgtd_rechazar_ot, sgtd_completar_ot,
--    sgtd_cancelar_ot y sgtd_iniciar_ejecucion_ot para que todas registren
--    en log_ot de forma atómica.
-- -----------------------------------------------------------------------------

-- 4a. sgtd_aprobar_ot
CREATE OR REPLACE FUNCTION public.sgtd_aprobar_ot(
  p_ot_id      UUID,
  p_usuario_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_estado TEXT;
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
      updated_at       = now()
  WHERE id = p_ot_id;

  INSERT INTO public.log_ot (ot_id, usuario_id, accion, estado_anterior, estado_nuevo)
  VALUES (p_ot_id, p_usuario_id, 'aprobada', 'pendiente', 'aprobada');
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_aprobar_ot(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_aprobar_ot(UUID, UUID) TO authenticated;

-- 4b. sgtd_rechazar_ot
CREATE OR REPLACE FUNCTION public.sgtd_rechazar_ot(
  p_ot_id       UUID,
  p_usuario_id  UUID,
  p_motivo      TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_estado TEXT;
BEGIN
  IF NOT public.sgtd_es_jefe() THEN
    RAISE EXCEPTION 'Solo el jefe puede rechazar OTs'
      USING ERRCODE = 'P0001';
  END IF;

  IF length(trim(p_motivo)) < 10 THEN
    RAISE EXCEPTION 'El motivo de rechazo debe tener al menos 10 caracteres'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT estado INTO v_estado
  FROM public.orden_trabajo WHERE id = p_ot_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OT no encontrada (id: %)', p_ot_id
      USING ERRCODE = 'P0003';
  END IF;

  IF v_estado <> 'pendiente' THEN
    RAISE EXCEPTION 'Solo se puede rechazar una OT pendiente (estado actual: "%")', v_estado
      USING ERRCODE = 'P0004';
  END IF;

  UPDATE public.orden_trabajo
  SET estado         = 'rechazada',
      motivo_rechazo = trim(p_motivo),
      updated_at     = now()
  WHERE id = p_ot_id;

  INSERT INTO public.log_ot (ot_id, usuario_id, accion, estado_anterior, estado_nuevo, motivo)
  VALUES (p_ot_id, p_usuario_id, 'rechazada', 'pendiente', 'rechazada', trim(p_motivo));
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_rechazar_ot(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_rechazar_ot(UUID, UUID, TEXT) TO authenticated;

-- 4c. sgtd_iniciar_ejecucion_ot (reemplaza versión de migración 007)
CREATE OR REPLACE FUNCTION public.sgtd_iniciar_ejecucion_ot(
  p_ot_id      UUID,
  p_usuario_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_estado      TEXT;
  v_solicitante UUID;
BEGIN
  SELECT estado, creado_por INTO v_estado, v_solicitante
  FROM public.orden_trabajo WHERE id = p_ot_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OT no encontrada (id: %)', p_ot_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_estado <> 'aprobada' THEN
    RAISE EXCEPTION 'Solo se puede iniciar ejecución de OTs aprobadas (estado actual: "%")', v_estado
      USING ERRCODE = 'P0002';
  END IF;

  IF v_solicitante <> p_usuario_id AND NOT public.sgtd_es_jefe() THEN
    RAISE EXCEPTION 'Sin permiso para iniciar esta OT'
      USING ERRCODE = 'P0003';
  END IF;

  UPDATE public.orden_trabajo
  SET estado            = 'en_ejecucion',
      fecha_inicio_real = now(),
      updated_at        = now()
  WHERE id = p_ot_id;

  INSERT INTO public.log_ot (ot_id, usuario_id, accion, estado_anterior, estado_nuevo)
  VALUES (p_ot_id, p_usuario_id, 'iniciada', 'aprobada', 'en_ejecucion');
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_iniciar_ejecucion_ot(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_iniciar_ejecucion_ot(UUID, UUID) TO authenticated;

-- 4d. sgtd_completar_ot
CREATE OR REPLACE FUNCTION public.sgtd_completar_ot(
  p_ot_id               UUID,
  p_usuario_id          UUID,
  p_receptor_nombre     TEXT,
  p_receptor_dni        TEXT,
  p_receptor_cargo      TEXT,
  p_observaciones_cierre TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_estado      TEXT;
  v_solicitante UUID;
BEGIN
  SELECT estado, creado_por INTO v_estado, v_solicitante
  FROM public.orden_trabajo WHERE id = p_ot_id;

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

  IF trim(p_receptor_nombre) = '' THEN
    RAISE EXCEPTION 'El nombre del receptor es obligatorio'
      USING ERRCODE = 'P0004';
  END IF;

  UPDATE public.orden_trabajo
  SET estado                = 'completada',
      fecha_fin_real        = now(),
      receptor_nombre       = trim(p_receptor_nombre),
      receptor_dni          = nullif(trim(p_receptor_dni), ''),
      receptor_cargo        = nullif(trim(p_receptor_cargo), ''),
      observaciones_cierre  = nullif(trim(coalesce(p_observaciones_cierre, '')), ''),
      updated_at            = now()
  WHERE id = p_ot_id;

  INSERT INTO public.log_ot (ot_id, usuario_id, accion, estado_anterior, estado_nuevo)
  VALUES (p_ot_id, p_usuario_id, 'completada', 'en_ejecucion', 'completada');
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_completar_ot(UUID,UUID,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_completar_ot(UUID,UUID,TEXT,TEXT,TEXT,TEXT) TO authenticated;

-- 4e. sgtd_cancelar_ot (reemplaza versión de migración 007, ahora con log_ot)
CREATE OR REPLACE FUNCTION public.sgtd_cancelar_ot(
  p_ot_id      UUID,
  p_usuario_id UUID,
  p_motivo     TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_estado      TEXT;
  v_solicitante UUID;
BEGIN
  SELECT estado, creado_por INTO v_estado, v_solicitante
  FROM public.orden_trabajo WHERE id = p_ot_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OT no encontrada (id: %)', p_ot_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_estado IN ('cancelada', 'completada') THEN
    RAISE EXCEPTION 'No se puede cancelar una OT en estado "%"', v_estado
      USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.sgtd_es_jefe() THEN
    IF v_solicitante <> p_usuario_id THEN
      RAISE EXCEPTION 'Sin permiso para cancelar esta OT'
        USING ERRCODE = 'P0003';
    END IF;
    IF v_estado NOT IN ('borrador', 'pendiente') THEN
      RAISE EXCEPTION 'El miembro solo puede cancelar OTs en borrador o pendientes'
        USING ERRCODE = 'P0004';
    END IF;
  END IF;

  UPDATE public.orden_trabajo
  SET estado     = 'cancelada',
      updated_at = now()
  WHERE id = p_ot_id;

  INSERT INTO public.log_ot (ot_id, usuario_id, accion, estado_anterior, estado_nuevo, motivo)
  VALUES (p_ot_id, p_usuario_id, 'cancelada', v_estado, 'cancelada',
          nullif(trim(coalesce(p_motivo, '')), ''));
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_cancelar_ot(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_cancelar_ot(UUID, UUID, TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. RPC sgtd_crear_ot_desde_incidencia
--    Crea una OT pre-rellenada desde una incidencia abierta.
--    Atajo operativo: el técnico no tiene que copiar datos manualmente.
--
--    Parámetros:
--      p_incidencia_id UUID de la tarea (es_imprevisto=true, pendiente)
--      p_tipo_trabajo_id UUID del tipo de trabajo (opcional)
--      p_fecha_estimada  Fecha estimada de resolución (YYYY-MM-DD)
--      p_prioridad       'normal' | 'urgente'
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sgtd_crear_ot_desde_incidencia(
  p_incidencia_id   UUID,
  p_tipo_trabajo_id UUID    DEFAULT NULL,
  p_fecha_estimada  TEXT    DEFAULT NULL,
  p_prioridad       TEXT    DEFAULT 'normal'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_inc       RECORD;
  v_numero    TEXT;
  v_ot_id     UUID;
BEGIN
  -- Leer la incidencia
  SELECT titulo, descripcion, asignado_a, objetivo_id
    INTO v_inc
  FROM public.tarea
  WHERE id = p_incidencia_id
    AND es_imprevisto = true
    AND estado NOT IN ('completada', 'cancelada')
    AND (asignado_a = auth.uid() OR public.sgtd_es_jefe());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Incidencia no encontrada, ya cerrada, o sin permisos'
      USING ERRCODE = 'P0001';
  END IF;

  -- Generar número correlativo (reutiliza función existente)
  SELECT public.generar_numero_ot() INTO v_numero;

  -- Crear la OT
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
    p_incidencia_id,
    v_inc.objetivo_id,
    'borrador',
    coalesce(v_inc.descripcion, v_inc.titulo),
    'Por definir',
    'presencial',
    coalesce(p_fecha_estimada, CURRENT_DATE::text),
    p_prioridad
  )
  RETURNING id INTO v_ot_id;

  INSERT INTO public.log_ot (ot_id, usuario_id, accion, estado_anterior, estado_nuevo)
  VALUES (v_ot_id, auth.uid(), 'creada', NULL, 'borrador');

  RETURN v_ot_id;
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_crear_ot_desde_incidencia(UUID, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_crear_ot_desde_incidencia(UUID, UUID, TEXT, TEXT) TO authenticated;

-- =============================================================================
-- VERIFICACIÓN
--
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'orden_trabajo'
--   AND column_name IN ('prioridad', 'objetivo_id');
-- → 2 filas
--
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name = 'log_ot';
-- → 1 fila
--
-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name LIKE 'sgtd_%ot%';
-- → Debe incluir todas las RPCs de OT
-- =============================================================================

COMMIT;