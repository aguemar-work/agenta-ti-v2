-- =============================================================================
-- SGTD — Migración 063
-- Archivo: 063_puede_invitar_rpc.sql
--
-- SEGURIDAD (auditoría 2026-07-17, hallazgo #2 — invite-user crea auth.users
-- antes del gate): la edge function invite-user creaba la cuenta en auth.users
-- (API admin) ANTES de llamar a sgtd_invitar_a_workspace, donde vive el gate.
-- Un usuario autenticado sin permiso (miembro) podía provocar cuentas huérfanas
-- para correos arbitrarios (squatting), aunque la RPC luego devolviera 403.
--
-- Cambio: RPC de pre-chequeo sgtd_puede_invitar_a_workspace(), espejo exacto
-- del gate de sgtd_invitar_a_workspace (057) + workspace/org activos. La edge
-- function la consulta con el JWT del caller ANTES de crear la cuenta auth.
-- El gate real de 057 se mantiene intacto (esto es solo defensa previa; una
-- carrera entre ambos chequeos no otorga permisos, solo evita el side effect).
--
-- Prerrequisitos: 048 (helpers), 057 (sgtd_invitar_a_workspace).
-- Frontend: sin cambios. Edge function: insforge/functions/invite-user.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.sgtd_puede_invitar_a_workspace(
  p_workspace_id uuid DEFAULT public.sgtd_workspace_id()
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_workspace_id IS NOT NULL
    AND (
      public.sgtd_es_plataforma_owner()
      OR (public.sgtd_es_jefe() AND p_workspace_id = public.sgtd_workspace_id())
    )
    -- El destino debe existir y estar operativo (espejo del chequeo de 057)
    AND EXISTS (
      SELECT 1
      FROM public.workspace w
      JOIN public.organizacion o ON o.id = w.organizacion_id
      WHERE w.id = p_workspace_id
        AND w.activo = true
        AND o.activa = true
    );
$$;

COMMENT ON FUNCTION public.sgtd_puede_invitar_a_workspace(uuid) IS
  'Pre-chequeo del gate de sgtd_invitar_a_workspace (057). Usado por la edge '
  'function invite-user para no crear cuentas auth sin permiso del caller.';

REVOKE ALL    ON FUNCTION public.sgtd_puede_invitar_a_workspace(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_puede_invitar_a_workspace(uuid) TO authenticated;

COMMIT;

-- -----------------------------------------------------------------------------
-- Verificación (ejecutar tras COMMIT)
-- -----------------------------------------------------------------------------
-- T1 (miembro, header de su ws):  SELECT public.sgtd_puede_invitar_a_workspace();
--    esperado: false
-- T2 (jefe, header de su ws):     esperado: true
-- T3 (jefe, p_workspace_id de un ws ajeno): esperado: false
-- T4 (owner, cualquier ws activo): esperado: true
-- T5 (workspace o su org inactivos): esperado: false
