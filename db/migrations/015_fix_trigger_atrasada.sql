-- =============================================================================
-- SGTD — Migración 015
-- Archivo: 015_fix_trigger_atrasada.sql
--
-- Bug crítico: el trigger trg_tarea_marcar_atrasada intercepta el UPDATE
-- de sgtd_cambiar_estado_tarea cuando pone estado='en_progreso' y,
-- como fecha_planificada < CURRENT_DATE, lo sobreescribe de vuelta a 'atrasada'.
--
-- Resultado en BD: el RPC "inicia" la tarea pero el trigger la revierte
-- inmediatamente. La UI ve siempre 'atrasada'.
--
-- Causa:
--   IF NEW.estado IN ('pendiente', 'en_progreso')  ← incluye en_progreso
--
-- Fix:
--   El trigger solo debe degradar a 'atrasada' si el estado nuevo es 'pendiente'.
--   Si el usuario está poniendo explícitamente 'en_progreso', es una acción
--   consciente y el trigger no debe interferir.
--
--   Regla nueva:
--     - pendiente + fecha vencida → atrasada  (comportamiento original)
--     - en_progreso + fecha vencida → respetar en_progreso (no degradar)
--     - reprogramada + fecha vencida → respetar (ya fue reprogramada con intención)
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.sgtd_fn_marcar_atrasada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo degradar a 'atrasada' si el estado nuevo es 'pendiente'.
  -- Estados activos (en_progreso, reprogramada) se respetan aunque la fecha esté vencida.
  IF  NEW.fecha_planificada IS NOT NULL
  AND NEW.fecha_planificada < CURRENT_DATE
  AND NEW.estado = 'pendiente'
  AND NEW.tipo = 'planificada'
  THEN
    NEW.estado := 'atrasada';
  END IF;

  RETURN NEW;
END;
$$;

-- El trigger ya existe, solo se reemplazó la función que llama.
-- Verificar:
-- SELECT tgname FROM pg_trigger WHERE tgname = 'trg_tarea_marcar_atrasada';
-- → 1 fila

COMMIT;