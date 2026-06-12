-- =============================================================================
-- Migración 049 — Gestión de usuarios: listar + asignar a organización
-- =============================================================================
-- Descripción : Parte 2 del panel del dueño. Dos RPCs (solo plataforma_owner):
--
--   1. sgtd_listar_usuarios_plataforma()
--      Devuelve todos los usuarios activos del sistema con las organizaciones
--      donde ya tienen membresía de workspace. Para que el dueño vea a quién
--      asignar y quién ya está asignado. (El dueño no puede listar usuarios
--      por RLS directa; las políticas de `usuario` son por workspace.)
--
--   2. sgtd_asignar_usuario_a_organizacion(p_usuario_id, p_organizacion_id, p_rol)
--      Asigna un usuario YA REGISTRADO a UNA organización con rol 'jefe'|'miembro'.
--      Inserta solo en workspace_member (rol operativo). NO toca organizacion_member
--      (eso es para org_admin estructural, fuera de alcance de v1).
--      Con ON CONFLICT: si ya estaba, actualiza el rol (permite jefe<->miembro).
--
-- MODELO (aclarado en investigación):
--   - organizacion_member.rol = SOLO 'org_admin' (admin estructural)
--   - workspace_member.rol    = 'jefe' | 'miembro' (rol operativo)
--   → asignar jefe/miembro = workspace_member únicamente.
--
-- FLUJO COMPLETO (3 pasos):
--   1. (manual, panel InsForge) crear cuenta auth: correo + contraseña temporal
--   2. el usuario entra una vez → asegurarUsuario crea su fila en public.usuario
--   3. el dueño asigna vía esta RPC → workspace_member → el usuario entra a su org
--
-- Prerequisito : Migraciones 043–048 aplicadas.
-- Seguridad    : SECURITY DEFINER + gate sgtd_es_plataforma_owner() en ambas.
-- Reversible   : Ver ROLLBACK al final.
--
-- Identificador de validación:
--   SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
--     WHERE n.nspname='public' AND p.proname='sgtd_asignar_usuario_a_organizacion')
--     AS asignar_049_ok;
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- RPC 1 — Listar usuarios de plataforma (solo dueño)
-- Devuelve usuarios activos + las orgs donde ya tienen workspace_member activo.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_listar_usuarios_plataforma()
RETURNS TABLE (
  usuario_id   uuid,
  nombre       text,
  email        text,
  activo       boolean,
  created_at   timestamptz,
  orgs         jsonb      -- [{organizacion_id, organizacion_nombre, workspace_id, rol}]
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.sgtd_es_plataforma_owner() THEN
    RAISE EXCEPTION 'No tienes permiso para listar usuarios.' USING ERRCODE = 'P0007';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.nombre,
    u.email,
    u.activo,
    u.created_at,
    COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object(
          'organizacion_id',     o.id,
          'organizacion_nombre', o.nombre,
          'workspace_id',        w.id,
          'rol',                 wm.rol
        ) ORDER BY o.nombre)
        FROM public.workspace_member wm
        JOIN public.workspace w    ON w.id = wm.workspace_id
        JOIN public.organizacion o ON o.id = w.organizacion_id
        WHERE wm.usuario_id = u.id
          AND wm.activo = true
          AND wm.joined_at IS NOT NULL
          AND w.activo = true
          AND o.activa = true
      ),
      '[]'::jsonb
    ) AS orgs
  FROM public.usuario u
  WHERE u.activo = true
  ORDER BY u.nombre;
END;
$$;

REVOKE ALL ON FUNCTION public.sgtd_listar_usuarios_plataforma() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_listar_usuarios_plataforma() TO authenticated;

COMMENT ON FUNCTION public.sgtd_listar_usuarios_plataforma IS
  'V5 049: lista usuarios activos + sus orgs (solo plataforma_owner). Para el panel de asignación.';

-- ---------------------------------------------------------------------------
-- RPC 2 — Asignar usuario a una organización (solo dueño)
-- Inserta en workspace_member del workspace principal de la org.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_asignar_usuario_a_organizacion(
  p_usuario_id        uuid,
  p_organizacion_id   uuid,
  p_rol               text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ws_id uuid;
BEGIN
  -- Gate de dueño
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.sgtd_es_plataforma_owner() THEN
    RAISE EXCEPTION 'No tienes permiso para asignar usuarios.' USING ERRCODE = 'P0007';
  END IF;

  -- Rol válido
  IF p_rol NOT IN ('jefe', 'miembro') THEN
    RAISE EXCEPTION 'El rol debe ser "jefe" o "miembro".' USING ERRCODE = 'P0003';
  END IF;

  -- Usuario existe y activo
  IF NOT EXISTS (SELECT 1 FROM public.usuario WHERE id = p_usuario_id AND activo = true) THEN
    RAISE EXCEPTION 'El usuario no existe o está inactivo.' USING ERRCODE = 'P0002';
  END IF;

  -- Org existe y activa
  IF NOT EXISTS (SELECT 1 FROM public.organizacion WHERE id = p_organizacion_id AND activa = true) THEN
    RAISE EXCEPTION 'La organización no existe o está inactiva.' USING ERRCODE = 'P0002';
  END IF;

  -- Resolver el workspace principal de la org (primero activo; robusto si renombran)
  SELECT id INTO v_ws_id
  FROM public.workspace
  WHERE organizacion_id = p_organizacion_id
    AND activo = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_ws_id IS NULL THEN
    RAISE EXCEPTION 'La organización no tiene un espacio de trabajo activo.' USING ERRCODE = 'P0002';
  END IF;

  -- Asignar: insertar/actualizar membresía operativa
  INSERT INTO public.workspace_member (workspace_id, usuario_id, rol, joined_at, activo)
  VALUES (v_ws_id, p_usuario_id, p_rol, now(), true)
  ON CONFLICT (workspace_id, usuario_id) DO UPDATE SET
    rol       = EXCLUDED.rol,
    activo    = true,
    joined_at = COALESCE(public.workspace_member.joined_at, EXCLUDED.joined_at);

  RETURN jsonb_build_object(
    'usuario_id',      p_usuario_id,
    'organizacion_id', p_organizacion_id,
    'workspace_id',    v_ws_id,
    'rol',             p_rol
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sgtd_asignar_usuario_a_organizacion(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_asignar_usuario_a_organizacion(uuid, uuid, text) TO authenticated;

COMMENT ON FUNCTION public.sgtd_asignar_usuario_a_organizacion IS
  'V5 049: asigna usuario a una org con rol jefe/miembro en workspace_member (solo plataforma_owner). '
  'ON CONFLICT actualiza rol. NO toca organizacion_member (org_admin es aparte).';

COMMIT;


-- =============================================================================
-- SMOKE TESTS — ejecutar tras apply
-- =============================================================================
-- Contexto: dueño = a.guevaramartinez@gmail.com. Usuario de prueba a asignar:
-- alguno de los @nufago.com. Org destino: AGUEMAR (3c09a31b-...).

-- T1 (dueño): listar usuarios
--   SELECT * FROM sgtd_listar_usuarios_plataforma();
--   esperado: filas de todos los usuarios activos + columna orgs con sus membresías

-- T2 (NO-dueño, ej. agamarra): listar usuarios
--   SELECT * FROM sgtd_listar_usuarios_plataforma();
--   esperado: EXCEPTION 'No tienes permiso para listar usuarios.'

-- T3 (dueño): asignar un usuario a AGUEMAR como miembro
--   SELECT sgtd_asignar_usuario_a_organizacion('<uuid usuario>', '3c09a31b-...', 'miembro');
--   esperado: {usuario_id, organizacion_id, workspace_id, rol:'miembro'}
--   Verificar: SELECT * FROM workspace_member WHERE usuario_id='<uuid>' AND workspace_id=...
--   → fila con rol='miembro', activo=true, joined_at NOT NULL

-- T4 (dueño): reasignar el mismo usuario como jefe (cambio de rol)
--   SELECT sgtd_asignar_usuario_a_organizacion('<uuid usuario>', '3c09a31b-...', 'jefe');
--   esperado: rol actualizado a 'jefe' (ON CONFLICT), sin fila duplicada

-- T5 (dueño): rol inválido
--   SELECT sgtd_asignar_usuario_a_organizacion('<uuid>', '3c09a31b-...', 'admin');
--   esperado: EXCEPTION 'El rol debe ser "jefe" o "miembro".'

-- T6 (NO-dueño): intentar asignar
--   (logueado como agamarra) SELECT sgtd_asignar_usuario_a_organizacion(...);
--   esperado: EXCEPTION 'No tienes permiso para asignar usuarios.'

-- T7 (dueño): asignar a org inexistente o usuario inexistente
--   esperado: EXCEPTION correspondiente (P0002)

-- T8 (regresión): el usuario asignado, al entrar a la app, ¿ve la org asignada?
--   Login con ese usuario → debe aparecer la org en su lista y poder operar.


-- =============================================================================
-- ROLLBACK — solo staging
-- =============================================================================
-- DROP FUNCTION IF EXISTS public.sgtd_asignar_usuario_a_organizacion(uuid, uuid, text);
-- DROP FUNCTION IF EXISTS public.sgtd_listar_usuarios_plataforma();
-- (No deja datos residuales salvo las membresías ya asignadas, que persisten.)


-- =============================================================================
-- POST-MIGRACIÓN: checklist
-- =============================================================================
-- [ ] Ejecutar T1–T8 (sobre todo T2/T6: no-dueños rechazados)
-- [ ] Frontend Parte 2:
--     - api/plataforma.ts: fetchUsuariosPlataforma() + asignarUsuarioAOrg()
--     - pages/PanelUsuarios.tsx (o sección en el panel): lista usuarios + asignar
--     - Mostrar para cada usuario sus orgs actuales (columna orgs del listado)
--     - Selector de org + rol al asignar
-- [ ] Probar flujo completo: crear cuenta en InsForge → login del usuario →
--     asignar desde panel → el usuario refresca y ve su org
-- =============================================================================