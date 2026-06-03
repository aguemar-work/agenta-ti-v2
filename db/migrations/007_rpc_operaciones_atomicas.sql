-- =============================================================================
-- SGTD — RPCs atómicas para operaciones multi-tabla
-- Migración: 007_rpc_operaciones_atomicas.sql
--
-- Problema:
--   Varias operaciones del frontend hacen múltiples escrituras a la BD en
--   secuencia sin transacción. Si falla el segundo paso, el primero ya se
--   ejecutó y la BD queda en estado inconsistente.
--
-- Operaciones corregidas:
--   1. sgtd_eliminar_objetivo       → INSERT log_accion + DELETE objetivo (atómico)
--   2. sgtd_cancelar_ot             → validar transición + UPDATE orden_trabajo (con log)
--   3. sgtd_iniciar_ejecucion_ot    → validar transición + UPDATE orden_trabajo
--   4. sgtd_convertir_nota_en_tarea → INSERT tarea + UPDATE nota_bitacora (atómico)
--   5. sgtd_convertir_nota_en_evento → INSERT evento + UPDATE nota_bitacora (atómico)
--
-- Prerrequisitos:
--   Migraciones 005 y 006 aplicadas.
--
-- Cómo aplicar:
--   Dashboard InsForge → SQL Editor → Run
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. sgtd_eliminar_objetivo
-- Registra log de auditoría y elimina el objetivo en la misma transacción.
-- Si falla cualquier paso, ambos se revierten.
--
-- Solo el creador del objetivo o el jefe pueden eliminarlo.
-- Valida que el motivo tenga al menos 10 caracteres.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sgtd_eliminar_objetivo(
  p_objetivo_id  UUID,
  p_usuario_id   UUID,
  p_motivo       TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_creado_por UUID;
BEGIN
  -- Validar longitud mínima del motivo
  IF length(trim(p_motivo)) < 10 THEN
    RAISE EXCEPTION 'El motivo debe tener al menos 10 caracteres'
      USING ERRCODE = 'P0001';
  END IF;

  -- Verificar que el objetivo existe y que el usuario tiene permiso
  SELECT creado_por INTO v_creado_por
  FROM public.objetivo
  WHERE id = p_objetivo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Objetivo no encontrado (id: %)', p_objetivo_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Solo el creador o el jefe pueden eliminar
  IF v_creado_por <> p_usuario_id AND NOT public.sgtd_es_jefe() THEN
    RAISE EXCEPTION 'Sin permiso para eliminar este objetivo'
      USING ERRCODE = 'P0003';
  END IF;

  -- Registrar en log_accion (dentro de la misma transacción)
  INSERT INTO public.log_accion (
    tarea_id, usuario_id, tipo_accion,
    valor_anterior, valor_nuevo, justificacion, leido_por_jefe
  ) VALUES (
    NULL, p_usuario_id, 'eliminada',
    jsonb_build_object('objetivo_id', p_objetivo_id),
    NULL, trim(p_motivo), false
  );

  -- Eliminar el objetivo
  DELETE FROM public.objetivo WHERE id = p_objetivo_id;
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_eliminar_objetivo(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_eliminar_objetivo(UUID, UUID, TEXT) TO authenticated;

-- =============================================================================
-- 2. sgtd_cancelar_ot
-- Valida la transición de estado y cancela la OT.
-- Transiciones permitidas: borrador → cancelada, pendiente → cancelada.
-- El solicitante puede cancelar si está en borrador/pendiente.
-- El jefe puede cancelar en cualquier estado no terminal.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sgtd_cancelar_ot(
  p_ot_id      UUID,
  p_usuario_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_estado       TEXT;
  v_solicitante  UUID;
BEGIN
  SELECT estado, solicitante_id INTO v_estado, v_solicitante
  FROM public.orden_trabajo
  WHERE id = p_ot_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden de trabajo no encontrada (id: %)', p_ot_id
      USING ERRCODE = 'P0001';
  END IF;

  -- No se puede cancelar un estado terminal
  IF v_estado IN ('cancelada', 'completada') THEN
    RAISE EXCEPTION 'No se puede cancelar una OT en estado "%"', v_estado
      USING ERRCODE = 'P0002';
  END IF;

  -- Solo el solicitante (si borrador/pendiente) o el jefe pueden cancelar
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
  SET estado      = 'cancelada',
      updated_at  = now()
  WHERE id = p_ot_id;
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_cancelar_ot(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_cancelar_ot(UUID, UUID) TO authenticated;

-- =============================================================================
-- 3. sgtd_iniciar_ejecucion_ot
-- Valida que la OT está aprobada antes de iniciar ejecución.
-- Solo el solicitante asignado puede iniciar.
-- =============================================================================

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
  SELECT estado, solicitante_id INTO v_estado, v_solicitante
  FROM public.orden_trabajo
  WHERE id = p_ot_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden de trabajo no encontrada (id: %)', p_ot_id
      USING ERRCODE = 'P0001';
  END IF;

  -- Solo se puede iniciar desde estado 'aprobada'
  IF v_estado <> 'aprobada' THEN
    RAISE EXCEPTION 'Solo se puede iniciar ejecución de OTs aprobadas (estado actual: "%")', v_estado
      USING ERRCODE = 'P0002';
  END IF;

  -- Solo el solicitante o el jefe pueden iniciar
  IF v_solicitante <> p_usuario_id AND NOT public.sgtd_es_jefe() THEN
    RAISE EXCEPTION 'Sin permiso para iniciar esta OT'
      USING ERRCODE = 'P0003';
  END IF;

  UPDATE public.orden_trabajo
  SET estado            = 'en_ejecucion',
      fecha_inicio_real = now(),
      updated_at        = now()
  WHERE id = p_ot_id;
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_iniciar_ejecucion_ot(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_iniciar_ejecucion_ot(UUID, UUID) TO authenticated;

-- =============================================================================
-- 4. sgtd_convertir_nota_en_tarea
-- Crea la tarea planificada y marca la nota como convertida en la misma
-- transacción. Si falla cualquier paso, ambos se revierten.
-- Previene conversiones duplicadas validando convertida_en IS NULL.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sgtd_convertir_nota_en_tarea(
  p_nota_id          UUID,
  p_titulo           TEXT,
  p_descripcion      TEXT,
  p_prioridad        TEXT,   -- 'alta' | 'media' | 'baja'
  p_fecha_planificada TEXT,  -- YYYY-MM-DD
  p_semana           TEXT,   -- YYYYWW
  p_asignado_a       UUID,
  p_creado_por       UUID
)
RETURNS UUID   -- retorna el id de la tarea creada
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_convertida TEXT;
  v_tarea_id   UUID;
BEGIN
  -- Verificar que la nota existe y pertenece al usuario
  SELECT convertida_en INTO v_convertida
  FROM public.nota_bitacora
  WHERE id = p_nota_id
    AND usuario_id = p_creado_por;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nota no encontrada o sin permiso (id: %)', p_nota_id
      USING ERRCODE = 'P0001';
  END IF;

  -- Prevenir doble conversión
  IF v_convertida IS NOT NULL THEN
    RAISE EXCEPTION 'La nota ya fue convertida en "%"', v_convertida
      USING ERRCODE = 'P0002';
  END IF;

  -- Crear la tarea
  INSERT INTO public.tarea (
    titulo, descripcion, estado, tipo, prioridad,
    fecha_planificada, semana_planificada,
    asignado_a, creado_por, es_imprevisto
  ) VALUES (
    trim(p_titulo), nullif(trim(p_descripcion), ''),
    'pendiente', 'planificada', p_prioridad::public.prioridad_tarea,
    p_fecha_planificada, p_semana,
    p_asignado_a, p_creado_por, false
  )
  RETURNING id INTO v_tarea_id;

  -- Marcar la nota como convertida
  UPDATE public.nota_bitacora
  SET convertida_en = 'tarea',
      updated_at    = now()
  WHERE id = p_nota_id;

  RETURN v_tarea_id;
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_convertir_nota_en_tarea(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_convertir_nota_en_tarea(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID) TO authenticated;

-- =============================================================================
-- 5. sgtd_convertir_nota_en_evento
-- Crea el evento y marca la nota como convertida en la misma transacción.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sgtd_convertir_nota_en_evento(
  p_nota_id    UUID,
  p_titulo     TEXT,
  p_tipo       TEXT,   -- 'reunion' | 'entrega' | 'personal' | 'otro'
  p_fecha_inicio TIMESTAMPTZ,
  p_fecha_fin    TIMESTAMPTZ,
  p_usuario_id UUID,
  p_es_recurrente BOOLEAN DEFAULT false
)
RETURNS UUID   -- retorna el id del evento creado
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_convertida TEXT;
  v_evento_id  UUID;
BEGIN
  -- Verificar nota
  SELECT convertida_en INTO v_convertida
  FROM public.nota_bitacora
  WHERE id = p_nota_id
    AND usuario_id = p_usuario_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nota no encontrada o sin permiso (id: %)', p_nota_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_convertida IS NOT NULL THEN
    RAISE EXCEPTION 'La nota ya fue convertida en "%"', v_convertida
      USING ERRCODE = 'P0002';
  END IF;

  -- Validar que fecha_fin > fecha_inicio
  IF p_fecha_fin <= p_fecha_inicio THEN
    RAISE EXCEPTION 'La fecha de fin debe ser posterior a la fecha de inicio'
      USING ERRCODE = 'P0003';
  END IF;

  -- Crear el evento
  INSERT INTO public.evento (
    titulo, tipo, fecha_inicio, fecha_fin,
    usuario_id, es_recurrente
  ) VALUES (
    trim(p_titulo), p_tipo::public.tipo_evento,
    p_fecha_inicio, p_fecha_fin,
    p_usuario_id, p_es_recurrente
  )
  RETURNING id INTO v_evento_id;

  -- Marcar la nota como convertida
  UPDATE public.nota_bitacora
  SET convertida_en = 'evento',
      updated_at    = now()
  WHERE id = p_nota_id;

  RETURN v_evento_id;
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_convertir_nota_en_evento(UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_convertir_nota_en_evento(UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, UUID, BOOLEAN) TO authenticated;

-- =============================================================================
-- VERIFICACIÓN:
--
-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name IN (
--     'sgtd_eliminar_objetivo',
--     'sgtd_cancelar_ot',
--     'sgtd_iniciar_ejecucion_ot',
--     'sgtd_convertir_nota_en_tarea',
--     'sgtd_convertir_nota_en_evento'
--   );
-- Debe retornar 5 filas.
-- =============================================================================

COMMIT;