-- =============================================================================
-- SGTD — Migración 041 · Índice orden_trabajo(tarea_id)
--
-- Acelera búsquedas de OT vinculada desde Mi Semana y sync tarea↔OT.
-- Idempotente: IF NOT EXISTS.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_orden_trabajo_tarea_id
  ON public.orden_trabajo (tarea_id)
  WHERE tarea_id IS NOT NULL;
