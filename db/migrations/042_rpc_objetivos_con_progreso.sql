-- =============================================================================
-- SGTD — Migración 042 · RPC agregación progreso objetivos
--
-- Reemplaza carga de todas las tareas con objetivo_id en cliente (AUDIT-030).
-- Idempotente: CREATE OR REPLACE.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sgtd_objetivos_con_progreso()
RETURNS TABLE (
  id             uuid,
  titulo         text,
  descripcion    text,
  fecha_limite   date,
  estado         text,
  creado_por     uuid,
  responsable_id uuid,
  created_at     timestamptz,
  updated_at     timestamptz,
  total_tareas   bigint,
  completadas    bigint,
  pct            integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    o.id,
    o.titulo,
    o.descripcion,
    o.fecha_limite,
    o.estado,
    o.creado_por,
    o.responsable_id,
    o.created_at,
    o.updated_at,
    COUNT(t.id) FILTER (WHERE t.estado IS DISTINCT FROM 'cancelada') AS total_tareas,
    COUNT(t.id) FILTER (WHERE t.estado = 'completada') AS completadas,
    CASE
      WHEN COUNT(t.id) FILTER (WHERE t.estado IS DISTINCT FROM 'cancelada') = 0 THEN 0
      ELSE ROUND(
        100.0 * COUNT(t.id) FILTER (WHERE t.estado = 'completada')
        / NULLIF(COUNT(t.id) FILTER (WHERE t.estado IS DISTINCT FROM 'cancelada'), 0)
      )::integer
    END AS pct
  FROM public.objetivo o
  LEFT JOIN public.tarea_activa t ON t.objetivo_id = o.id
  GROUP BY o.id
  ORDER BY o.fecha_limite ASC NULLS LAST;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_objetivos_con_progreso() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_objetivos_con_progreso() TO authenticated;
