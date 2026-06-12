-- =============================================================================
-- PASO 7 — TRIGGERS + VISTA tarea_activa
-- =============================================================================

-- Trigger: proyecto.cliente_id debe pertenecer al mismo workspace
CREATE OR REPLACE FUNCTION public.proyecto_cliente_integridad()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.cliente_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.cliente WHERE id = NEW.cliente_id AND workspace_id = NEW.workspace_id) THEN
      RAISE EXCEPTION 'cliente_id no pertenece al workspace del proyecto.';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS proyecto_cliente_integridad_trigger ON public.proyecto;
CREATE TRIGGER proyecto_cliente_integridad_trigger
  BEFORE INSERT OR UPDATE ON public.proyecto
  FOR EACH ROW EXECUTE FUNCTION public.proyecto_cliente_integridad();

-- Trigger: integridad agencia en tarea
CREATE OR REPLACE FUNCTION public.tarea_agencia_integridad()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tipo text;
BEGIN
  SELECT tipo INTO v_tipo FROM public.workspace WHERE id = NEW.workspace_id;

  IF v_tipo = 'interno' THEN
    IF NEW.cliente_id IS NOT NULL OR NEW.proyecto_id IS NOT NULL OR NEW.area_id IS NOT NULL THEN
      RAISE EXCEPTION 'Workspace interno: cliente_id, proyecto_id y area_id deben ser NULL.';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.cliente_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cliente WHERE id = NEW.cliente_id AND workspace_id = NEW.workspace_id
  ) THEN RAISE EXCEPTION 'cliente_id no pertenece al workspace de la tarea.'; END IF;

  IF NEW.proyecto_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.proyecto WHERE id = NEW.proyecto_id AND workspace_id = NEW.workspace_id
  ) THEN RAISE EXCEPTION 'proyecto_id no pertenece al workspace de la tarea.'; END IF;

  IF NEW.area_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.area WHERE id = NEW.area_id AND workspace_id = NEW.workspace_id
  ) THEN RAISE EXCEPTION 'area_id no pertenece al workspace de la tarea.'; END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS tarea_agencia_integridad_trigger ON public.tarea;
CREATE TRIGGER tarea_agencia_integridad_trigger
  BEFORE INSERT OR UPDATE ON public.tarea
  FOR EACH ROW EXECUTE FUNCTION public.tarea_agencia_integridad();

-- Vista tarea_activa — recrear con workspace_id, cliente_id, proyecto_id, area_id
-- Fix 040 preservado: fecha_planificada IS NOT NULL antes de evaluar atrasada
DROP VIEW IF EXISTS public.tarea_activa;

CREATE VIEW public.tarea_activa
WITH (security_invoker = true) AS
SELECT t.*,
  CASE
    WHEN t.estado IN ('completada', 'cancelada')                 THEN NULL
    WHEN t.tipo = 'planificada'
         AND t.fecha_planificada IS NOT NULL
         AND t.fecha_planificada < CURRENT_DATE
         AND t.estado IN ('pendiente', 'en_progreso')            THEN 'atrasada'
    WHEN t.reprogramaciones > 0                                  THEN 'reprogramada'
    ELSE 'creada'
  END::text AS situacion
FROM public.tarea t
WHERE t.eliminada_en IS NULL;

GRANT SELECT ON public.tarea_activa TO authenticated;

COMMENT ON VIEW public.tarea_activa IS
  'Vista operativa V5. security_invoker=true respeta RLS. '
  'Incluye workspace_id, cliente_id, proyecto_id, area_id.';
