-- =============================================================================
-- SGTD — Migración 019
-- Archivo: 019_drop_desbloquear_duplicadas.sql
--
-- sgtd_desbloquear_tarea_con_log tiene 3 versiones en conflicto.
-- Eliminar las dos antiguas y dejar solo la de la migración 018.
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.sgtd_desbloquear_tarea_con_log(UUID, UUID, DATE, TEXT);
DROP FUNCTION IF EXISTS public.sgtd_desbloquear_tarea_con_log(UUID, UUID, DATE, TEXT, TEXT);

-- Verificar que queda exactamente 1:
-- SELECT proname, pg_get_function_arguments(oid)
-- FROM pg_proc
-- WHERE pronamespace = 'public'::regnamespace
--   AND proname = 'sgtd_desbloquear_tarea_con_log';
-- → 1 fila: (uuid, uuid, text, text)

COMMIT;