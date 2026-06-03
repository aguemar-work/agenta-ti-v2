-- =============================================================================
-- SGTD — Migración 021
-- Archivo: 021_drop_completar_ot_duplicadas.sql
--
-- sgtd_completar_ot tiene 3 versiones. El frontend usa la firma con
-- p_receptor_nombre, p_receptor_dni, p_receptor_cargo, p_observaciones_cierre.
-- Eliminar las dos versiones incorrectas.
-- =============================================================================

BEGIN;

-- Versión sin receptor (creada por migración 020 — incorrecta)
DROP FUNCTION IF EXISTS public.sgtd_completar_ot(UUID, UUID, TEXT);

-- Versión sin p_usuario_id (generada por InsForge — incorrecta)
DROP FUNCTION IF EXISTS public.sgtd_completar_ot(UUID, TEXT, TEXT, TEXT, TEXT);

-- La versión correcta que usa el frontend queda intacta:
-- sgtd_completar_ot(uuid, uuid, text, text, text, text)
-- = (p_ot_id, p_usuario_id, p_receptor_nombre, p_receptor_dni, p_receptor_cargo, p_observaciones_cierre)

-- =============================================================================
-- VERIFICACIÓN
--
-- SELECT proname, pg_get_function_arguments(oid)
-- FROM pg_proc
-- WHERE pronamespace = 'public'::regnamespace
--   AND proname = 'sgtd_completar_ot';
-- → 1 fila:
--   p_ot_id uuid, p_usuario_id uuid, p_receptor_nombre text,
--   p_receptor_dni text, p_receptor_cargo text,
--   p_observaciones_cierre text DEFAULT NULL
--
-- Sin duplicados:
-- SELECT proname, COUNT(*) FROM pg_proc
-- WHERE pronamespace = 'public'::regnamespace
--   AND proname LIKE 'sgtd_%'
-- GROUP BY proname HAVING COUNT(*) > 1;
-- → 0 filas
-- =============================================================================

COMMIT;