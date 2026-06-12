-- =============================================================================
-- PASO 5 — NOT NULL post-backfill
-- =============================================================================

ALTER TABLE public.tarea              ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.objetivo           ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.evento             ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.recurrencia_evento ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.nota_bitacora      ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.log_accion         ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.orden_trabajo      ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.tipo_trabajo_ot    ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.log_ot             ALTER COLUMN workspace_id SET NOT NULL;
