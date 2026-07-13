-- =============================================================================
-- Migración 060 — Habilitar RLS en public.modulos y cerrar escritura anónima
-- =============================================================================
-- Objetivo:
--   public.modulos es la única tabla de 22 en el esquema public sin Row Level
--   Security habilitado, pero SÍ tiene grants completos (INSERT/SELECT/UPDATE/
--   DELETE) para los roles anon y authenticated. Sin RLS, PostgREST expone la
--   tabla sin filtro alguno: cualquier request sin autenticar puede leer,
--   insertar, modificar o borrar el catálogo de módulos.
--
-- Hallazgo: auditoria_2026-07-13.md — C1.
--
-- Fix:
--   1. Habilitar RLS.
--   2. Política de solo lectura pública (es un catálogo estático, no contiene
--      PII ni datos por tenant — la app necesita poder leerlo sin sesión para
--      pintar el listado de módulos disponibles).
--   3. Revocar INSERT/UPDATE/DELETE de anon y authenticated: la escritura del
--      catálogo queda reservada a project_admin (dashboard/CLI de InsForge).
-- =============================================================================

BEGIN;

ALTER TABLE public.modulos ENABLE ROW LEVEL SECURITY;

CREATE POLICY modulos_select_public
  ON public.modulos
  FOR SELECT
  TO public
  USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.modulos FROM anon, authenticated;

COMMIT;
