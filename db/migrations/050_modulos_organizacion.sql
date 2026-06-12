-- =============================================================================
-- Migración 050 — Gestión de módulos por organización (panel del dueño)
-- =============================================================================
-- Descripción : Parte 3 del panel. Permite al dueño activar/desactivar módulos
--               de CUALQUIER organización desde el panel, donde NO hay workspace
--               activo (sin header x-workspace-id). Por eso una RPC que recibe
--               el organizacion_id directo y resuelve el workspace internamente
--               (mismo patrón que la 049 de asignación de usuarios).
--
--   sgtd_set_modulo_organizacion(p_organizacion_id, p_modulo, p_activo)
--     - gate: solo plataforma_owner
--     - valida módulo ∈ catálogo
--     - respeta el trigger: NO permite desactivar 'bitacora' (obligatorio)
--     - resuelve el workspace principal de la org (primero activo por created_at)
--     - upsert en workspace_modulo
--
--   sgtd_listar_modulos_organizacion(p_organizacion_id)
--     - gate: solo plataforma_owner
--     - devuelve el estado (activo/inactivo) de TODOS los módulos del catálogo
--       para esa org (para que el panel muestre el estado completo, no solo activos)
--
-- POR QUÉ UNA RPC Y NO ESCRITURA DIRECTA:
--   La RLS de workspace_modulo (044) exige para escribir:
--     (workspace_id = sgtd_workspace_id() AND sgtd_es_jefe()) OR sgtd_es_org_admin(...)
--   En modo panel sgtd_workspace_id() es NULL → falla el camino jefe; y el dueño
--   no es org_admin de orgs ajenas. La RPC SECURITY DEFINER con gate de dueño
--   resuelve esto sin depender del header ni de organizacion_member.
--
-- Prerequisito : Migraciones 043–049 aplicadas.
-- Seguridad    : SECURITY DEFINER + gate sgtd_es_plataforma_owner().
-- Reversible   : Ver ROLLBACK al final.
--
-- Identificador de validación:
--   SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
--     WHERE n.nspname='public' AND p.proname='sgtd_set_modulo_organizacion')
--     AS modulos_050_ok;
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Catálogo de módulos válidos (mismo CHECK de workspace_modulo, 044)
-- areas, proyectos, clientes, ordenes_trabajo, objetivos, bitacora
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- RPC 1 — Listar estado de módulos de una org (solo dueño)
-- Devuelve TODOS los módulos del catálogo con su estado activo/inactivo.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_listar_modulos_organizacion(
  p_organizacion_id uuid
)
RETURNS TABLE (
  modulo  text,
  activo  boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ws_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.sgtd_es_plataforma_owner() THEN
    RAISE EXCEPTION 'No tienes permiso para ver los módulos.' USING ERRCODE = 'P0007';
  END IF;

  -- Org activa (consistencia con sgtd_set_modulo_organizacion)
  IF NOT EXISTS (SELECT 1 FROM public.organizacion WHERE id = p_organizacion_id AND activa = true) THEN
    RAISE EXCEPTION 'La organización no existe o está inactiva.' USING ERRCODE = 'P0002';
  END IF;

  -- Resolver workspace principal de la org
  SELECT id INTO v_ws_id
  FROM public.workspace
  WHERE organizacion_id = p_organizacion_id AND activo = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_ws_id IS NULL THEN
    RAISE EXCEPTION 'La organización no tiene un espacio de trabajo activo.' USING ERRCODE = 'P0002';
  END IF;

  -- Todos los módulos del catálogo + su estado (false si no hay fila)
  RETURN QUERY
  SELECT
    cat.modulo,
    COALESCE(wm.activo, false) AS activo
  FROM (
    VALUES ('areas'), ('proyectos'), ('clientes'),
           ('ordenes_trabajo'), ('objetivos'), ('bitacora')
  ) AS cat(modulo)
  LEFT JOIN public.workspace_modulo wm
    ON wm.workspace_id = v_ws_id AND wm.modulo = cat.modulo
  ORDER BY cat.modulo;
END;
$$;

REVOKE ALL ON FUNCTION public.sgtd_listar_modulos_organizacion(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_listar_modulos_organizacion(uuid) TO authenticated;

COMMENT ON FUNCTION public.sgtd_listar_modulos_organizacion IS
  'V5 050: estado de todos los módulos del catálogo para una org (solo plataforma_owner).';

-- ---------------------------------------------------------------------------
-- RPC 2 — Activar/desactivar un módulo de una org (solo dueño)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_set_modulo_organizacion(
  p_organizacion_id uuid,
  p_modulo          text,
  p_activo          boolean
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ws_id uuid;
  v_catalogo text[] := ARRAY['areas','proyectos','clientes','ordenes_trabajo','objetivos','bitacora'];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.sgtd_es_plataforma_owner() THEN
    RAISE EXCEPTION 'No tienes permiso para gestionar módulos.' USING ERRCODE = 'P0007';
  END IF;

  -- Módulo válido
  IF NOT (p_modulo = ANY(v_catalogo)) THEN
    RAISE EXCEPTION 'Módulo "%" no válido.', p_modulo USING ERRCODE = 'P0003';
  END IF;

  -- Estado requerido
  IF p_activo IS NULL THEN
    RAISE EXCEPTION 'Debe indicar si el módulo se activa o desactiva.' USING ERRCODE = 'P0003';
  END IF;

  -- Proteger bitacora (coherente con el trigger workspace_modulo_validar de 047)
  IF p_modulo = 'bitacora' AND p_activo = false THEN
    RAISE EXCEPTION 'El módulo "bitacora" es obligatorio y no se puede desactivar.' USING ERRCODE = 'P0002';
  END IF;

  -- Org activa
  IF NOT EXISTS (SELECT 1 FROM public.organizacion WHERE id = p_organizacion_id AND activa = true) THEN
    RAISE EXCEPTION 'La organización no existe o está inactiva.' USING ERRCODE = 'P0002';
  END IF;

  -- Resolver workspace principal
  SELECT id INTO v_ws_id
  FROM public.workspace
  WHERE organizacion_id = p_organizacion_id AND activo = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_ws_id IS NULL THEN
    RAISE EXCEPTION 'La organización no tiene un espacio de trabajo activo.' USING ERRCODE = 'P0002';
  END IF;

  -- Upsert del módulo
  INSERT INTO public.workspace_modulo (workspace_id, modulo, activo)
  VALUES (v_ws_id, p_modulo, p_activo)
  ON CONFLICT (workspace_id, modulo) DO UPDATE SET
    activo     = EXCLUDED.activo,
    updated_at = now();

  RETURN jsonb_build_object(
    'organizacion_id', p_organizacion_id,
    'workspace_id',    v_ws_id,
    'modulo',          p_modulo,
    'activo',          p_activo
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sgtd_set_modulo_organizacion(uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_set_modulo_organizacion(uuid, text, boolean) TO authenticated;

COMMENT ON FUNCTION public.sgtd_set_modulo_organizacion IS
  'V5 050: activa/desactiva un módulo de una org (solo plataforma_owner). Protege bitacora. '
  'Resuelve el workspace principal internamente (no depende del header).';

COMMIT;


-- =============================================================================
-- SMOKE TESTS — ejecutar tras apply
-- =============================================================================
-- Contexto: dueño = a.guevaramartinez@gmail.com. Org: AGUEMAR (3c09a31b-...).

-- T1 (dueño): listar módulos de AGUEMAR
--   SELECT * FROM sgtd_listar_modulos_organizacion('3c09a31b-...');
--   esperado: 6 filas (todos los módulos del catálogo) con su estado activo/inactivo

-- T2 (dueño): activar 'clientes' en AGUEMAR
--   SELECT sgtd_set_modulo_organizacion('3c09a31b-...', 'clientes', true);
--   esperado: {organizacion_id, workspace_id, modulo:'clientes', activo:true}
--   Verificar: el listado ahora muestra clientes activo=true

-- T3 (dueño): desactivar 'clientes'
--   SELECT sgtd_set_modulo_organizacion('3c09a31b-...', 'clientes', false);
--   esperado: activo=false

-- T4 (dueño): intentar desactivar 'bitacora'
--   SELECT sgtd_set_modulo_organizacion('3c09a31b-...', 'bitacora', false);
--   esperado: EXCEPTION 'El módulo "bitacora" es obligatorio...'

-- T5 (dueño): módulo inválido
--   SELECT sgtd_set_modulo_organizacion('3c09a...', 'inventado', true);
--   esperado: EXCEPTION 'Módulo "inventado" no válido.'

-- T6 (NO-dueño, ej. agamarra): listar o setear
--   esperado: EXCEPTION 'No tienes permiso...' en ambas

-- T7 (regresión): un módulo desactivado se OCULTA pero los datos persisten
--   Desactivar 'objetivos' → la org no muestra objetivos en nav, pero las filas
--   de objetivo siguen en BD. Reactivar → vuelven a verse.


-- =============================================================================
-- ROLLBACK — solo staging
-- =============================================================================
-- DROP FUNCTION IF EXISTS public.sgtd_set_modulo_organizacion(uuid, text, boolean);
-- DROP FUNCTION IF EXISTS public.sgtd_listar_modulos_organizacion(uuid);


-- =============================================================================
-- POST-MIGRACIÓN: checklist
-- =============================================================================
-- [ ] Ejecutar T1–T7 (sobre todo T4: bitacora protegida; T6: no-dueño rechazado)
-- [ ] Frontend Parte 3:
--     - api/plataforma.ts (o api/modulos.ts): fetchModulosOrg() + setModuloOrg()
--     - Modal "Gestionar módulos" desde cada fila de org en /panel
--     - Checkboxes con estado actual; bitacora siempre marcada y bloqueada
--     - Al togglear: llamar setModuloOrg, refrescar el listado
-- =============================================================================