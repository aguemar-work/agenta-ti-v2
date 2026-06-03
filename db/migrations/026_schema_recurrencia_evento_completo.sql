-- =============================================================================
-- SGTD — Migración 026
-- Archivo: 026_schema_recurrencia_evento_completo.sql
--
-- La tabla recurrencia_evento ya existía en producción con columnas adicionales
-- (creado_por, updated_at) que no estaban en la migración 025.
-- Esta migración las agrega con IF NOT EXISTS para que un fresh install
-- quede idéntico al entorno de producción.
--
-- También documenta que sgtd_crear_ot_desde_incidencia sigue disponible en BD
-- pero sin UI por ahora. El wrapper TypeScript fue eliminado del cliente.
-- =============================================================================

BEGIN;

ALTER TABLE public.recurrencia_evento
  ADD COLUMN IF NOT EXISTS creado_por uuid REFERENCES public.usuario (id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_recurrencia_evento_creado_por
  ON public.recurrencia_evento (creado_por);

COMMIT;