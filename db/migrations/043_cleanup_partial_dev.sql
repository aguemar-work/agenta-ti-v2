-- =============================================================================
-- 043_cleanup_partial_dev.sql — Solo DEV / reintento tras apply parcial fallido
-- =============================================================================
-- Usar cuando 043 falló a mitad y al reintentar aparece:
--   relation "workspace" already exists
--   relation "organizacion" already exists
--   column "workspace_id" of relation "tarea" already exists
--
-- NO ejecutar en prod si 043 ya se aplicó correctamente (T1–T12 OK).
--
-- Orden: hijos primero. Solo objetos NUEVOS de 043 — no toca datos V4 salvo
-- columnas workspace_id añadidas en un intento parcial de PASO 2.
-- =============================================================================

-- Tablas nuevas V5 (orden inverso de dependencias)
DROP TABLE IF EXISTS public.usuario_preferencia CASCADE;
DROP TABLE IF EXISTS public.area CASCADE;
DROP TABLE IF EXISTS public.proyecto CASCADE;
DROP TABLE IF EXISTS public.cliente CASCADE;
DROP TABLE IF EXISTS public.workspace_member CASCADE;
DROP TABLE IF EXISTS public.organizacion_member CASCADE;
DROP TABLE IF EXISTS public.workspace CASCADE;
DROP TABLE IF EXISTS public.organizacion CASCADE;

-- Columnas workspace_id (si PASO 2 llegó a ejecutarse)
ALTER TABLE public.tarea              DROP COLUMN IF EXISTS workspace_id, DROP COLUMN IF EXISTS cliente_id, DROP COLUMN IF EXISTS proyecto_id, DROP COLUMN IF EXISTS area_id;
ALTER TABLE public.objetivo           DROP COLUMN IF EXISTS workspace_id;
ALTER TABLE public.evento             DROP COLUMN IF EXISTS workspace_id;
ALTER TABLE public.recurrencia_evento DROP COLUMN IF EXISTS workspace_id;
ALTER TABLE public.nota_bitacora      DROP COLUMN IF EXISTS workspace_id;
ALTER TABLE public.log_accion         DROP COLUMN IF EXISTS workspace_id;
ALTER TABLE public.orden_trabajo      DROP COLUMN IF EXISTS workspace_id;
ALTER TABLE public.tipo_trabajo_ot    DROP COLUMN IF EXISTS workspace_id;
ALTER TABLE public.log_ot             DROP COLUMN IF EXISTS workspace_id;

-- FKs tarea agencia (si se crearon)
ALTER TABLE public.tarea DROP CONSTRAINT IF EXISTS tarea_cliente_fk;
ALTER TABLE public.tarea DROP CONSTRAINT IF EXISTS tarea_proyecto_fk;
ALTER TABLE public.tarea DROP CONSTRAINT IF EXISTS tarea_area_fk;

-- OT unique por workspace (restaurar estado pre-043 si existía)
ALTER TABLE public.orden_trabajo DROP CONSTRAINT IF EXISTS orden_trabajo_numero_workspace_unique;

-- Funciones V5 (si PASO 3+ corrió)
DROP FUNCTION IF EXISTS public.sgtd_workspace_id();
DROP FUNCTION IF EXISTS public.sgtd_puede_acceder_workspace(uuid);
DROP FUNCTION IF EXISTS public.sgtd_es_jefe();
DROP FUNCTION IF EXISTS public.sgtd_es_miembro_activo();
DROP FUNCTION IF EXISTS public.sgtd_es_org_admin(uuid);
DROP FUNCTION IF EXISTS public.sgtd_generar_numero_ot(uuid);
DROP FUNCTION IF EXISTS public.tarea_agencia_integridad();
DROP FUNCTION IF EXISTS public.proyecto_cliente_integridad();

-- Triggers (si PASO 7 corrió)
DROP TRIGGER IF EXISTS tarea_agencia_integridad_trigger ON public.tarea;
DROP TRIGGER IF EXISTS proyecto_cliente_integridad_trigger ON public.proyecto;

-- Índices únicos agencia (tablas ya dropeadas; por si quedaron huérfanos)
DROP INDEX IF EXISTS public.cliente_nombre_unique;
DROP INDEX IF EXISTS public.area_nombre_unique;

-- Verificación: debe retornar 0 filas
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name IN (
--   'organizacion','workspace','organizacion_member','workspace_member',
--   'usuario_preferencia','cliente','proyecto','area'
-- );
