-- =============================================================================
-- Migración 047 — Dueño de plataforma + Objetivos opcional
-- =============================================================================
-- Descripción : Dos cambios de modelo decididos tras pruebas con varios usuarios:
--
--   1) Solo el "dueño de plataforma" puede CREAR organizaciones. Hoy cualquier
--      usuario autenticado podía hacerlo. Se introduce una tabla plataforma_owner
--      + función sgtd_es_plataforma_owner(), y se restringe la RPC de creación
--      y la política de INSERT. Extensible: liberar a más usuarios = más filas.
--
--   2) El módulo "objetivos" deja de ser obligatorio. Solo "bitacora" (Notas)
--      queda como módulo siempre incluido. Objetivos pasa a opcional mientras se
--      define mejor su rol (relación con proyectos, etc.).
--
-- Dueño inicial : a.guevaramartinez@gmail.com (f5d5d06c-317a-4ee7-9cb2-1f8a816bf7b0)
-- Nota          : gmail.com ya fue autorizado en sgtd_config; se versiona aquí
--                 para que staging/prod queden consistentes.
--
-- Prerequisito : Migraciones 043, 044, 045, 046 aplicadas.
--                El usuario dueño debe existir en public.usuario (login previo).
-- Reversible   : Ver ROLLBACK al final.
--
-- Identificador de validación:
--   SELECT EXISTS (SELECT 1 FROM information_schema.tables
--     WHERE table_schema='public' AND table_name='plataforma_owner') AS owner_047_ok;
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- PASO 0 — Asegurar gmail.com autorizado (idempotente; ya hecho en dev)
-- ---------------------------------------------------------------------------
INSERT INTO public.sgtd_config (clave, valor, updated_at)
VALUES ('allowed_email_domain_2', 'gmail.com', now())
ON CONFLICT (clave) DO UPDATE
  SET valor = EXCLUDED.valor, updated_at = now();

-- ---------------------------------------------------------------------------
-- PASO 1 — Tabla de dueños de plataforma
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plataforma_owner (
  usuario_id  uuid PRIMARY KEY REFERENCES public.usuario(id) ON DELETE CASCADE,
  granted_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.plataforma_owner IS
  'Usuarios autorizados a crear organizaciones (dueños de plataforma). '
  'Liberar a más usuarios = agregar filas. Gestión solo vía SQL/migración por ahora.';

ALTER TABLE public.plataforma_owner ENABLE ROW LEVEL SECURITY;

-- Lectura: un usuario puede consultar si él mismo es dueño (para UX del frontend).
CREATE POLICY plataforma_owner_select_self ON public.plataforma_owner
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid());

-- Sin políticas de INSERT/UPDATE/DELETE para authenticated:
-- la tabla solo se modifica vía SQL/migración (o RPC futura guardada).

-- ---------------------------------------------------------------------------
-- PASO 2 — Seed del dueño inicial
-- ---------------------------------------------------------------------------
INSERT INTO public.plataforma_owner (usuario_id)
VALUES ('f5d5d06c-317a-4ee7-9cb2-1f8a816bf7b0')
ON CONFLICT (usuario_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- PASO 3 — Función helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_es_plataforma_owner()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.plataforma_owner WHERE usuario_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.sgtd_es_plataforma_owner() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_es_plataforma_owner() TO authenticated;

COMMENT ON FUNCTION public.sgtd_es_plataforma_owner IS
  'true si el usuario actual está en plataforma_owner (puede crear organizaciones).';

-- ---------------------------------------------------------------------------
-- PASO 4 — Restringir la política de INSERT de organizacion (defensa en profundidad)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS organizacion_insert ON public.organizacion;
CREATE POLICY organizacion_insert ON public.organizacion
  FOR INSERT TO authenticated
  WITH CHECK (public.sgtd_es_plataforma_owner());

-- ---------------------------------------------------------------------------
-- PASO 5 — sgtd_crear_organizacion: solo dueño + objetivos ya NO obligatorio
-- (recrea la de 045; mantiene SECURITY DEFINER y validaciones, agrega gate de dueño,
--  y cambia el array_cat para forzar SOLO 'bitacora')
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

  -- GATE DE DUEÑO: solo plataforma_owner puede crear organizaciones (047)
  IF NOT public.sgtd_es_plataforma_owner() THEN
    RAISE EXCEPTION 'No tienes permiso para crear organizaciones.' USING ERRCODE = 'P0007';
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

  -- Módulos: forzar SOLO 'bitacora' (047: objetivos ya no es obligatorio)
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

REVOKE ALL ON FUNCTION public.sgtd_crear_organizacion(text, text, text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_crear_organizacion(text, text, text, text[]) TO authenticated;

COMMENT ON FUNCTION public.sgtd_crear_organizacion IS
  'V5 047: solo plataforma_owner crea orgs. Fuerza solo bitacora obligatorio '
  '(objetivos ahora opcional). Caller queda org_admin y jefe.';

-- ---------------------------------------------------------------------------
-- PASO 6 — Trigger workspace_modulo_validar: solo 'bitacora' protegido
-- (objetivos ya se puede desactivar)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.workspace_modulo_validar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Solo 'bitacora' es obligatorio (047: objetivos dejó de serlo)
  IF TG_OP = 'UPDATE'
     AND NEW.modulo = 'bitacora'
     AND NEW.activo = false THEN
    RAISE EXCEPTION 'El módulo "bitacora" es obligatorio y no se puede desactivar.'
      USING ERRCODE = 'P0002';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END; $$;

COMMIT;


-- =============================================================================
-- SMOKE TESTS — ejecutar tras apply
-- =============================================================================

-- T1: tabla y seed
-- SELECT * FROM plataforma_owner;
-- esperado: 1 fila con f5d5d06c-...

-- T2: el dueño SÍ puede crear org (logueado como a.guevaramartinez@gmail.com)
-- SELECT sgtd_crear_organizacion('Prueba Owner', 'prueba-owner', 'interno', ARRAY['areas']);
-- esperado: {organizacion_id, workspace_id, modulos:[areas, bitacora]}
-- NOTA: modulos NO incluye 'objetivos' (ya no se fuerza)

-- T3: un usuario NO dueño NO puede crear org (logueado como agamarra@nufago.com)
-- SELECT sgtd_crear_organizacion('Intento', 'intento', 'interno', ARRAY[]::text[]);
-- esperado: EXCEPTION 'No tienes permiso para crear organizaciones.'

-- T4: objetivos se puede desactivar; bitacora NO
-- UPDATE workspace_modulo SET activo=false WHERE modulo='objetivos' AND workspace_id='<ws>';
-- esperado: OK (ya no es obligatorio)
-- UPDATE workspace_modulo SET activo=false WHERE modulo='bitacora' AND workspace_id='<ws>';
-- esperado: EXCEPTION 'El módulo "bitacora" es obligatorio...'

-- T5: helper
-- SELECT sgtd_es_plataforma_owner();  -- true si logueado como dueño, false si no


-- =============================================================================
-- ROLLBACK — solo staging
-- =============================================================================
-- DROP POLICY IF EXISTS organizacion_insert ON public.organizacion;
-- CREATE POLICY organizacion_insert ON public.organizacion
--   FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);  -- vuelve a 043
-- Recrear sgtd_crear_organizacion sin el gate y con ARRAY['objetivos','bitacora'] (045).
-- Recrear workspace_modulo_validar protegiendo objetivos+bitacora (045).
-- DROP FUNCTION IF EXISTS public.sgtd_es_plataforma_owner();
-- DROP TABLE IF EXISTS public.plataforma_owner;


-- =============================================================================
-- POST-MIGRACIÓN: checklist
-- =============================================================================
-- [ ] Ejecutar T1–T5
-- [ ] Login como a.guevaramartinez@gmail.com → crear una organización (debe funcionar)
-- [ ] Login como agamarra@nufago.com → intentar crear org (debe fallar con permiso)
-- [ ] Frontend: quitar dropdown "Tipo de espacio" del formulario crear org
-- [ ] Frontend: objetivos ya NO es "Incluido" — pasa a módulo destildable
-- [ ] Frontend: ocultar botón "Crear organización" si !sgtd_es_plataforma_owner (UX)
-- [ ] Frontend: pantalla de gestionar módulos para el jefe (RLS ya lo permite)
-- [ ] Prod: agregar gmail.com a VITE_ALLOWED_EMAIL_DOMAINS
-- =============================================================================