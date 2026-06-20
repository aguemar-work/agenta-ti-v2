-- =============================================================================
-- Migración 057 — Flujo de invitación con aceptación + hardening RLS
-- =============================================================================
-- Descripción : Cierra el circuito de invitación que quedó incompleto al migrar
--               de Supabase a InsForge. Introduce el modelo "joined_at NULL =
--               pendiente" de forma end-to-end.
--
-- Piezas añadidas:
--   1. ws_member_insert hardening: exige workspace_id = sgtd_workspace_id()
--      en la rama jefe (cierra bypass de ws ajeno por UUID).
--   2. sgtd_invitar_a_workspace  — invitar (owner o jefe en su ws).
--   3. sgtd_listar_invitaciones_pendientes — el invitado lista sus pendientes.
--   4. sgtd_aceptar_invitacion_workspace  — aceptar (joined_at = now()).
--   5. sgtd_rechazar_invitacion_workspace — declinar (activo = false).
--   6. sgtd_listar_usuarios_plataforma actualizada (también muestra pendientes).
--
-- Relación con otras migraciones:
--   - 043: define workspace_member (joined_at nullable, ws_member_insert policy).
--   - 048: bypass plataforma_owner → sgtd_es_jefe() retorna true para el owner.
--   - 049: sgtd_asignar_usuario_a_organizacion — **DEPRECADA desde 057**. Asignación
--          directa (joined_at=now()). El panel y los jefes deben usar sgtd_invitar_a_workspace
--          vía edge invite-user. La RPC 049 permanece en BD por compatibilidad histórica.
--   - 055: sgtd_crear_usuario_invitado queda como pieza interna usada por la
--          edge function; sgtd_invitar_a_workspace la absorbe (mismo efecto).
--
-- Prerequisito : Migraciones 043–056 aplicadas.
-- Idempotente  : Sí (CREATE OR REPLACE, DROP POLICY IF EXISTS).
-- Reversible   : Ver ROLLBACK al final (solo staging).
--
-- Identificador de validación:
--   SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
--     WHERE n.nspname='public' AND p.proname='sgtd_invitar_a_workspace') AS invitacion_057_ok;
-- =============================================================================

BEGIN;


-- =============================================================================
-- 1. Hardening ws_member_insert
-- =============================================================================
-- Antes (043): sgtd_es_jefe() sin restricción de workspace_id → un jefe del
--   ws A con el UUID del ws B podía insertar en ws B directamente via PostgREST.
-- Después (057): la rama jefe exige workspace_id = sgtd_workspace_id().
--   La rama org_admin (owner vía sgtd_es_org_admin) no se toca: el owner ya
--   pasa por sgtd_es_jefe() con su bypass de 048.
-- Nota: las RPCs SECURITY DEFINER de este archivo bypass RLS y no se ven
--   afectadas por esta política; el hardening protege inserts directos PostgREST.
-- =============================================================================

DROP POLICY IF EXISTS ws_member_insert ON public.workspace_member;

CREATE POLICY ws_member_insert ON public.workspace_member
  FOR INSERT WITH CHECK (
    sgtd_es_org_admin((SELECT organizacion_id FROM public.workspace WHERE id = workspace_id))
    OR (sgtd_es_jefe() AND workspace_id = sgtd_workspace_id())
  );


-- =============================================================================
-- 2. sgtd_invitar_a_workspace
-- =============================================================================
-- Contrato:
--   - p_usuario_id : UUID resuelto por la edge function (auth.users existente
--                    o recién creado). La RPC no crea cuentas auth.
--   - p_email      : Para crear/verificar public.usuario si falta la fila.
--   - p_rol        : 'jefe' | 'miembro'.
--   - p_workspace_id: workspace destino. Default = sgtd_workspace_id() (header).
--
-- Gate:
--   plataforma_owner puede invitar a cualquier workspace.
--   jefe puede invitar solo a su propio workspace (= sgtd_workspace_id()).
--
-- Lógica:
--   1. Validar parámetros.
--   2. Gate de permiso.
--   3. Asegurar public.usuario (absorbe semántica de 055).
--   4. ON CONFLICT workspace_member:
--        joined_at NOT NULL → ya es activo → EXCEPTION P0008.
--        joined_at IS NULL  → invitación pendiente existente → actualizar rol.
--        sin fila            → INSERT nuevo (joined_at NULL).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sgtd_invitar_a_workspace(
  p_usuario_id   uuid,
  p_email        text,
  p_rol          text,
  p_workspace_id uuid DEFAULT public.sgtd_workspace_id()
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email       text := lower(trim(p_email));
  v_nombre      text;
  v_es_owner    boolean;
  v_miembro     public.workspace_member%ROWTYPE;
  v_auth_email  text;
BEGIN
  -- ── Autenticación ──────────────────────────────────────────────────────────
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = 'P0001';
  END IF;

  -- ── Parámetros básicos ─────────────────────────────────────────────────────
  IF p_usuario_id IS NULL THEN
    RAISE EXCEPTION 'p_usuario_id requerido.' USING ERRCODE = 'P0003';
  END IF;
  IF v_email IS NULL OR v_email = '' OR position('@' IN v_email) = 0 THEN
    RAISE EXCEPTION 'Email inválido.' USING ERRCODE = 'P0003';
  END IF;
  IF p_rol NOT IN ('jefe', 'miembro') THEN
    RAISE EXCEPTION 'El rol debe ser "jefe" o "miembro".' USING ERRCODE = 'P0003';
  END IF;
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION
      'workspace_id requerido. Enviar header x-workspace-id o pasar p_workspace_id explícitamente.'
      USING ERRCODE = 'P0003';
  END IF;

  -- ── Gate de permiso ────────────────────────────────────────────────────────
  v_es_owner := public.sgtd_es_plataforma_owner();

  IF NOT (
    v_es_owner
    OR (public.sgtd_es_jefe() AND p_workspace_id = public.sgtd_workspace_id())
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para invitar usuarios a este espacio.' USING ERRCODE = 'P0007';
  END IF;

  -- ── Workspace válido y activo ──────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace w
    JOIN public.organizacion o ON o.id = w.organizacion_id
    WHERE w.id = p_workspace_id AND w.activo = true AND o.activa = true
  ) THEN
    RAISE EXCEPTION 'El espacio de trabajo no existe o está inactivo.' USING ERRCODE = 'P0002';
  END IF;

  -- ── Asegurar public.usuario (absorbe lógica de 055) ───────────────────────
  -- Si auth.users tiene la cuenta pero public.usuario aún no tiene fila,
  -- la creamos aquí (mismo efecto que sgtd_crear_usuario_invitado de 055).
  IF NOT EXISTS (SELECT 1 FROM public.usuario WHERE id = p_usuario_id) THEN
    -- Verificar que la cuenta auth existe (la edge debió crearla antes)
    SELECT lower(au.email) INTO v_auth_email
    FROM auth.users au WHERE au.id = p_usuario_id;

    IF v_auth_email IS NULL THEN
      RAISE EXCEPTION
        'No existe cuenta de autenticación para el usuario indicado. '
        'La edge function debe crear auth.users antes de llamar esta RPC.'
        USING ERRCODE = 'P0001';
    END IF;

    -- gap #2: p_email debe coincidir con auth.users (evita UUID ajeno + email arbitrario)
    IF v_auth_email <> v_email THEN
      RAISE EXCEPTION
        'El email no coincide con la cuenta de autenticación del usuario indicado.'
        USING ERRCODE = 'P0003';
    END IF;

    -- gap #1: email único en public.usuario (detecta inconsistencia auth↔public)
    IF EXISTS (
      SELECT 1 FROM public.usuario
      WHERE lower(email) = v_email AND id <> p_usuario_id
    ) THEN
      RAISE EXCEPTION
        'El email ya está registrado con otro usuario en la plataforma. '
        'Posible inconsistencia entre auth.users y public.usuario.'
        USING ERRCODE = 'P0006';
    END IF;

    v_nombre := COALESCE(NULLIF(trim(split_part(v_email, '@', 1)), ''), 'Usuario');

    INSERT INTO public.usuario (id, nombre, email, rol, activo)
    VALUES (p_usuario_id, v_nombre, v_email, NULL, true)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- ── Verificar que el public.usuario no esté inactivo ──────────────────────
  IF NOT EXISTS (SELECT 1 FROM public.usuario WHERE id = p_usuario_id AND activo = true) THEN
    RAISE EXCEPTION 'El usuario está inactivo.' USING ERRCODE = 'P0002';
  END IF;

  -- ── Insertar membresía pendiente o manejar conflicto ──────────────────────
  SELECT * INTO v_miembro
  FROM public.workspace_member
  WHERE workspace_id = p_workspace_id
    AND usuario_id   = p_usuario_id;

  IF FOUND THEN
    IF v_miembro.joined_at IS NOT NULL AND v_miembro.activo = true THEN
      -- Ya es miembro activo: no reinvitar
      RAISE EXCEPTION 'El usuario ya es miembro activo de este espacio de trabajo.'
        USING ERRCODE = 'P0008';
    ELSIF v_miembro.joined_at IS NOT NULL AND v_miembro.activo = false THEN
      -- gap #3: dado de baja formal (joined_at seteado + inactivo): requiere reactivación manual
      -- No se puede reinvitar porque joined_at registra cuándo fue incorporado; reinvitar
      -- implicaría borrar esa marca histórica. El panel debe reactivar explícitamente.
      RAISE EXCEPTION
        'El usuario fue dado de baja de este espacio de trabajo. '
        'Reactívalo desde el panel de administración antes de reinvitar.'
        USING ERRCODE = 'P0009';
    ELSE
      -- joined_at IS NULL: invitación pendiente o rechazada (activo=false) → reinvitar
      UPDATE public.workspace_member
      SET rol    = p_rol,
          activo = true
      WHERE workspace_id = p_workspace_id
        AND usuario_id   = p_usuario_id;
    END IF;
  ELSE
    -- Nueva invitación
    INSERT INTO public.workspace_member (workspace_id, usuario_id, rol, joined_at, activo)
    VALUES (p_workspace_id, p_usuario_id, p_rol, NULL, true);
  END IF;

  RETURN jsonb_build_object(
    'usuario_id',    p_usuario_id,
    'workspace_id',  p_workspace_id,
    'rol',           p_rol,
    'estado',        'pendiente'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sgtd_invitar_a_workspace(uuid, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_invitar_a_workspace(uuid, text, text, uuid) TO authenticated;

COMMENT ON FUNCTION public.sgtd_invitar_a_workspace IS
  'V5 057: invita a un usuario a un workspace (joined_at NULL). '
  'Gate: plataforma_owner (cualquier ws) o jefe (solo su ws activo). '
  'Absorbe lógica de 055. Idempotente en invitación pendiente.';


-- =============================================================================
-- 3. sgtd_listar_invitaciones_pendientes
-- =============================================================================
-- Sin parámetros. El gate es auth.uid() = el propio invitado.
-- SECURITY DEFINER necesario: el invitado no puede leer workspace_member
-- vía PostgREST porque sgtd_puede_acceder_workspace() exige joined_at IS NOT NULL.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sgtd_listar_invitaciones_pendientes()
RETURNS TABLE (
  workspace_id        uuid,
  workspace_nombre    text,
  organizacion_id     uuid,
  organizacion_nombre text,
  rol                 text,
  invited_at          timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    wm.workspace_id,
    w.nombre  AS workspace_nombre,
    o.id      AS organizacion_id,
    o.nombre  AS organizacion_nombre,
    wm.rol,
    wm.invited_at
  FROM public.workspace_member wm
  JOIN public.workspace    w ON w.id = wm.workspace_id
  JOIN public.organizacion o ON o.id = w.organizacion_id
  WHERE wm.usuario_id   = auth.uid()
    AND wm.joined_at    IS NULL
    AND wm.activo       = true
    AND w.activo        = true
    AND o.activa        = true
  ORDER BY wm.invited_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.sgtd_listar_invitaciones_pendientes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_listar_invitaciones_pendientes() TO authenticated;

COMMENT ON FUNCTION public.sgtd_listar_invitaciones_pendientes IS
  'V5 057: lista invitaciones pendientes del usuario autenticado (joined_at IS NULL). '
  'SECURITY DEFINER porque RLS bloquea lectura de membresías no aceptadas.';


-- =============================================================================
-- 4. sgtd_aceptar_invitacion_workspace
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sgtd_aceptar_invitacion_workspace(
  p_workspace_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = 'P0001';
  END IF;

  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'p_workspace_id requerido.' USING ERRCODE = 'P0003';
  END IF;

  -- Gate: el usuario debe tener una invitación pendiente activa
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_member
    WHERE workspace_id = p_workspace_id
      AND usuario_id   = auth.uid()
      AND joined_at    IS NULL
      AND activo       = true
  ) THEN
    RAISE EXCEPTION 'No tienes una invitación pendiente para este espacio de trabajo.'
      USING ERRCODE = 'P0002';
  END IF;

  -- Aceptar: marcar joined_at
  UPDATE public.workspace_member
  SET joined_at = now()
  WHERE workspace_id = p_workspace_id
    AND usuario_id   = auth.uid()
    AND joined_at    IS NULL;

  -- Obtener org del workspace
  SELECT w.organizacion_id INTO v_org_id
  FROM public.workspace w
  WHERE w.id = p_workspace_id;

  -- Actualizar preferencia para que el bootstrap aterrice aquí
  INSERT INTO public.usuario_preferencia (usuario_id, ultima_org_id, ultima_workspace_id)
  VALUES (auth.uid(), v_org_id, p_workspace_id)
  ON CONFLICT (usuario_id) DO UPDATE
    SET ultima_org_id       = EXCLUDED.ultima_org_id,
        ultima_workspace_id = EXCLUDED.ultima_workspace_id,
        updated_at          = now();

  RETURN jsonb_build_object(
    'workspace_id',    p_workspace_id,
    'organizacion_id', v_org_id,
    'estado',          'aceptada'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sgtd_aceptar_invitacion_workspace(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_aceptar_invitacion_workspace(uuid) TO authenticated;

COMMENT ON FUNCTION public.sgtd_aceptar_invitacion_workspace IS
  'V5 057: acepta una invitación pendiente. Setea joined_at=now() y '
  'actualiza usuario_preferencia para que el bootstrap aterrice en este workspace.';


-- =============================================================================
-- 5. sgtd_rechazar_invitacion_workspace (recomendado)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sgtd_rechazar_invitacion_workspace(
  p_workspace_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = 'P0001';
  END IF;

  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'p_workspace_id requerido.' USING ERRCODE = 'P0003';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_member
    WHERE workspace_id = p_workspace_id
      AND usuario_id   = auth.uid()
      AND joined_at    IS NULL
      AND activo       = true
  ) THEN
    RAISE EXCEPTION 'No tienes una invitación pendiente para este espacio de trabajo.'
      USING ERRCODE = 'P0002';
  END IF;

  -- Declinar: desactivar la fila sin borrarla (auditable)
  UPDATE public.workspace_member
  SET activo = false
  WHERE workspace_id = p_workspace_id
    AND usuario_id   = auth.uid()
    AND joined_at    IS NULL;

  RETURN jsonb_build_object(
    'workspace_id', p_workspace_id,
    'estado',       'rechazada'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sgtd_rechazar_invitacion_workspace(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_rechazar_invitacion_workspace(uuid) TO authenticated;

COMMENT ON FUNCTION public.sgtd_rechazar_invitacion_workspace IS
  'V5 057: declina una invitación pendiente (activo=false). La fila queda para auditoría.';


-- =============================================================================
-- 6. Actualizar sgtd_listar_usuarios_plataforma (049) para incluir pendientes
-- =============================================================================
-- Se añade campo "estado" al JSON de cada org: 'activo' | 'pendiente'.
-- Misma firma, mismo tipo de retorno → CREATE OR REPLACE es seguro.
-- El frontend recibe un campo extra en el JSON de orgs; el código existente
-- que no lo usa no se rompe (JSON es extensible).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sgtd_listar_usuarios_plataforma()
RETURNS TABLE (
  usuario_id   uuid,
  nombre       text,
  email        text,
  activo       boolean,
  created_at   timestamptz,
  orgs         jsonb
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
          'rol',                 wm.rol,
          -- 057: incluir estado para distinguir activo vs pendiente en el panel
          'estado',              CASE WHEN wm.joined_at IS NOT NULL THEN 'activo' ELSE 'pendiente' END
        ) ORDER BY o.nombre)
        FROM public.workspace_member wm
        JOIN public.workspace    w ON w.id = wm.workspace_id
        JOIN public.organizacion o ON o.id = w.organizacion_id
        WHERE wm.usuario_id = u.id
          AND wm.activo     = true
          AND w.activo      = true
          AND o.activa      = true
        -- SIN filtro joined_at: muestra activos Y pendientes
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
  'V5 057 (actualiza 049): lista usuarios activos + orgs (activas y pendientes). '
  'Campo "estado" en cada org: "activo" | "pendiente".';


COMMIT;


-- =============================================================================
-- SMOKE TESTS — ejecutar tras apply (autenticarse como plataforma_owner para T1–T8)
-- =============================================================================

-- T1: hardening ws_member_insert
--   SELECT policyname, with_check FROM pg_policies
--   WHERE schemaname='public' AND tablename='workspace_member' AND policyname='ws_member_insert';
--   esperado: with_check contiene 'sgtd_workspace_id()'

-- T2: nueva firma de sgtd_invitar_a_workspace existe
--   SELECT proname, pg_get_function_arguments(oid)
--   FROM pg_proc WHERE proname = 'sgtd_invitar_a_workspace';
--   esperado: 1 fila con (p_usuario_id uuid, p_email text, p_rol text, p_workspace_id uuid)

-- T3 (owner, con header de ws destino): invitar email existente como miembro
--   SELECT sgtd_invitar_a_workspace('<auth_uid>', 'nuevo@empresa.com', 'miembro', '<ws_id>');
--   esperado: {usuario_id, workspace_id, rol:'miembro', estado:'pendiente'}
--   Verificar: SELECT joined_at FROM workspace_member WHERE usuario_id='<uid>' → NULL

-- T4 (jefe con header de su ws): invitar dentro de su ws
--   SELECT sgtd_invitar_a_workspace('<auth_uid>', 'x@y.com', 'miembro');
--   esperado: OK con p_workspace_id = sgtd_workspace_id()

-- T5 (jefe con header de ws ajeno como p_workspace_id): debe rechazarse
--   SELECT sgtd_invitar_a_workspace('<uid>', 'x@y.com', 'miembro', '<ws_ajeno_id>');
--   esperado: EXCEPTION 'No tienes permiso para invitar...'

-- T6: re-invitar email ya activo (joined_at IS NOT NULL)
--   SELECT sgtd_invitar_a_workspace('<uid_activo>', 'activo@y.com', 'miembro', '<ws>');
--   esperado: EXCEPTION 'El usuario ya es miembro activo...'

-- T7 (invitado, autenticado como el invitado): listar sus pendientes
--   SELECT * FROM sgtd_listar_invitaciones_pendientes();
--   esperado: 1+ fila con workspace_id, workspace_nombre, rol, etc.

-- T8 (invitado): aceptar la invitación del T3
--   SELECT sgtd_aceptar_invitacion_workspace('<ws_id>');
--   esperado: {workspace_id, organizacion_id, estado:'aceptada'}
--   Verificar: SELECT joined_at FROM workspace_member WHERE usuario_id='<uid>' → NOT NULL
--   Verificar: SELECT * FROM usuario_preferencia WHERE usuario_id='<uid>'
--              → ultima_workspace_id = <ws_id>

-- T9 (invitado): rechazar una segunda invitación pendiente
--   SELECT sgtd_rechazar_invitacion_workspace('<ws2_id>');
--   esperado: {workspace_id, estado:'rechazada'}
--   Verificar: SELECT activo FROM workspace_member WHERE ... AND joined_at IS NULL → false

-- T10 (owner): listar usuarios, verificar campo estado en orgs
--   SELECT usuario_id, nombre, orgs FROM sgtd_listar_usuarios_plataforma()
--   WHERE orgs @> '[{"estado":"pendiente"}]';
--   esperado: usuarios con invitaciones sin aceptar aparecen con estado='pendiente'

-- T11 (miembro operativo, no jefe ni owner): invitar
--   (logueado como usuario con rol miembro en su ws, sin sgtd_es_jefe ni plataforma_owner)
--   SELECT sgtd_invitar_a_workspace('<uid>', 'x@y.com', 'miembro', '<ws_id>');
--   esperado: EXCEPTION 'No tienes permiso...' ERRCODE P0007
--   Nota: un jefe SÍ puede invitar (T4); este test es solo para miembro normal.

-- T12 (gap #1): email duplicado con distinto p_usuario_id
--   (crear un segundo auth.users con el mismo email usando el panel de InsForge)
--   SELECT sgtd_invitar_a_workspace('<uid_B>', 'repetido@empresa.com', 'miembro', '<ws_id>');
--   esperado: EXCEPTION 'El email ya está registrado con otro usuario...' ERRCODE P0006

-- T13 (gap #2, dueño en panel): p_email no coincide con auth.users del uid
--   SELECT sgtd_invitar_a_workspace('<uid>', 'otro@empresa.com', 'miembro', '<ws_id>');
--   donde el email real de <uid> en auth.users es 'real@empresa.com'
--   esperado: EXCEPTION 'El email no coincide con la cuenta de autenticación...' ERRCODE P0003

-- T14 (gap #3): reinvitar a miembro dado de baja (joined_at NOT NULL, activo=false)
--   UPDATE workspace_member SET activo=false WHERE usuario_id='<uid>' AND joined_at IS NOT NULL;
--   SELECT sgtd_invitar_a_workspace('<uid>', 'baja@empresa.com', 'miembro', '<ws_id>');
--   esperado: EXCEPTION 'El usuario fue dado de baja...' ERRCODE P0009

-- T15 (gap #3): dueño sin header pero con p_workspace_id explícito
--   (sin x-workspace-id en sesión SQL Editor)
--   SELECT sgtd_invitar_a_workspace('<uid>', 'x@y.com', 'miembro', '<ws_id_explícito>');
--   esperado: OK (dueño pasa por rama plataforma_owner, no necesita header)

-- T16 (camino normal): invitar email nuevo (auth.users creado antes por edge/admin)
--   Pre: INSERT auth.users + sin fila workspace_member en el ws destino.
--   SELECT sgtd_invitar_a_workspace('<uid_nuevo>', 'nuevo@empresa.com', 'miembro', '<ws_id>');
--   esperado: {estado:'pendiente'}; joined_at IS NULL; public.usuario creado si faltaba.

-- T17 (camino normal): usuario activo en org A, invitar a ws de org B
--   Pre: usuario con joined_at NOT NULL en ws_A.
--   SELECT sgtd_invitar_a_workspace('<uid>', 'existente@empresa.com', 'miembro', '<ws_B>');
--   esperado: {estado:'pendiente'} en ws_B sin afectar membresía activa en ws_A.

-- T18 (camino normal): reinvitar tras rechazo (continúa T9)
--   Pre: tras T9, fila con joined_at IS NULL y activo=false.
--   SELECT sgtd_invitar_a_workspace('<uid>', 'x@y.com', 'miembro', '<ws2_id>');
--   esperado: {estado:'pendiente'}; activo=true de nuevo en la misma fila.

-- =============================================================================
-- ROLLBACK — solo staging
-- =============================================================================
-- -- Restaurar ws_member_insert sin restricción de workspace_id en rama jefe:
-- DROP POLICY IF EXISTS ws_member_insert ON public.workspace_member;
-- CREATE POLICY ws_member_insert ON public.workspace_member
--   FOR INSERT WITH CHECK (
--     sgtd_es_org_admin((SELECT organizacion_id FROM public.workspace WHERE id = workspace_id))
--     OR sgtd_es_jefe()
--   );
-- DROP FUNCTION IF EXISTS public.sgtd_invitar_a_workspace(uuid, text, text, uuid);
-- DROP FUNCTION IF EXISTS public.sgtd_listar_invitaciones_pendientes();
-- DROP FUNCTION IF EXISTS public.sgtd_aceptar_invitacion_workspace(uuid);
-- DROP FUNCTION IF EXISTS public.sgtd_rechazar_invitacion_workspace(uuid);
-- -- Restaurar sgtd_listar_usuarios_plataforma a la versión 049
-- --   (filtrando joined_at IS NOT NULL, sin campo estado).


-- =============================================================================
-- POST-MIGRACIÓN: checklist
-- =============================================================================
-- [ ] T1–T18 en dev (T5 jefe→ws ajeno · T11 miembro · T16 email nuevo · T17 2ª org · T18 reinvitar rechazo)
-- [ ] Revisar hardening (T5): jefe NO puede invitar a workspace ajeno
-- [ ] Revisar T6: reinvitar activo → error amigable
-- [ ] Confirmar verificación de email InsForge (signUp sin confirmación / reset link)
-- [ ] Deploy invite-user edge function + delete-user en la misma ventana que el frontend
-- [ ] Siguiente: API web (api/invitacion.ts) + B2 bootstrap + B3 modal
-- [ ] Marcar 057 ✅ en CONTEXT.mdc §12
