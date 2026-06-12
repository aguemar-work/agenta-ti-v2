-- =============================================================================
-- Migración 045 — Módulos libres (sin enforcement por tipo de workspace)
-- =============================================================================
-- Descripción : Elimina la restricción módulo↔tipo introducida en 044.
--               Cualquier workspace puede activar cualquier módulo libremente.
--               El campo workspace.tipo queda como etiqueta informativa, sin
--               poder de restricción. Las políticas RLS de cliente/proyecto/area
--               pasan a depender del módulo activo, no del tipo.
--
-- Motivo : El modelo "interno vs agencia" no encaja con organizaciones reales.
--          Una panadería puede necesitar áreas + clientes + órdenes a la vez.
--          Cada organización arma su propia combinación de módulos.
--
-- Prerequisito : Migración 044 aplicada.
-- Reversible   : Ver sección ROLLBACK al final.
-- Checklist    : Marcar Dev/Staging/Prod en CONTEXT.mdc §12 al aplicar.
--
-- Identificador de validación:
--   SELECT NOT EXISTS (
--     SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
--     WHERE n.nspname='public' AND p.proname='sgtd_modulo_valido_para_tipo'
--   ) AS enforcement_removido_045;
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- PASO 1 — Quitar el enforcement módulo↔tipo del trigger de workspace_modulo
-- El trigger se conserva SOLO para mantener updated_at y proteger obligatorios.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.workspace_modulo_validar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Ya NO se valida módulo vs tipo de workspace (045: módulos libres).

  -- Módulos obligatorios no se pueden desactivar (se conserva de 044)
  IF TG_OP = 'UPDATE'
     AND NEW.modulo IN ('objetivos', 'bitacora')
     AND NEW.activo = false THEN
    RAISE EXCEPTION 'El módulo "%" es obligatorio y no se puede desactivar.', NEW.modulo
      USING ERRCODE = 'P0002';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END; $$;

-- La función auxiliar ya no se usa en el trigger. Se elimina.
DROP FUNCTION IF EXISTS public.sgtd_modulo_valido_para_tipo(text, text);

-- ---------------------------------------------------------------------------
-- PASO 2 — RLS de cliente/proyecto/area: depender del módulo, no del tipo
-- Antes (044): exigían (SELECT tipo FROM workspace ...) = 'agencia'.
-- Ahora (045): exigen que el módulo correspondiente esté activo.
-- ---------------------------------------------------------------------------

-- cliente → módulo 'clientes'
DROP POLICY IF EXISTS cliente_insert ON public.cliente;
CREATE POLICY cliente_insert ON public.cliente
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_workspace_tiene_modulo(workspace_id, 'clientes')
    AND (sgtd_es_jefe() OR sgtd_es_org_admin((SELECT organizacion_id FROM public.workspace WHERE id = workspace_id)))
  );

-- proyecto → módulo 'proyectos'
DROP POLICY IF EXISTS proyecto_insert ON public.proyecto;
CREATE POLICY proyecto_insert ON public.proyecto
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_workspace_tiene_modulo(workspace_id, 'proyectos')
    AND (sgtd_es_jefe() OR sgtd_es_org_admin((SELECT organizacion_id FROM public.workspace WHERE id = workspace_id)))
  );

-- area → módulo 'areas'
DROP POLICY IF EXISTS area_insert ON public.area;
CREATE POLICY area_insert ON public.area
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_workspace_tiene_modulo(workspace_id, 'areas')
    AND (sgtd_es_jefe() OR sgtd_es_org_admin((SELECT organizacion_id FROM public.workspace WHERE id = workspace_id)))
  );

-- Las políticas _select y _update de estas tablas NO mencionaban tipo
-- (solo workspace_id + acceso), así que se dejan como están en 044.

-- ---------------------------------------------------------------------------
-- PASO 3 — RLS de orden_trabajo: depender del módulo, no de tipo='interno'
-- En 044 las 4 políticas de OT exigían tipo='interno'. Se reemplazan por
-- "módulo ordenes_trabajo activo".
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS sgtd_jefe_ot_all      ON public.orden_trabajo;
DROP POLICY IF EXISTS sgtd_miembro_ot_select ON public.orden_trabajo;
DROP POLICY IF EXISTS sgtd_miembro_ot_insert ON public.orden_trabajo;
DROP POLICY IF EXISTS sgtd_miembro_ot_update ON public.orden_trabajo;
DROP POLICY IF EXISTS sgtd_miembro_ot_delete ON public.orden_trabajo;

CREATE POLICY sgtd_jefe_ot_all ON public.orden_trabajo
  FOR ALL TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
    AND sgtd_workspace_tiene_modulo(workspace_id, 'ordenes_trabajo')
  )
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
    AND sgtd_workspace_tiene_modulo(workspace_id, 'ordenes_trabajo')
  );

CREATE POLICY sgtd_miembro_ot_select ON public.orden_trabajo
  FOR SELECT TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND creado_por = auth.uid()
    AND sgtd_workspace_tiene_modulo(workspace_id, 'ordenes_trabajo')
  );

CREATE POLICY sgtd_miembro_ot_insert ON public.orden_trabajo
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND creado_por   = auth.uid()
    AND estado       IN ('borrador', 'pendiente')
    AND aprobado_por IS NULL
    AND sgtd_workspace_tiene_modulo(workspace_id, 'ordenes_trabajo')
  );

CREATE POLICY sgtd_miembro_ot_update ON public.orden_trabajo
  FOR UPDATE TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND creado_por = auth.uid()
    AND estado     IN ('borrador', 'rechazada')
    AND sgtd_workspace_tiene_modulo(workspace_id, 'ordenes_trabajo')
  )
  WITH CHECK (creado_por = auth.uid() AND aprobado_por IS NULL);

CREATE POLICY sgtd_miembro_ot_delete ON public.orden_trabajo
  FOR DELETE TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND creado_por = auth.uid()
    AND estado     = 'borrador'
    AND sgtd_workspace_tiene_modulo(workspace_id, 'ordenes_trabajo')
  );

-- ---------------------------------------------------------------------------
-- PASO 4 — trigger tarea_agencia_integridad: quitar la restricción por tipo
-- En 044 (creado en 043) rechazaba cliente/proyecto/area si tipo='interno'.
-- Ahora valida solo que las FKs pertenezcan al mismo workspace.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tarea_agencia_integridad()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Ya NO se valida contra workspace.tipo (045: módulos libres).
  -- Solo se valida coherencia de workspace en las FKs.

  IF NEW.cliente_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cliente WHERE id = NEW.cliente_id AND workspace_id = NEW.workspace_id
  ) THEN RAISE EXCEPTION 'cliente_id no pertenece al workspace de la tarea.'; END IF;

  IF NEW.proyecto_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.proyecto WHERE id = NEW.proyecto_id AND workspace_id = NEW.workspace_id
  ) THEN RAISE EXCEPTION 'proyecto_id no pertenece al workspace de la tarea.'; END IF;

  IF NEW.area_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.area WHERE id = NEW.area_id AND workspace_id = NEW.workspace_id
  ) THEN RAISE EXCEPTION 'area_id no pertenece al workspace de la tarea.'; END IF;

  RETURN NEW;
END; $$;

-- ---------------------------------------------------------------------------
-- PASO 5 — sgtd_crear_organizacion: no filtrar módulos por tipo
-- Acepta cualquier módulo del catálogo; solo fuerza objetivos + bitacora.
-- El parámetro p_tipo_workspace se conserva como etiqueta (default 'interno').
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_crear_organizacion(
  p_nombre           text,
  p_slug             text,
  p_tipo_workspace   text   DEFAULT 'interno',
  p_modulos          text[] DEFAULT ARRAY[]::text[]
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
  IF NOT EXISTS (SELECT 1 FROM public.usuario WHERE id = v_uid AND (activo = true OR activo IS NULL)) THEN
    RAISE EXCEPTION 'Usuario no existe o está inactivo.' USING ERRCODE = 'P0002';
  END IF;
  IF btrim(coalesce(p_nombre, '')) = '' THEN
    RAISE EXCEPTION 'El nombre de la organización no puede estar vacío.' USING ERRCODE = 'P0003';
  END IF;
  IF p_tipo_workspace NOT IN ('interno', 'agencia') THEN
    RAISE EXCEPTION 'tipo_workspace debe ser "interno" o "agencia".' USING ERRCODE = 'P0004';
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

  INSERT INTO public.workspace (organizacion_id, nombre, tipo)
  VALUES (v_org_id, 'Principal', p_tipo_workspace)
  RETURNING id INTO v_ws_id;

  INSERT INTO public.organizacion_member (organizacion_id, usuario_id, rol)
  VALUES (v_org_id, v_uid, 'org_admin');

  INSERT INTO public.workspace_member (workspace_id, usuario_id, rol, joined_at)
  VALUES (v_ws_id, v_uid, 'jefe', now());

  -- Módulos: forzar obligatorios + aceptar cualquier módulo válido del catálogo
  -- (045: SIN filtro por tipo)
  v_modulos_final := ARRAY(
    SELECT DISTINCT m FROM unnest(
      array_cat(coalesce(p_modulos, ARRAY[]::text[]), ARRAY['objetivos', 'bitacora'])
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

REVOKE ALL ON FUNCTION public.sgtd_crear_organizacion(text, text, text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_crear_organizacion(text, text, text, text[]) TO authenticated;

COMMENT ON FUNCTION public.sgtd_crear_organizacion IS
  'V5 045: crea org+workspace+membresías+módulos. Módulos LIBRES (sin filtro por tipo). '
  'Fuerza objetivos+bitacora. Caller queda org_admin y jefe.';

COMMIT;


-- =============================================================================
-- SMOKE TESTS — ejecutar tras apply
-- =============================================================================

-- T1: enforcement removido
-- SELECT NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
--   WHERE n.nspname='public' AND p.proname='sgtd_modulo_valido_para_tipo') AS ok;  -- true

-- T2: activar 'clientes' en un workspace interno ahora FUNCIONA (antes fallaba)
-- INSERT INTO workspace_modulo (workspace_id, modulo) VALUES ('<ws_interno>', 'clientes');
-- esperado: insert OK, sin excepción

-- T3: módulos obligatorios siguen protegidos (no desactivables)
-- UPDATE workspace_modulo SET activo=false WHERE workspace_id='<ws>' AND modulo='objetivos';
-- esperado: EXCEPTION 'obligatorio'

-- T4: crear org con cualquier combinación (ej. panadería: areas+clientes+ordenes)
-- SELECT sgtd_crear_organizacion('JUANITO PAN', 'juanito-pan', 'interno',
--   ARRAY['areas','clientes','ordenes_trabajo']);
-- esperado: modulos incluye areas, clientes, ordenes_trabajo, objetivos, bitacora

-- T5: crear tarea con area_id en cualquier workspace (antes fallaba si interno)
-- (requiere area existente en el mismo workspace)


-- =============================================================================
-- ROLLBACK — solo staging (restaura enforcement de 044)
-- =============================================================================
-- Para revertir habría que recrear sgtd_modulo_valido_para_tipo, restaurar
-- el trigger workspace_modulo_validar con la validación por tipo, y volver
-- las políticas de cliente/proyecto/area/orden_trabajo a exigir tipo.
-- Ver migración 044 para el cuerpo original de cada objeto.


-- =============================================================================
-- POST-MIGRACIÓN: checklist
-- =============================================================================
-- [x] Ejecutar T1–T5 en dev
-- [ ] Confirmar que el workspace DELIZIE existente sigue con sus módulos
-- [x] Marcar 045 ✅ en CONTEXT.mdc §12
-- [x] Actualizar MATEREN-V5-WORKSPACE.md: módulos libres, tipo = etiqueta
-- [ ] Frontend: el formulario de crear org ya no filtra módulos por tipo (cuando exista UI)
-- =============================================================================