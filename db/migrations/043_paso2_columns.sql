-- =============================================================================
-- 043_paso2_columns.sql — Solo PASO 2 (columnas workspace_id en dominio V4)
-- =============================================================================
-- Usar cuando 043_check_status.sql dice PARCIAL y faltan columnas workspace_id
-- pero ya existen tablas public.workspace / public.organizacion (PASO 1 OK).
--
-- Prerequisito: tabla public.workspace debe existir.
-- Después: ejecutar 043_workspace_foundation.sql desde PASO 3 en adelante,
--          o el 043 completo (CREATE TABLE IF NOT EXISTS permite reintento).
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'workspace'
  ) THEN
    RAISE EXCEPTION 'Falta tabla workspace. Ejecuta PASO 1 o 043 completo primero.';
  END IF;
END $$;

-- usuario: columnas auxiliares V5
ALTER TABLE public.usuario
  ADD COLUMN IF NOT EXISTS activo     boolean     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS avatar_url text        NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.usuario ALTER COLUMN rol DROP NOT NULL;

-- workspace_id nullable (NOT NULL en PASO 5 del 043 principal)
ALTER TABLE public.tarea
  ADD COLUMN IF NOT EXISTS workspace_id uuid NULL REFERENCES public.workspace (id),
  ADD COLUMN IF NOT EXISTS cliente_id   uuid NULL,
  ADD COLUMN IF NOT EXISTS proyecto_id  uuid NULL,
  ADD COLUMN IF NOT EXISTS area_id      uuid NULL;

DO $$ BEGIN
  ALTER TABLE public.tarea ADD CONSTRAINT tarea_cliente_fk
    FOREIGN KEY (cliente_id) REFERENCES public.cliente (id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.tarea ADD CONSTRAINT tarea_proyecto_fk
    FOREIGN KEY (proyecto_id) REFERENCES public.proyecto (id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.tarea ADD CONSTRAINT tarea_area_fk
    FOREIGN KEY (area_id) REFERENCES public.area (id) ON DELETE SET NULL;
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

ALTER TABLE public.orden_trabajo DROP CONSTRAINT IF EXISTS orden_trabajo_numero_key;
DO $$ BEGIN
  ALTER TABLE public.orden_trabajo
    ADD CONSTRAINT orden_trabajo_numero_workspace_unique UNIQUE (workspace_id, numero);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Verificación: tablas_con_columna_ws_id debe ser 9
-- SELECT COUNT(*) FROM information_schema.columns
-- WHERE table_schema='public' AND column_name='workspace_id'
--   AND table_name IN ('tarea','objetivo','evento','recurrencia_evento','nota_bitacora',
--                      'log_accion','orden_trabajo','tipo_trabajo_ot','log_ot');
