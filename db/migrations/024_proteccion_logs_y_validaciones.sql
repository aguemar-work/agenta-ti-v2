-- =============================================================================
-- SGTD — Migración 024
-- Archivo: 024_proteccion_logs_y_validaciones.sql
--
-- CAMBIO 1: Proteger log_accion y log_ot contra UPDATE y DELETE.
--   Las políticas RLS del jefe incluyen FOR ALL, lo que permite borrar
--   registros de auditoría. Un trigger es la única barrera real porque
--   actúa antes de que RLS apruebe la operación a nivel de fila.
--
-- CAMBIO 2: Validar que fecha_estimada >= CURRENT_DATE al crear una OT.
--   Actualmente solo se valida en el frontend. Un cliente que llame
--   directo a la API puede crear OTs con fecha en el pasado.
--
-- Cómo aplicar: Dashboard InsForge → SQL Editor → pegar y ejecutar.
-- =============================================================================

BEGIN;

-- =============================================================================
-- PARTE 1: Logs inmutables — protección contra UPDATE y DELETE
-- =============================================================================

-- Función compartida que lanza excepción en cualquier intento de modificar
-- o borrar un registro de auditoría. SECURITY DEFINER para que el jefe
-- tampoco pueda saltárselo.
CREATE OR REPLACE FUNCTION public.sgtd_fn_log_inmutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION
    'Los registros de auditoría son inmutables. No se permite UPDATE ni DELETE en %.', TG_TABLE_NAME;
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_fn_log_inmutable() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_fn_log_inmutable() TO authenticated;

-- Trigger en log_accion
DROP TRIGGER IF EXISTS trg_log_accion_inmutable ON public.log_accion;
CREATE TRIGGER trg_log_accion_inmutable
  BEFORE UPDATE OR DELETE ON public.log_accion
  FOR EACH ROW
  EXECUTE FUNCTION public.sgtd_fn_log_inmutable();

-- Trigger en log_ot
DROP TRIGGER IF EXISTS trg_log_ot_inmutable ON public.log_ot;
CREATE TRIGGER trg_log_ot_inmutable
  BEFORE UPDATE OR DELETE ON public.log_ot
  FOR EACH ROW
  EXECUTE FUNCTION public.sgtd_fn_log_inmutable();

-- =============================================================================
-- PARTE 2: Validar fecha_estimada >= hoy al crear o editar una OT
-- =============================================================================

-- Función del trigger
CREATE OR REPLACE FUNCTION public.sgtd_fn_validar_fecha_ot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo valida en INSERT y en UPDATE cuando cambia la fecha
  IF (TG_OP = 'INSERT' OR NEW.fecha_estimada IS DISTINCT FROM OLD.fecha_estimada)
     AND NEW.fecha_estimada < CURRENT_DATE
  THEN
    RAISE EXCEPTION
      'La fecha estimada de la OT no puede ser anterior a hoy (recibido: %).',
      NEW.fecha_estimada;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_fn_validar_fecha_ot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_fn_validar_fecha_ot() TO authenticated;

-- Trigger en orden_trabajo
DROP TRIGGER IF EXISTS trg_ot_validar_fecha ON public.orden_trabajo;
CREATE TRIGGER trg_ot_validar_fecha
  BEFORE INSERT OR UPDATE OF fecha_estimada ON public.orden_trabajo
  FOR EACH ROW
  EXECUTE FUNCTION public.sgtd_fn_validar_fecha_ot();

COMMIT;