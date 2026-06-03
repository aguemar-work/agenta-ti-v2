-- =============================================================================
-- SGTD — Migración 014
-- Archivo: 014_drop_reprogramar_duplicada.sql
--
-- Problema: sigue existiendo una versión antigua de sgtd_reprogramar_tarea_con_log
-- con firma (uuid, uuid, date, text, text, text) que causa conflicto PGRST203.
-- El DROP de la migración 013 no la eliminó porque la firma era distinta.
--
-- Solución: DROP explícito con la firma exacta que quedó en BD.
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.sgtd_reprogramar_tarea_con_log(
  UUID, UUID, DATE, TEXT, TEXT, TEXT
);

-- Verificar que queda exactamente una versión:
-- SELECT proname, pg_get_function_arguments(oid)
-- FROM pg_proc
-- WHERE pronamespace = 'public'::regnamespace
--   AND proname = 'sgtd_reprogramar_tarea_con_log';
-- → 1 fila: (uuid, uuid, text, text, text)

COMMIT;