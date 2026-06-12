-- =============================================================================
-- PASO 2 — ALTER dominio V4 (+ columnas workspace_id)
-- =============================================================================

-- usuario: añadir columnas faltantes, deprecar rol global
ALTER TABLE public.usuario
  ADD COLUMN IF NOT EXISTS activo     boolean     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS avatar_url text        NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.usuario ALTER COLUMN rol DROP NOT NULL;

COMMENT ON COLUMN public.usuario.rol    IS 'DEPRECATED v5 — migrado a workspace_member. DROP en 046 (pendiente).';
COMMENT ON COLUMN public.usuario.activo IS 'false = baja global; impide login aunque siga en membresías.';

-- Tablas de dominio: workspace_id nullable primero (NOT NULL post-backfill)
ALTER TABLE public.tarea
  ADD COLUMN IF NOT EXISTS workspace_id uuid NULL REFERENCES public.workspace (id),
  ADD COLUMN IF NOT EXISTS cliente_id   uuid NULL,
  ADD COLUMN IF NOT EXISTS proyecto_id  uuid NULL,
  ADD COLUMN IF NOT EXISTS area_id      uuid NULL;

DO $$ BEGIN
  ALTER TABLE public.tarea
    ADD CONSTRAINT tarea_cliente_fk  FOREIGN KEY (cliente_id)  REFERENCES public.cliente (id)  ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.tarea
    ADD CONSTRAINT tarea_proyecto_fk FOREIGN KEY (proyecto_id) REFERENCES public.proyecto (id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.tarea
    ADD CONSTRAINT tarea_area_fk     FOREIGN KEY (area_id)     REFERENCES public.area (id)     ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_tarea_workspace ON public.tarea (workspace_id);
CREATE INDEX IF NOT EXISTS idx_tarea_cliente   ON public.tarea (cliente_id);
CREATE INDEX IF NOT EXISTS idx_tarea_proyecto  ON public.tarea (proyecto_id);
CREATE INDEX IF NOT EXISTS idx_tarea_area      ON public.tarea (area_id);

ALTER TABLE public.objetivo           ADD COLUMN IF NOT EXISTS workspace_id uuid NULL REFERENCES public.workspace (id);
ALTER TABLE public.evento             ADD COLUMN IF NOT EXISTS workspace_id uuid NULL REFERENCES public.workspace (id);
ALTER TABLE public.recurrencia_evento ADD COLUMN IF NOT EXISTS workspace_id uuid NULL REFERENCES public.workspace (id);
ALTER TABLE public.nota_bitacora      ADD COLUMN IF NOT EXISTS workspace_id uuid NULL REFERENCES public.workspace (id);
ALTER TABLE public.log_accion         ADD COLUMN IF NOT EXISTS workspace_id uuid NULL REFERENCES public.workspace (id);
ALTER TABLE public.orden_trabajo      ADD COLUMN IF NOT EXISTS workspace_id uuid NULL REFERENCES public.workspace (id);
ALTER TABLE public.tipo_trabajo_ot    ADD COLUMN IF NOT EXISTS workspace_id uuid NULL REFERENCES public.workspace (id);
ALTER TABLE public.log_ot             ADD COLUMN IF NOT EXISTS workspace_id uuid NULL REFERENCES public.workspace (id);

CREATE INDEX IF NOT EXISTS idx_objetivo_workspace    ON public.objetivo (workspace_id);
CREATE INDEX IF NOT EXISTS idx_evento_workspace      ON public.evento (workspace_id);
CREATE INDEX IF NOT EXISTS idx_recurrencia_workspace ON public.recurrencia_evento (workspace_id);
CREATE INDEX IF NOT EXISTS idx_nota_workspace        ON public.nota_bitacora (workspace_id);
CREATE INDEX IF NOT EXISTS idx_log_accion_workspace  ON public.log_accion (workspace_id);
CREATE INDEX IF NOT EXISTS idx_ot_workspace          ON public.orden_trabajo (workspace_id);
CREATE INDEX IF NOT EXISTS idx_tipo_ot_workspace     ON public.tipo_trabajo_ot (workspace_id);
CREATE INDEX IF NOT EXISTS idx_log_ot_workspace      ON public.log_ot (workspace_id);

-- OT: correlativo por workspace (reemplaza UNIQUE global)
ALTER TABLE public.orden_trabajo DROP CONSTRAINT IF EXISTS orden_trabajo_numero_key;
DO $$ BEGIN
  ALTER TABLE public.orden_trabajo
    ADD CONSTRAINT orden_trabajo_numero_workspace_unique UNIQUE (workspace_id, numero);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- Guard: PASO 2 debe existir antes de funciones que referencian orden_trabajo.workspace_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'orden_trabajo'
      AND column_name  = 'workspace_id'
  ) THEN
    RAISE EXCEPTION
      '043 PASO 2 incompleto: falta orden_trabajo.workspace_id. '
      'Ejecuta db/migrations/043_paso2_columns.sql o cleanup + 043 completo.';
  END IF;
END $$;
