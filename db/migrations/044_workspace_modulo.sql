-- =============================================================================
-- Migración 044 — Módulos configurables por workspace (Materen V5)
-- =============================================================================
-- Descripción : Introduce workspace_modulo para que cada workspace declare
--               qué funcionalidades activa. Incluye RPC de bootstrap de org
--               y backfill por tipo de workspace.
--
-- Prerequisito : Migración 043 aplicada (workspace + RLS V5 operativos).
-- Numeración   : 044 es el siguiente número libre real del repo (último: 043).
--                La doc reservaba "044 = drop usuario.rol"; eso va en 046.
--                045 = invitaciones · 047 = catálogos agencia (pendientes).
-- Reversible   : Ver sección ROLLBACK al final.
-- Checklist    : Marcar Dev/Staging/Prod en CONTEXT.mdc §12 al aplicar.
--
-- DECISIÓN DE CATÁLOGO (resuelve obs. #6):
--   - /semana (Mi Semana) = CORE, siempre activo, NO es módulo configurable.
--   - /planificacion y /metricas = control por ROL (jefe), NO por módulo.
--   - Módulos configurables = solo features de dominio opcionales:
--     areas, proyectos, clientes (agencia) · ordenes_trabajo (interno) ·
--     objetivos, bitacora (ambos, obligatorios).
--
-- ENFORCEMENT módulo vs tipo de workspace (resuelve obs. #4):
--   - areas, proyectos, clientes  → solo workspace tipo 'agencia'
--   - ordenes_trabajo             → solo workspace tipo 'interno'
--   - objetivos, bitacora         → ambos (obligatorios)
--
-- Identificador de validación:
--   SELECT EXISTS (SELECT 1 FROM information_schema.tables
--     WHERE table_schema='public' AND table_name='workspace_modulo') AS modulo_044_ok;
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- TABLA: workspace_modulo
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_modulo (
  workspace_id  uuid        NOT NULL REFERENCES public.workspace (id) ON DELETE CASCADE,
  modulo        text        NOT NULL,
  activo        boolean     NOT NULL DEFAULT true,
  activado_en   timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, modulo),
  CONSTRAINT workspace_modulo_modulo_check CHECK (modulo IN (
    'areas',
    'proyectos',
    'clientes',
    'ordenes_trabajo',
    'objetivos',
    'bitacora'
  ))
);

COMMENT ON TABLE  public.workspace_modulo         IS
  'Módulos de dominio opcionales por workspace. NO incluye core (/semana siempre activo) '
  'ni vistas por rol (/planificacion, /metricas = control por rol jefe).';
COMMENT ON COLUMN public.workspace_modulo.modulo  IS 'Clave del módulo. Catálogo fijo — ampliar con nueva migración.';
COMMENT ON COLUMN public.workspace_modulo.activo  IS 'false = módulo desactivado (datos se conservan, solo se oculta UI).';

CREATE INDEX IF NOT EXISTS idx_workspace_modulo_ws ON public.workspace_modulo (workspace_id);

-- GRANT explícito (resuelve obs. #9)
GRANT SELECT, INSERT, UPDATE ON public.workspace_modulo TO authenticated;

-- ---------------------------------------------------------------------------
-- FUNCIÓN auxiliar: validar módulo permitido según tipo de workspace
-- (resuelve obs. #4 — enforcement)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_modulo_valido_para_tipo(
  p_modulo text,
  p_tipo   text
)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_modulo IN ('objetivos', 'bitacora')              THEN true
    WHEN p_modulo IN ('areas', 'proyectos', 'clientes')     THEN p_tipo = 'agencia'
    WHEN p_modulo = 'ordenes_trabajo'                       THEN p_tipo = 'interno'
    ELSE false
  END;
$$;

COMMENT ON FUNCTION public.sgtd_modulo_valido_para_tipo IS
  'Reglas módulo↔tipo: areas/proyectos/clientes→agencia, ordenes_trabajo→interno, objetivos/bitacora→ambos.';

-- ---------------------------------------------------------------------------
-- TRIGGER: enforcement módulo vs tipo de workspace + updated_at
-- (resuelve obs. #4 enforcement y #10 trigger)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.workspace_modulo_validar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tipo text;
BEGIN
  SELECT tipo INTO v_tipo FROM public.workspace WHERE id = NEW.workspace_id;

  IF NOT public.sgtd_modulo_valido_para_tipo(NEW.modulo, v_tipo) THEN
    RAISE EXCEPTION 'Módulo "%" no es válido para workspace tipo "%".', NEW.modulo, v_tipo
      USING ERRCODE = 'P0001';
  END IF;

  -- Módulos obligatorios no se pueden desactivar (resuelve obs. #3)
  IF TG_OP = 'UPDATE'
     AND NEW.modulo IN ('objetivos', 'bitacora')
     AND NEW.activo = false THEN
    RAISE EXCEPTION 'El módulo "%" es obligatorio y no se puede desactivar.', NEW.modulo
      USING ERRCODE = 'P0002';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS workspace_modulo_validar_trigger ON public.workspace_modulo;
CREATE TRIGGER workspace_modulo_validar_trigger
  BEFORE INSERT OR UPDATE ON public.workspace_modulo
  FOR EACH ROW EXECUTE FUNCTION public.workspace_modulo_validar();

-- ---------------------------------------------------------------------------
-- RLS (resuelve obs. #2 org_admin en SELECT, #8 TO authenticated)
-- ---------------------------------------------------------------------------
ALTER TABLE public.workspace_modulo ENABLE ROW LEVEL SECURITY;

-- SELECT: miembro del ws O org_admin (mismo patrón que workspace_select en 043)
CREATE POLICY ws_modulo_select ON public.workspace_modulo
  FOR SELECT TO authenticated
  USING (
    sgtd_puede_acceder_workspace(workspace_id)
    OR sgtd_es_org_admin((SELECT organizacion_id FROM public.workspace WHERE id = workspace_id))
  );

-- INSERT: jefe del ws activo O org_admin
CREATE POLICY ws_modulo_insert ON public.workspace_modulo
  FOR INSERT TO authenticated
  WITH CHECK (
    (workspace_id = sgtd_workspace_id() AND sgtd_es_jefe())
    OR sgtd_es_org_admin((SELECT organizacion_id FROM public.workspace WHERE id = workspace_id))
  );

-- UPDATE: jefe del ws activo O org_admin
CREATE POLICY ws_modulo_update ON public.workspace_modulo
  FOR UPDATE TO authenticated
  USING (
    (workspace_id = sgtd_workspace_id() AND sgtd_es_jefe())
    OR sgtd_es_org_admin((SELECT organizacion_id FROM public.workspace WHERE id = workspace_id))
  )
  WITH CHECK (
    (workspace_id = sgtd_workspace_id() AND sgtd_es_jefe())
    OR sgtd_es_org_admin((SELECT organizacion_id FROM public.workspace WHERE id = workspace_id))
  );

-- ---------------------------------------------------------------------------
-- FUNCIÓN: sgtd_workspace_tiene_modulo(workspace_id, modulo)
-- (resuelve obs. #7 — acota acceso al workspace del caller)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_workspace_tiene_modulo(
  p_workspace_id uuid,
  p_modulo       text
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_modulo wm
    WHERE wm.workspace_id = p_workspace_id
      AND wm.modulo        = p_modulo
      AND wm.activo        = true
      -- Solo responde si el caller tiene acceso al workspace consultado
      AND (
        public.sgtd_puede_acceder_workspace(p_workspace_id)
        OR public.sgtd_es_org_admin((SELECT organizacion_id FROM public.workspace WHERE id = p_workspace_id))
      )
  );
$$;

REVOKE ALL ON FUNCTION public.sgtd_workspace_tiene_modulo(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_workspace_tiene_modulo(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.sgtd_workspace_tiene_modulo IS
  'true si el workspace tiene el módulo activo Y el caller tiene acceso a ese workspace.';

-- ---------------------------------------------------------------------------
-- FUNCIÓN: sgtd_crear_organizacion(...) — SECURITY DEFINER
-- (resuelve obs. #1 huevo-y-gallina y #5 módulos obligatorios)
--
-- SECURITY DEFINER: omite las políticas RLS de 043 durante la creación,
-- evitando el deadlock org_admin. Validaciones de identidad explícitas dentro.
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
BEGIN
  -- Identidad: debe haber un usuario autenticado real
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.usuario WHERE id = v_uid AND (activo = true OR activo IS NULL)) THEN
    RAISE EXCEPTION 'Usuario no existe o está inactivo.' USING ERRCODE = 'P0002';
  END IF;

  -- Validaciones de entrada
  IF btrim(coalesce(p_nombre, '')) = '' THEN
    RAISE EXCEPTION 'El nombre de la organización no puede estar vacío.' USING ERRCODE = 'P0003';
  END IF;
  IF p_tipo_workspace NOT IN ('interno', 'agencia') THEN
    RAISE EXCEPTION 'tipo_workspace debe ser "interno" o "agencia".' USING ERRCODE = 'P0004';
  END IF;
  IF p_slug !~ '^[a-z0-9\-]+$' THEN
    RAISE EXCEPTION 'El slug solo permite minúsculas, números y guiones.' USING ERRCODE = 'P0005';
  END IF;

  -- 1. Organización (captura slug duplicado con mensaje claro — obs. #2)
  BEGIN
    INSERT INTO public.organizacion (nombre, slug)
    VALUES (btrim(p_nombre), btrim(p_slug))
    RETURNING id INTO v_org_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Ya existe una organización con el slug "%". Elige otro.', btrim(p_slug)
      USING ERRCODE = 'P0006';
  END;

  -- 2. Workspace principal
  INSERT INTO public.workspace (organizacion_id, nombre, tipo)
  VALUES (v_org_id, 'Principal', p_tipo_workspace)
  RETURNING id INTO v_ws_id;

  -- 3. Caller = org_admin
  INSERT INTO public.organizacion_member (organizacion_id, usuario_id, rol)
  VALUES (v_org_id, v_uid, 'org_admin');

  -- 4. Caller = jefe del workspace
  INSERT INTO public.workspace_member (workspace_id, usuario_id, rol, joined_at)
  VALUES (v_ws_id, v_uid, 'jefe', now());

  -- 5. Módulos: forzar obligatorios (objetivos + bitacora) y filtrar por tipo
  --    (resuelve obs. #5 — obligatorios garantizados)
  v_modulos_final := ARRAY(
    SELECT DISTINCT m FROM unnest(
      array_cat(coalesce(p_modulos, ARRAY[]::text[]), ARRAY['objetivos', 'bitacora'])
    ) AS m
    WHERE public.sgtd_modulo_valido_para_tipo(m, p_tipo_workspace)
  );

  FOREACH v_modulo IN ARRAY v_modulos_final LOOP
    INSERT INTO public.workspace_modulo (workspace_id, modulo, activo)
    VALUES (v_ws_id, v_modulo, true)
    ON CONFLICT (workspace_id, modulo) DO NOTHING;
  END LOOP;

  -- 6. Preferencia → nuevo workspace
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
  'SECURITY DEFINER: crea org+workspace+membresías+módulos atómicamente, evitando '
  'el deadlock org_admin de RLS. Fuerza objetivos+bitacora. Filtra módulos por tipo. '
  'Caller queda org_admin y jefe. Retorna {organizacion_id, workspace_id, modulos}.';

-- ---------------------------------------------------------------------------
-- BACKFILL: workspaces existentes reciben módulos según su tipo
-- (resuelve obs. #4 — interno SIN areas, y #11 — comentario generalizado)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_ws record;
  v_modulos_interno text[] := ARRAY['ordenes_trabajo', 'objetivos', 'bitacora'];
  v_modulos_agencia text[] := ARRAY['areas', 'proyectos', 'clientes', 'objetivos', 'bitacora'];
  v_modulo text;
BEGIN
  FOR v_ws IN SELECT id, tipo FROM public.workspace LOOP
    FOREACH v_modulo IN ARRAY
      CASE v_ws.tipo WHEN 'interno' THEN v_modulos_interno ELSE v_modulos_agencia END
    LOOP
      INSERT INTO public.workspace_modulo (workspace_id, modulo, activo)
      VALUES (v_ws.id, v_modulo, true)
      ON CONFLICT (workspace_id, modulo) DO NOTHING;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Backfill workspace_modulo OK';
END $$;

COMMIT;


-- =============================================================================
-- SMOKE TESTS — ejecutar tras apply
-- =============================================================================

-- T1: tabla existe
-- SELECT EXISTS (SELECT 1 FROM information_schema.tables
--   WHERE table_schema='public' AND table_name='workspace_modulo') AS ok;  -- true

-- T2: módulos del workspace interno existente (NO debe incluir 'areas')
-- SELECT modulo, activo FROM workspace_modulo WHERE workspace_id = '<ws_id_interno>';
-- esperado: ordenes_trabajo, objetivos, bitacora

-- T3: función con verificación de acceso
-- SELECT sgtd_workspace_tiene_modulo('<ws_id>', 'objetivos');  -- true si tiene acceso

-- T4: enforcement módulo vs tipo — INSERT 'clientes' en ws interno debe FALLAR
-- INSERT INTO workspace_modulo (workspace_id, modulo) VALUES ('<ws_interno>', 'clientes');
-- esperado: EXCEPTION 'Módulo "clientes" no es válido para workspace tipo "interno"'

-- T5: RPC crear org (autenticado, ahora SÍ pasa por el deadlock RLS)
-- SELECT sgtd_crear_organizacion('FREELANCE', 'freelance', 'agencia',
--   ARRAY['clientes','proyectos','areas']);
-- esperado: {organizacion_id, workspace_id, modulos:[clientes,proyectos,areas,objetivos,bitacora]}
-- (objetivos+bitacora forzados aunque no se pasen)

-- T6: RPC con módulos vacíos → igual fuerza objetivos+bitacora
-- SELECT sgtd_crear_organizacion('TEST', 'test-org', 'interno', ARRAY[]::text[]);
-- esperado: modulos incluye al menos objetivos, bitacora

-- T7: miembro (no jefe) no puede INSERT → RLS lo rechaza

-- T8: desactivar módulo obligatorio debe FALLAR (obs. #3)
-- UPDATE workspace_modulo SET activo=false WHERE workspace_id='<ws>' AND modulo='objetivos';
-- esperado: EXCEPTION 'El módulo "objetivos" es obligatorio y no se puede desactivar'

-- T9: slug duplicado en RPC da mensaje claro (obs. #2)
-- SELECT sgtd_crear_organizacion('Otra', '<slug_ya_existente>', 'interno', ARRAY[]::text[]);
-- esperado: EXCEPTION 'Ya existe una organización con el slug "..."'


-- =============================================================================
-- ROLLBACK — solo staging
-- =============================================================================

-- DROP FUNCTION IF EXISTS public.sgtd_crear_organizacion(text, text, text, text[]);
-- DROP FUNCTION IF EXISTS public.sgtd_workspace_tiene_modulo(uuid, text);
-- DROP TRIGGER IF EXISTS workspace_modulo_validar_trigger ON public.workspace_modulo;
-- DROP FUNCTION IF EXISTS public.workspace_modulo_validar();
-- DROP FUNCTION IF EXISTS public.sgtd_modulo_valido_para_tipo(text, text);
-- DROP TABLE IF EXISTS public.workspace_modulo CASCADE;


-- =============================================================================
-- POST-MIGRACIÓN: checklist
-- =============================================================================
-- [ ] Ejecutar T1–T9 en dev
-- [ ] Verificar backfill: ws interno SIN areas, ws agencia con catálogo agencia
-- [ ] Marcar 043 ✅ y 044 ✅ en CONTEXT.mdc §12 (Dev verificado)
-- [ ] Agregar en workspaceStore: modulos[] + tieneModulo(clave)
-- [ ] Cargar módulos en WorkspaceProvider.bootstrap()
-- [ ] Filtrar nav AppShell por módulos activos (NO /semana, control rol en /planif y /metricas)
-- [ ] Actualizar web/CONTEXT/MATEREN-V5-WORKSPACE.md §11 con el catálogo final
-- =============================================================================