-- =============================================================================
-- Migración 048 — Superadmin (dueño de plataforma): acceso total a todas las orgs
-- =============================================================================
-- Descripción : Hace que un usuario en plataforma_owner pueda VER y OPERAR en
--               CUALQUIER organización/workspace, sin ser miembro. Es el cambio
--               de seguridad más sensible del proyecto.
--
-- ENFOQUE SEGURO (clave):
--   Las ~90 políticas RLS NO repiten lógica de acceso: todas llaman a un puñado
--   de funciones helper. Por eso el bypass de dueño se centraliza en 4 funciones
--   + 1 política de listado, en vez de tocar las 90 políticas. Menos superficie
--   de error y se propaga uniformemente.
--
-- QUÉ CAMBIA:
--   1. sgtd_puede_acceder_workspace(uuid)  → + dueño accede a cualquier ws activo
--   2. sgtd_es_jefe()                      → + dueño cuenta como jefe del ws activo
--   3. sgtd_es_miembro_activo()            → + dueño cuenta como miembro del ws activo
--   4. sgtd_workspace_tiene_modulo(...)    → hereda el bypass vía puede_acceder
--   5. organizacion_select (política)      → + dueño lista TODAS las organizaciones
--   (workspace_select ya hereda de puede_acceder; no se toca)
--
-- QUÉ NO CAMBIA (protecciones que el dueño NO bypasea):
--   - plataforma_owner  : nadie se auto-asciende a dueño
--   - usuario.rol       : trigger anti-escalada intacto
--   - sgtd_config       : whitelist de dominios intacta
--   - Las políticas de dominio MANTIENEN workspace_id = sgtd_workspace_id():
--     el dueño opera "en un workspace a la vez" (elige con el header), no lee
--     todo de golpe en una sola query.
--
-- MODELO DE OPERACIÓN DEL DUEÑO:
--   panel → elige org → frontend pone x-workspace-id de su workspace →
--   el dueño opera ahí como jefe, aunque no sea miembro.
--
-- Prerequisito : Migraciones 043–047 aplicadas.
-- Seguridad    : Todas las funciones siguen SECURITY DEFINER STABLE (como en dev).
-- Reversible   : Ver ROLLBACK al final (restaura cuerpos sin bypass).
--
-- Identificador de validación:
--   SELECT bool_and(def LIKE '%plataforma_owner%') AS bypass_048_ok FROM (
--     SELECT pg_get_functiondef(p.oid) AS def
--     FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
--     WHERE n.nspname='public' AND p.proname IN (
--       'sgtd_puede_acceder_workspace','sgtd_es_jefe','sgtd_es_miembro_activo')
--   ) s;
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1 — sgtd_puede_acceder_workspace: + bypass de dueño (núcleo del superadmin)
-- El dueño accede a cualquier workspace ACTIVO de una organización ACTIVA.
-- El resto de helpers y políticas heredan esto.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_puede_acceder_workspace(p_workspace_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    -- Camino normal: membresía activa
    EXISTS (
      SELECT 1
      FROM public.workspace_member wm
      JOIN public.workspace w    ON w.id = wm.workspace_id
      JOIN public.organizacion o ON o.id = w.organizacion_id
      WHERE wm.workspace_id = p_workspace_id
        AND wm.usuario_id   = auth.uid()
        AND wm.activo       = true
        AND wm.joined_at    IS NOT NULL
        AND w.activo        = true
        AND o.activa        = true
    )
    -- Bypass superadmin: dueño de plataforma accede a cualquier ws activo
    OR (
      public.sgtd_es_plataforma_owner()
      AND EXISTS (
        SELECT 1
        FROM public.workspace w
        JOIN public.organizacion o ON o.id = w.organizacion_id
        WHERE w.id = p_workspace_id
          AND w.activo = true
          AND o.activa = true
      )
    );
$function$;

-- ---------------------------------------------------------------------------
-- 2 — sgtd_es_jefe: + dueño cuenta como jefe del workspace que está operando
-- (activa las políticas sgtd_jefe_* y los gates de RPCs que usan es_jefe)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_es_jefe()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    EXISTS (
      SELECT 1 FROM public.workspace_member
      WHERE workspace_id = public.sgtd_workspace_id()
        AND usuario_id   = auth.uid()
        AND rol          = 'jefe'
        AND activo       = true
        AND joined_at    IS NOT NULL
    )
    -- Bypass: dueño operando en un ws (header) válido actúa como jefe
    OR (
      public.sgtd_es_plataforma_owner()
      AND public.sgtd_workspace_id() IS NOT NULL
      AND public.sgtd_puede_acceder_workspace(public.sgtd_workspace_id())
    );
$function$;

-- ---------------------------------------------------------------------------
-- 3 — sgtd_es_miembro_activo: + dueño cuenta como miembro del ws que opera
-- (cubre las rutas de políticas miembro_* — lectura de tareas del equipo, etc.)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_es_miembro_activo()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    EXISTS (
      SELECT 1 FROM public.workspace_member
      WHERE workspace_id = public.sgtd_workspace_id()
        AND usuario_id   = auth.uid()
        AND rol          IN ('jefe', 'miembro')
        AND activo       = true
        AND joined_at    IS NOT NULL
    )
    OR (
      public.sgtd_es_plataforma_owner()
      AND public.sgtd_workspace_id() IS NOT NULL
      AND public.sgtd_puede_acceder_workspace(public.sgtd_workspace_id())
    );
$function$;

-- ---------------------------------------------------------------------------
-- 4 — sgtd_workspace_tiene_modulo: NO se reescribe la lógica, pero como ya llama
-- a sgtd_puede_acceder_workspace(p_workspace_id), HEREDA el bypass del paso 1.
-- Se recrea idéntica solo para dejar constancia (y re-GRANT abajo).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_workspace_tiene_modulo(p_workspace_id uuid, p_modulo text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_modulo wm
    WHERE wm.workspace_id = p_workspace_id
      AND wm.modulo        = p_modulo
      AND wm.activo        = true
      AND (
        public.sgtd_puede_acceder_workspace(p_workspace_id)   -- ya incluye bypass dueño (paso 1)
        OR public.sgtd_es_org_admin((SELECT organizacion_id FROM public.workspace WHERE id = p_workspace_id))
      )
  );
$function$;

-- ---------------------------------------------------------------------------
-- 5 — organizacion_select: + dueño lista TODAS las organizaciones (para el panel)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS organizacion_select ON public.organizacion;
CREATE POLICY organizacion_select ON public.organizacion
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organizacion_member om
      WHERE om.organizacion_id = organizacion.id
        AND om.usuario_id = auth.uid()
        AND om.activo = true
    )
    OR EXISTS (
      SELECT 1 FROM public.workspace_member wm
      JOIN public.workspace w ON w.id = wm.workspace_id
      WHERE w.organizacion_id = organizacion.id
        AND wm.usuario_id = auth.uid()
        AND wm.activo = true
        AND wm.joined_at IS NOT NULL
    )
    -- Bypass superadmin: el dueño ve todas las organizaciones
    OR public.sgtd_es_plataforma_owner()
  );

-- ---------------------------------------------------------------------------
-- RE-GRANT — las funciones recreadas conservan sus permisos, pero por consistencia
-- (el patrón del repo re-emite REVOKE/GRANT al recrear funciones de seguridad)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.sgtd_puede_acceder_workspace(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_puede_acceder_workspace(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.sgtd_es_jefe() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_es_jefe() TO authenticated;

REVOKE ALL ON FUNCTION public.sgtd_es_miembro_activo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_es_miembro_activo() TO authenticated;

REVOKE ALL ON FUNCTION public.sgtd_workspace_tiene_modulo(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_workspace_tiene_modulo(uuid, text) TO authenticated;

COMMIT;


-- =============================================================================
-- SMOKE TESTS — ejecutar tras apply
-- =============================================================================
-- Contexto: dueño = a.guevaramartinez@gmail.com (f5d5d06c-...). Org ajena =
-- "Mi Organización" (workspace d945505d-...) donde el dueño NO es miembro.

-- T1: las 3 funciones núcleo mencionan plataforma_owner (identificador cabecera) → true

-- T2 (dueño, con x-workspace-id = workspace de Mi Organización en el header):
--   SELECT sgtd_puede_acceder_workspace('d945505d-...');  -- true (antes: false)
--   SELECT sgtd_es_jefe();                                -- true (opera como jefe)
--   SELECT count(*) FROM tarea;                           -- ve las tareas de esa org

-- T3 (NO-dueño, ej. agamarra@nufago.com, con header de un ws donde NO es miembro):
--   SELECT sgtd_puede_acceder_workspace('<ws ajeno>');    -- false (sin cambios)
--   SELECT sgtd_es_jefe();                                -- false
--   → CONFIRMA que el bypass es SOLO para dueños

-- T4 (dueño lista orgs):
--   SELECT id, nombre FROM organizacion;  -- ve Mi Organización Y AGUEMAR (todas)

-- T5 (no-dueño con sus orgs): un miembro normal sigue viendo SOLO sus orgs (sin cambios)

-- T6 (protecciones intactas):
--   El dueño NO puede insertarse en plataforma_owner vía API (sin política INSERT).
--   El dueño NO bypasea sgtd_config ni el trigger de usuario.rol.

-- T7 (regresión crítica): un miembro normal en SU workspace sigue operando igual
--   (crear/ver/editar sus tareas). El bypass no le quitó ni agregó nada.


-- =============================================================================
-- ROLLBACK — solo staging (restaura cuerpos sin bypass de 046/043)
-- =============================================================================
-- Recrear sgtd_puede_acceder_workspace, sgtd_es_jefe, sgtd_es_miembro_activo y
-- sgtd_workspace_tiene_modulo SIN el OR de plataforma_owner (cuerpos previos).
-- Restaurar organizacion_select sin el OR sgtd_es_plataforma_owner().
-- NOTA: revertir quita el acceso superadmin; el dueño volvería a ver solo sus orgs.


-- =============================================================================
-- POST-MIGRACIÓN: checklist
-- =============================================================================
-- [ ] Ejecutar T1–T7 (sobre todo T3 y T7: que NO-dueños no ganen acceso)
-- [ ] Login como dueño → entrar a "Mi Organización" desde el panel → ver sus tareas
-- [ ] Login como agamarra → confirmar que ve SOLO su org y sus tareas (sin cambios)
-- [ ] Frontend pendiente:
--     - Panel lista TODAS las orgs (getOrgsDelUsuario ya hereda de organizacion_select)
--     - cambiarAOrganizacion funciona para dueño sin membresía (getWorkspacesDelUsuario
--       hace join en workspace_member → el dueño no tiene fila; necesita API alterna
--       que liste workspaces de una org vía workspace_select, que ya hereda el bypass)
--     - rolActivo = 'jefe' cuando el dueño entra a una org ajena (si no, JefeRoute oculta
--       planificación/métricas aunque la BD lo permita)
-- [ ] Auditar RPCs SECURITY DEFINER que validan membresía además de sgtd_es_jefe()
-- =============================================================================