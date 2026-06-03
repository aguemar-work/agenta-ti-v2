-- =============================================================================
-- SGTD — RPCs para mover tarea entre días y snap al día actual
-- Migración: 006_rpc_mover_tarea_dia.sql
--
-- Contexto:
--   Las funciones moverTareaADia y snapTareaFechaAlPorHacer en el frontend
--   hacían UPDATE directo sobre la tabla tarea sin validación server-side.
--   Con RLS de miembro (migración 005), el UPDATE solo funciona si
--   asignado_a = auth.uid() — pero la validación era implícita.
--   Estas RPCs la hacen explícita y devuelven error descriptivo si falla.
--
-- RPCs creadas:
--   sgtd_mover_tarea_dia(tarea_id, nueva_fecha, nueva_semana)
--     → Mueve la tarea a un día/semana específicos.
--     → Valida que la tarea pertenece al usuario autenticado.
--
--   sgtd_snap_tarea_hoy(tarea_id, hoy_ymd, hoy_semana)
--     → Reanuda una tarea atrasada en el día actual.
--     → Resetea estado a 'pendiente'.
--     → Valida que la tarea pertenece al usuario autenticado.
--
-- Cómo aplicar:
--   Dashboard InsForge → SQL Editor → Run
--   O: insforge db query --file 006_rpc_mover_tarea_dia.sql
--
-- Prerrequisitos:
--   Migración 005_rls_policies_miembro.sql aplicada.
-- =============================================================================

BEGIN;

-- =============================================================================
-- RPC: sgtd_mover_tarea_dia
-- Mueve una tarea planificada a una nueva fecha y semana ISO.
--
-- Parámetros:
--   p_tarea_id    UUID de la tarea a mover
--   p_fecha       Nueva fecha planificada (YYYY-MM-DD)
--   p_semana      Nueva semana ISO (YYYYWW, ej: '202618')
--
-- Retorna: void
-- Lanza error si:
--   - La tarea no existe o no pertenece al usuario autenticado
--   - La tarea está en estado completada o cancelada (no se puede mover)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sgtd_mover_tarea_dia(
  p_tarea_id UUID,
  p_fecha    TEXT,
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
  -- Verificar que la tarea existe y pertenece al usuario autenticado
  SELECT estado INTO v_estado
  FROM public.tarea
  WHERE id = p_tarea_id
    AND asignado_a = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarea no encontrada o sin permisos (id: %)', p_tarea_id
      USING ERRCODE = 'P0001';
  END IF;

  -- No mover tareas terminadas
  IF v_estado IN ('completada', 'cancelada') THEN
    RAISE EXCEPTION 'No se puede mover una tarea en estado "%"', v_estado
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.tarea
  SET
    fecha_planificada  = p_fecha,
    semana_planificada = p_semana,
    updated_at         = now()
  WHERE id = p_tarea_id;
END;
$$;

REVOKE ALL  ON FUNCTION public.sgtd_mover_tarea_dia(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_mover_tarea_dia(UUID, TEXT, TEXT) TO authenticated;

-- =============================================================================
-- RPC: sgtd_snap_tarea_hoy
-- Reanuda una tarea planificada vencida moviéndola al día actual.
-- Resetea estado a 'pendiente' para sacarla de la columna "atrasada".
--
-- Parámetros:
--   p_tarea_id  UUID de la tarea
--   p_hoy       Fecha de hoy (YYYY-MM-DD)
--   p_semana    Semana ISO de hoy (YYYYWW)
--
-- Retorna: void
-- Lanza error si:
--   - La tarea no existe o no pertenece al usuario autenticado
--   - La tarea no está en estado 'atrasada' o 'pendiente'
--     (no tiene sentido snap en otros estados)
-- =============================================================================

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
  -- Verificar que la tarea existe y pertenece al usuario autenticado
  SELECT estado INTO v_estado
  FROM public.tarea
  WHERE id = p_tarea_id
    AND asignado_a = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarea no encontrada o sin permisos (id: %)', p_tarea_id
      USING ERRCODE = 'P0001';
  END IF;

  -- Solo tiene sentido snap si la tarea está atrasada o pendiente
  IF v_estado NOT IN ('atrasada', 'pendiente', 'reprogramada') THEN
    RAISE EXCEPTION 'No se puede reanudar una tarea en estado "%"', v_estado
      USING ERRCODE = 'P0003';
  END IF;

  UPDATE public.tarea
  SET
    fecha_planificada  = p_hoy,
    semana_planificada = p_semana,
    estado             = 'pendiente',
    updated_at         = now()
  WHERE id = p_tarea_id;
END;
$$;

REVOKE ALL  ON FUNCTION public.sgtd_snap_tarea_hoy(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_snap_tarea_hoy(UUID, TEXT, TEXT) TO authenticated;

-- =============================================================================
-- VERIFICACIÓN — ejecutar después de aplicar:
--
-- SELECT routine_name, routine_type
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name IN ('sgtd_mover_tarea_dia', 'sgtd_snap_tarea_hoy');
--
-- Debe retornar 2 filas de tipo FUNCTION.
-- =============================================================================

COMMIT;