-- =============================================================================
-- SGTD — Migración 011
-- Archivo: 011_eliminar_configuracion_semana.sql
--
-- Cambios:
--   1. Elimina tabla configuracion_semana (redundante con bitácora)
--   2. Las "notas de semana" del jefe pasan a ser notas_bitacora
--      con visibilidad='todos' y un tag en el contenido
--
-- Prerrequisito: migración 010 aplicada.
-- =============================================================================

BEGIN;

-- Migrar datos existentes de configuracion_semana → nota_bitacora
-- Solo si hay notas con contenido real (no NULL ni vacío)
INSERT INTO public.nota_bitacora (contenido, usuario_id, visibilidad, created_at)
SELECT
  '[Nota de semana ' || fecha_inicio_semana::text || '] ' || notas_semana,
  (SELECT id FROM public.usuario WHERE rol = 'jefe' AND activo = true ORDER BY created_at LIMIT 1),
  'todos',
  created_at
FROM public.configuracion_semana
WHERE notas_semana IS NOT NULL
  AND trim(notas_semana) <> ''
  AND (SELECT id FROM public.usuario WHERE rol = 'jefe' AND activo = true LIMIT 1) IS NOT NULL;

-- Eliminar políticas RLS primero
DROP POLICY IF EXISTS sgtd_jefe_configuracion_semana_all      ON public.configuracion_semana;
DROP POLICY IF EXISTS sgtd_miembro_configuracion_select       ON public.configuracion_semana;

-- Eliminar tabla
DROP TABLE IF EXISTS public.configuracion_semana;

-- =============================================================================
-- VERIFICACIÓN
--
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name = 'configuracion_semana';
-- → 0 filas (tabla eliminada)
-- =============================================================================

COMMIT;