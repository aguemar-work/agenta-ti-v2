-- =============================================================================
-- SGTD — Migración 065
-- Archivo: 065_indices_rendimiento.sql
--
-- RENDIMIENTO (auditoría 2026-07-17, hallazgo P6): índices para los filtros y
-- órdenes que el frontend usa de forma recurrente y que hoy solo pueden apoyarse
-- en los índices idx_*_workspace (escaneo lineal dentro del workspace):
--
--   - Historial/actividad (api/audit.ts): log_accion ORDER BY created_at DESC
--     paginado con range, y bandeja de no-leídos del jefe (leido_por_jefe=false).
--   - Lista y métricas de OTs (api/ordenTrabajo.ts, api/metricas.ts):
--     ORDER BY created_at DESC y rangos de fechas por workspace.
--   - Métricas por rango (api/objetivosMetricas.ts): tarea por workspace +
--     fecha_planificada incluyendo completadas (el índice parcial de 040
--     excluye completadas y no sirve para estas queries).
--   - Incidencias por rango (api/planificacion.ts): tarea es_imprevisto por
--     created_at.
--   - evento.organizacion_id (api/semana.ts:51): la columna se añadió
--     directamente en prod (2026-06-18) y su migración no está en el repo,
--     por eso el índice se crea condicionado a que la columna exista.
--
-- Todos idempotentes (IF NOT EXISTS). Sin CONCURRENTLY: volúmenes actuales
-- bajos; si alguna tabla ya es grande en prod, ejecutar esa línea aparte con
-- CREATE INDEX CONCURRENTLY (fuera de transacción).
-- =============================================================================

BEGIN;

-- Historial paginado por workspace (audit.ts:88-90) y rangos de fecha (139-142)
CREATE INDEX IF NOT EXISTS idx_log_accion_ws_created
  ON public.log_accion (workspace_id, created_at DESC);

-- Bandeja de justificaciones no leídas del jefe (audit.ts:18-22)
CREATE INDEX IF NOT EXISTS idx_log_accion_no_leido
  ON public.log_accion (workspace_id, created_at DESC)
  WHERE leido_por_jefe = false;

-- Lista de OTs ORDER BY created_at DESC (ordenTrabajo.ts:158,167) y
-- métricas por rango (metricas.ts:9-11)
CREATE INDEX IF NOT EXISTS idx_ot_ws_created
  ON public.orden_trabajo (workspace_id, created_at DESC);

-- OTs vencidas: fecha_estimada < hoy con estado activo (otVencida / filtro servidor)
CREATE INDEX IF NOT EXISTS idx_ot_ws_fecha_estimada
  ON public.orden_trabajo (workspace_id, fecha_estimada)
  WHERE estado IN ('borrador', 'pendiente', 'aprobada');

-- Métricas por rango incluyendo completadas (objetivosMetricas.ts:166-171)
CREATE INDEX IF NOT EXISTS idx_tarea_ws_fecha_plan
  ON public.tarea (workspace_id, fecha_planificada);

-- Incidencias por rango de created_at (planificacion.ts:95-102)
CREATE INDEX IF NOT EXISTS idx_tarea_imprevisto_created
  ON public.tarea (workspace_id, created_at)
  WHERE es_imprevisto = true;

-- evento.organizacion_id: columna añadida directamente en prod (sin migración
-- en el repo); crear el índice solo donde la columna exista.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'evento'
      AND column_name = 'organizacion_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_evento_organizacion
      ON public.evento (organizacion_id);
  END IF;
END;
$$;

COMMIT;

-- -----------------------------------------------------------------------------
-- Verificación (ejecutar tras COMMIT)
-- -----------------------------------------------------------------------------
-- SELECT indexname FROM pg_indexes
--  WHERE schemaname = 'public'
--    AND indexname IN (
--      'idx_log_accion_ws_created', 'idx_log_accion_no_leido',
--      'idx_ot_ws_created', 'idx_ot_ws_fecha_estimada',
--      'idx_tarea_ws_fecha_plan', 'idx_tarea_imprevisto_created',
--      'idx_evento_organizacion'
--    );
-- Confirmar uso real con EXPLAIN (ANALYZE) sobre las queries citadas arriba.
