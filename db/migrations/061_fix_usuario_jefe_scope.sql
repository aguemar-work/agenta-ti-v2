-- =============================================================================
-- Migración 061 — Eliminar políticas legacy de usuario que rompen aislamiento
-- multi-organización
-- =============================================================================
-- Objetivo:
--   usuario_select_self_or_jefe y usuario_update_self_or_jefe (rol
--   authenticated) permiten acceso vía "(id = auth.uid()) OR auth_es_jefe()".
--   auth_es_jefe() solo verifica rol='jefe' AND activo=true, SIN filtrar por
--   organización ni workspace. Como las políticas RLS permisivas se combinan
--   con OR, cualquier "jefe" de cualquier organización puede SELECT/UPDATE el
--   perfil (PII) de usuarios de OTRAS organizaciones — rompe el aislamiento
--   multi-tenant que las migraciones 043-050 (V5) introdujeron.
--
-- Hallazgo: auditoria_2026-07-13.md — C2.
--
-- Por qué es seguro eliminarlas (no se pierde funcionalidad legítima):
--   - Auto-lectura/auto-edición (id = auth.uid()) ya está cubierta, por
--     separado, por: sgtd_miembro_usuario_select, sgtd_miembro_usuario_update,
--     sgtd_miembro_usuario_select_propio, sgtd_miembro_usuario_update_propio.
--   - Acceso del jefe a usuarios de su propio workspace ya está cubierto,
--     correctamente scoped, por sgtd_jefe_usuario_all (ALL), que exige
--     EXISTS (workspace_member wm WHERE wm.workspace_id = sgtd_workspace_id()
--     AND wm.usuario_id = usuario.id AND wm.activo AND wm.joined_at IS NOT NULL).
--   - Estas dos policies son residuo de la era pre-V5 (single-org) y no se
--     retiraron al introducir multi-organización.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS usuario_select_self_or_jefe ON public.usuario;
DROP POLICY IF EXISTS usuario_update_self_or_jefe ON public.usuario;

COMMIT;
