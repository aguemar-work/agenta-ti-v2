-- =============================================================================
-- Migración 056 — Eliminar workspace.tipo (etiqueta muerta)
-- =============================================================================
-- Descripción : workspace.tipo ('interno'|'agencia') dejó de tener valor de
--               seguridad desde la migración 045 (módulos libres). Ya ninguna
--               política RLS ni trigger depende de ella. Esta migración la
--               elimina definitivamente para que el schema refleje el modelo real.
--
-- Qué cambia:
--   1. sgtd_crear_organizacion: se elimina el parámetro p_tipo_workspace.
--      La firma pasa de (text, text, text, text[]) → (text, text, text[]).
--   2. ALTER TABLE workspace DROP COLUMN tipo.
--      La constraint workspace_tipo_check se elimina en cascada.
--
-- Qué NO cambia:
--   - La lógica de módulos (workspace_modulo, sgtd_workspace_tiene_modulo).
--   - El trigger workspace_modulo_validar (solo bitacora obligatorio, ya en 047).
--   - Las políticas RLS de dominio (no usan tipo desde 045).
--
-- Prerequisito : Migraciones 043–055 aplicadas.
-- Idempotente  : Sí (DROP IF EXISTS + DROP COLUMN IF EXISTS).
-- Reversible   : Ver ROLLBACK al final (solo staging).
--
-- Identificador de validación:
--   SELECT NOT EXISTS (
--     SELECT 1 FROM information_schema.columns
--     WHERE table_schema = 'public'
--       AND table_name   = 'workspace'
--       AND column_name  = 'tipo'
--   ) AS tipo_eliminado_056;
--   esperado: true
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Guard: verificar que 045 está aplicada (políticas que usaban tipo ya reescritas).
--    Si alguna política de cliente aún referencia workspace.tipo significa que
--    045 no se aplicó y el DROP COLUMN fallaría en runtime.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'cliente'
      AND (
        COALESCE(qual, '')        LIKE '%workspace%tipo%'
        OR COALESCE(with_check, '') LIKE '%workspace%tipo%'
      )
  ) THEN
    RAISE EXCEPTION
      '056 requiere migración 045 aplicada: la política de cliente aún referencia workspace.tipo. '
      'Aplica 043 → 045 antes de ejecutar esta migración.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Eliminar la firma antigua de sgtd_crear_organizacion (con p_tipo_workspace)
--    y recrear sin ese parámetro.
--    PostgreSQL no permite DROP+CREATE en la misma transacción solo con
--    CREATE OR REPLACE cuando la firma cambia → hay que DROP explícito primero.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.sgtd_crear_organizacion(text, text, text, text[]);

CREATE OR REPLACE FUNCTION public.sgtd_crear_organizacion(
  p_nombre  text,
  p_slug    text,
  p_modulos text[] DEFAULT ARRAY[]::text[]
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_org_id uuid;
  v_ws_id  uuid;
  v_modulo text;
  v_modulos_final text[];
  v_catalogo text[] := ARRAY['areas','proyectos','clientes','ordenes_trabajo','objetivos','bitacora'];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = 'P0001';
  END IF;

  -- Gate de dueño: solo plataforma_owner puede crear organizaciones (047)
  IF NOT public.sgtd_es_plataforma_owner() THEN
    RAISE EXCEPTION 'No tienes permiso para crear organizaciones.' USING ERRCODE = 'P0007';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.usuario WHERE id = v_uid AND (activo = true OR activo IS NULL)) THEN
    RAISE EXCEPTION 'Usuario no existe o está inactivo.' USING ERRCODE = 'P0002';
  END IF;
  IF btrim(coalesce(p_nombre, '')) = '' THEN
    RAISE EXCEPTION 'El nombre de la organización no puede estar vacío.' USING ERRCODE = 'P0003';
  END IF;
  IF p_slug !~ '^[a-z0-9\-]+$' THEN
    RAISE EXCEPTION 'El slug solo permite minúsculas, números y guiones.' USING ERRCODE = 'P0005';
  END IF;

  BEGIN
    INSERT INTO public.organizacion (nombre, slug)
    VALUES (btrim(p_nombre), btrim(p_slug))
    RETURNING id INTO v_org_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Ya existe una organización con el slug "%". Elige otro.', btrim(p_slug)
      USING ERRCODE = 'P0006';
  END;

  -- Sin columna tipo: workspace ya no tiene esa etiqueta (056)
  INSERT INTO public.workspace (organizacion_id, nombre)
  VALUES (v_org_id, 'Principal')
  RETURNING id INTO v_ws_id;

  INSERT INTO public.organizacion_member (organizacion_id, usuario_id, rol)
  VALUES (v_org_id, v_uid, 'org_admin');

  INSERT INTO public.workspace_member (workspace_id, usuario_id, rol, joined_at)
  VALUES (v_ws_id, v_uid, 'jefe', now());

  -- Módulos: forzar bitacora + aceptar cualquier módulo válido del catálogo
  v_modulos_final := ARRAY(
    SELECT DISTINCT m FROM unnest(
      array_cat(coalesce(p_modulos, ARRAY[]::text[]), ARRAY['bitacora'])
    ) AS m
    WHERE m = ANY(v_catalogo)
  );

  FOREACH v_modulo IN ARRAY v_modulos_final LOOP
    INSERT INTO public.workspace_modulo (workspace_id, modulo, activo)
    VALUES (v_ws_id, v_modulo, true)
    ON CONFLICT (workspace_id, modulo) DO NOTHING;
  END LOOP;

  INSERT INTO public.usuario_preferencia (usuario_id, ultima_org_id, ultima_workspace_id)
  VALUES (v_uid, v_org_id, v_ws_id)
  ON CONFLICT (usuario_id) DO UPDATE
    SET ultima_org_id       = EXCLUDED.ultima_org_id,
        ultima_workspace_id = EXCLUDED.ultima_workspace_id,
        updated_at          = now();

  RETURN jsonb_build_object(
    'organizacion_id', v_org_id,
    'workspace_id',    v_ws_id,
    'modulos',         v_modulos_final
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sgtd_crear_organizacion(text, text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_crear_organizacion(text, text, text[]) TO authenticated;

COMMENT ON FUNCTION public.sgtd_crear_organizacion IS
  'V5 056: crea org+workspace+membresías+módulos. Sin p_tipo_workspace (eliminado). '
  'Solo plataforma_owner. Solo bitacora obligatorio.';

-- ---------------------------------------------------------------------------
-- 2. Eliminar columna tipo de workspace.
--    Elimina en cascada: constraint workspace_tipo_check.
--    No hay índices explícitos en tipo (solo en organizacion_id).
-- ---------------------------------------------------------------------------
ALTER TABLE public.workspace DROP COLUMN IF EXISTS tipo;

COMMENT ON TABLE public.workspace IS
  'Unidad operativa aislada dentro de una organización. '
  'Las capacidades se configuran mediante workspace_modulo (módulos activos), '
  'sin etiqueta de tipo (eliminada en 056).';


COMMIT;


-- =============================================================================
-- SMOKE TESTS — ejecutar tras apply
-- =============================================================================

-- T1: columna tipo eliminada
--   SELECT NOT EXISTS (
--     SELECT 1 FROM information_schema.columns
--     WHERE table_schema='public' AND table_name='workspace' AND column_name='tipo'
--   ) AS tipo_eliminado;
--   esperado: true

-- T2: constraint eliminada en cascada
--   SELECT NOT EXISTS (
--     SELECT 1 FROM information_schema.table_constraints
--     WHERE table_name='workspace' AND constraint_name='workspace_tipo_check'
--   ) AS constraint_eliminada;
--   esperado: true

-- T3: nueva firma existe y la vieja no
--   SELECT proname, pg_get_function_arguments(oid)
--   FROM pg_proc WHERE proname = 'sgtd_crear_organizacion';
--   esperado: una fila con args 'p_nombre text, p_slug text, p_modulos text[]'

-- T4: crear org sin tipo funciona (requiere autenticación como plataforma_owner)
--   Autenticarse como a.guevaramartinez@gmail.com antes de ejecutar:
--   SELECT sgtd_crear_organizacion('Test 056', 'test-056', ARRAY['proyectos']);
--   esperado: {organizacion_id, workspace_id, modulos: [bitacora, proyectos]}
--   Como NO-dueño: EXCEPTION 'No tienes permiso para crear organizaciones.'

-- T5: workspace creado por T4 no tiene columna tipo
--   SELECT id, nombre, activo FROM workspace WHERE organizacion_id = '<org-id-de-T4>';
--   esperado: fila sin columna tipo

-- T6: intentar llamar con firma antigua → error
--   SELECT sgtd_crear_organizacion('X', 'x', 'interno', ARRAY[]::text[]);
--   esperado: ERROR: function does not exist


-- =============================================================================
-- ROLLBACK — solo staging
-- =============================================================================
-- ALTER TABLE public.workspace ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'interno';
-- ALTER TABLE public.workspace ADD CONSTRAINT workspace_tipo_check CHECK (tipo IN ('interno', 'agencia'));
-- DROP FUNCTION IF EXISTS public.sgtd_crear_organizacion(text, text, text[]);
-- (Restaurar sgtd_crear_organizacion(text,text,text,text[]) desde migración 047)


-- =============================================================================
-- POST-MIGRACIÓN: checklist
-- =============================================================================
-- [ ] Aplicar en dev → ejecutar T1–T6
-- [ ] Desplegar frontend con los 5 cambios de A1 (ver lista en el PR)
-- [ ] Crear empresa desde el panel → confirmado sin selector de tipo
-- [ ] WorkspaceSelector ya no muestra "(Interno)" ni badges de tipo
-- [ ] Marcar 056 ✅ en CONTEXT.mdc §12 (Dev / Staging / Prod)
