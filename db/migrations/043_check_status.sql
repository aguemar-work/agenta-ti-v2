-- =============================================================================
-- 043_check_status.sql — Diagnóstico seguro (no asume que workspace_id existe)
-- =============================================================================
-- Ejecutar en InsForge SQL Editor. Solo lee information_schema / pg_catalog.
-- =============================================================================

SELECT
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'workspace_member'
  ) AS tablas_v5_ok,

  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'sgtd_workspace_id'
  ) AS funciones_v5_ok,

  (
    SELECT COUNT(*)::int
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'workspace_id'
      AND table_name IN (
        'tarea', 'objetivo', 'evento', 'recurrencia_evento', 'nota_bitacora',
        'log_accion', 'orden_trabajo', 'tipo_trabajo_ot', 'log_ot'
      )
  ) AS tablas_con_columna_ws_id,

  CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'workspace_member'
    ) AND (
      SELECT COUNT(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'workspace_id'
        AND table_name IN ('tarea', 'log_accion', 'orden_trabajo')
    ) = 0
    THEN 'NO_APLICADA — ejecutar 043_workspace_foundation.sql completo'

    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'workspace'
    ) AND (
      SELECT COUNT(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'workspace_id'
        AND table_name = 'tarea'
    ) = 0
    THEN 'PARCIAL — tablas V5 sí, columnas NO → ejecutar 043_paso2_columns.sql y luego 043 desde PASO 3'

    WHEN (
      SELECT COUNT(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'workspace_id'
        AND table_name IN (
          'tarea', 'objetivo', 'evento', 'recurrencia_evento', 'nota_bitacora',
          'log_accion', 'orden_trabajo', 'tipo_trabajo_ot', 'log_ot'
        )
    ) < 9
    THEN 'PARCIAL — faltan columnas workspace_id → 043_paso2_columns.sql'

    WHEN NOT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = 'sgtd_workspace_id'
    )
    THEN 'PARCIAL — columnas OK, faltan funciones/políticas → 043 desde PASO 3'

    ELSE 'APLICADA_OK — tablas V5 + columnas + funciones base'
  END AS estado;

-- Detalle: qué tablas de dominio aún NO tienen workspace_id
SELECT t.table_name,
       EXISTS (
         SELECT 1 FROM information_schema.columns c
         WHERE c.table_schema = 'public'
           AND c.table_name = t.table_name
           AND c.column_name = 'workspace_id'
       ) AS tiene_workspace_id
FROM (VALUES
  ('tarea'), ('objetivo'), ('evento'), ('recurrencia_evento'),
  ('nota_bitacora'), ('log_accion'), ('orden_trabajo'),
  ('tipo_trabajo_ot'), ('log_ot')
) AS t(table_name)
ORDER BY 1;
