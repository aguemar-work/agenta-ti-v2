-- =============================================================================
-- SGTD — Políticas RLS para el rol `miembro`
-- Migración: 005_rls_policies_miembro.sql
--
-- La migración 003 definió control total para el Jefe (sgtd_jefe_*_all).
-- Esta migración define acceso restringido para el Miembro.
-- Las políticas son PERMISSIVE y ADITIVAS — el Jefe sigue con acceso total.
--
-- Cómo aplicar en InsForge:
--   Dashboard → SQL Editor → pegar este archivo → Run
-- =============================================================================

BEGIN;

-- =============================================================================
-- FUNCIÓN: sgtd_es_miembro_activo()
-- SECURITY DEFINER para evitar recursión RLS al leer public.usuario
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sgtd_es_miembro_activo()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuario u
    WHERE u.id = auth.uid() AND u.rol = 'miembro' AND COALESCE(u.activo, true)
  );
$$;

REVOKE ALL    ON FUNCTION public.sgtd_es_miembro_activo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_es_miembro_activo() TO authenticated;

-- =============================================================================
-- public.usuario
-- SELECT: perfil propio + todos los activos (dropdowns de asignación)
-- INSERT: auto-provisioning en primer login
-- UPDATE: propio (no puede cambiar rol ni activo)
-- =============================================================================

DROP POLICY IF EXISTS sgtd_miembro_usuario_select_propio  ON public.usuario;
DROP POLICY IF EXISTS sgtd_miembro_usuario_select_activos ON public.usuario;
DROP POLICY IF EXISTS sgtd_miembro_usuario_insert_propio  ON public.usuario;
DROP POLICY IF EXISTS sgtd_miembro_usuario_update_propio  ON public.usuario;

CREATE POLICY sgtd_miembro_usuario_select_propio ON public.usuario
  FOR SELECT TO authenticated
  USING (public.sgtd_es_miembro_activo() AND id = auth.uid());

CREATE POLICY sgtd_miembro_usuario_select_activos ON public.usuario
  FOR SELECT TO authenticated
  USING (public.sgtd_es_miembro_activo() AND activo = true);

CREATE POLICY sgtd_miembro_usuario_insert_propio ON public.usuario
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY sgtd_miembro_usuario_update_propio ON public.usuario
  FOR UPDATE TO authenticated
  USING  (public.sgtd_es_miembro_activo() AND id = auth.uid())
  WITH CHECK (id = auth.uid());

-- =============================================================================
-- public.tarea
-- SELECT:  asignado_a = self
-- INSERT:  asignado_a = self AND creado_por = self
-- UPDATE:  asignado_a = self, no puede reasignar
-- DELETE:  creado_por = self AND estado no es completada/cancelada
-- =============================================================================

DROP POLICY IF EXISTS sgtd_miembro_tarea_select ON public.tarea;
DROP POLICY IF EXISTS sgtd_miembro_tarea_insert ON public.tarea;
DROP POLICY IF EXISTS sgtd_miembro_tarea_update ON public.tarea;
DROP POLICY IF EXISTS sgtd_miembro_tarea_delete ON public.tarea;

CREATE POLICY sgtd_miembro_tarea_select ON public.tarea
  FOR SELECT TO authenticated
  USING (public.sgtd_es_miembro_activo() AND asignado_a = auth.uid());

CREATE POLICY sgtd_miembro_tarea_insert ON public.tarea
  FOR INSERT TO authenticated
  WITH CHECK (
    public.sgtd_es_miembro_activo()
    AND asignado_a = auth.uid()
    AND creado_por = auth.uid()
  );

CREATE POLICY sgtd_miembro_tarea_update ON public.tarea
  FOR UPDATE TO authenticated
  USING  (public.sgtd_es_miembro_activo() AND asignado_a = auth.uid())
  WITH CHECK (asignado_a = auth.uid());

CREATE POLICY sgtd_miembro_tarea_delete ON public.tarea
  FOR DELETE TO authenticated
  USING (
    public.sgtd_es_miembro_activo()
    AND creado_por = auth.uid()
    AND estado NOT IN ('completada', 'cancelada')
  );

-- =============================================================================
-- public.objetivo
-- SELECT:  todos los no cancelados (necesario para dropdowns y vista Objetivos)
-- INSERT:  creado_por = self, responsable_id = self o null
-- UPDATE:  responsable o creador, no puede asignar a otro
-- =============================================================================

DROP POLICY IF EXISTS sgtd_miembro_objetivo_select ON public.objetivo;
DROP POLICY IF EXISTS sgtd_miembro_objetivo_insert ON public.objetivo;
DROP POLICY IF EXISTS sgtd_miembro_objetivo_update ON public.objetivo;

CREATE POLICY sgtd_miembro_objetivo_select ON public.objetivo
  FOR SELECT TO authenticated
  USING (public.sgtd_es_miembro_activo() AND estado != 'cancelado');

CREATE POLICY sgtd_miembro_objetivo_insert ON public.objetivo
  FOR INSERT TO authenticated
  WITH CHECK (
    public.sgtd_es_miembro_activo()
    AND creado_por = auth.uid()
    AND (responsable_id = auth.uid() OR responsable_id IS NULL)
  );

CREATE POLICY sgtd_miembro_objetivo_update ON public.objetivo
  FOR UPDATE TO authenticated
  USING (
    public.sgtd_es_miembro_activo()
    AND (responsable_id = auth.uid() OR creado_por = auth.uid())
  )
  WITH CHECK (
    (responsable_id = auth.uid() OR responsable_id IS NULL)
  );

-- =============================================================================
-- public.evento  — completo: SELECT, INSERT, UPDATE, DELETE propios
-- =============================================================================

DROP POLICY IF EXISTS sgtd_miembro_evento_select ON public.evento;
DROP POLICY IF EXISTS sgtd_miembro_evento_insert ON public.evento;
DROP POLICY IF EXISTS sgtd_miembro_evento_update ON public.evento;
DROP POLICY IF EXISTS sgtd_miembro_evento_delete ON public.evento;

CREATE POLICY sgtd_miembro_evento_select ON public.evento
  FOR SELECT TO authenticated
  USING (public.sgtd_es_miembro_activo() AND usuario_id = auth.uid());

CREATE POLICY sgtd_miembro_evento_insert ON public.evento
  FOR INSERT TO authenticated
  WITH CHECK (public.sgtd_es_miembro_activo() AND usuario_id = auth.uid());

CREATE POLICY sgtd_miembro_evento_update ON public.evento
  FOR UPDATE TO authenticated
  USING  (public.sgtd_es_miembro_activo() AND usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY sgtd_miembro_evento_delete ON public.evento
  FOR DELETE TO authenticated
  USING (public.sgtd_es_miembro_activo() AND usuario_id = auth.uid());

-- =============================================================================
-- public.nota_bitacora — completo: SELECT, INSERT, UPDATE, DELETE propios
-- DELETE solo si aún no fue convertida en tarea/evento
-- =============================================================================

DROP POLICY IF EXISTS sgtd_miembro_nota_select ON public.nota_bitacora;
DROP POLICY IF EXISTS sgtd_miembro_nota_insert ON public.nota_bitacora;
DROP POLICY IF EXISTS sgtd_miembro_nota_update ON public.nota_bitacora;
DROP POLICY IF EXISTS sgtd_miembro_nota_delete ON public.nota_bitacora;

CREATE POLICY sgtd_miembro_nota_select ON public.nota_bitacora
  FOR SELECT TO authenticated
  USING (public.sgtd_es_miembro_activo() AND usuario_id = auth.uid());

CREATE POLICY sgtd_miembro_nota_insert ON public.nota_bitacora
  FOR INSERT TO authenticated
  WITH CHECK (public.sgtd_es_miembro_activo() AND usuario_id = auth.uid());

CREATE POLICY sgtd_miembro_nota_update ON public.nota_bitacora
  FOR UPDATE TO authenticated
  USING  (public.sgtd_es_miembro_activo() AND usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY sgtd_miembro_nota_delete ON public.nota_bitacora
  FOR DELETE TO authenticated
  USING (
    public.sgtd_es_miembro_activo()
    AND usuario_id    = auth.uid()
    AND convertida_en IS NULL
  );

-- =============================================================================
-- public.log_accion
-- SELECT:  propios (historial)
-- INSERT:  propios, siempre con leido_por_jefe = false
-- UPDATE / DELETE: nunca (los logs son inmutables)
-- =============================================================================

DROP POLICY IF EXISTS sgtd_miembro_log_select ON public.log_accion;
DROP POLICY IF EXISTS sgtd_miembro_log_insert ON public.log_accion;

CREATE POLICY sgtd_miembro_log_select ON public.log_accion
  FOR SELECT TO authenticated
  USING (public.sgtd_es_miembro_activo() AND usuario_id = auth.uid());

CREATE POLICY sgtd_miembro_log_insert ON public.log_accion
  FOR INSERT TO authenticated
  WITH CHECK (
    public.sgtd_es_miembro_activo()
    AND usuario_id     = auth.uid()
    AND leido_por_jefe = false
  );

-- =============================================================================
-- public.configuracion_semana — solo lectura para todos los miembros
-- =============================================================================

DROP POLICY IF EXISTS sgtd_miembro_configuracion_select ON public.configuracion_semana;

CREATE POLICY sgtd_miembro_configuracion_select ON public.configuracion_semana
  FOR SELECT TO authenticated
  USING (public.sgtd_es_miembro_activo());

-- =============================================================================
-- VERIFICACIÓN — ejecutar después de aplicar:
--
-- SELECT tablename, policyname, cmd
-- FROM   pg_policies
-- WHERE  policyname LIKE 'sgtd_miembro_%'
-- ORDER  BY tablename, policyname;
--
-- Deberías ver 18 políticas.
-- =============================================================================

COMMIT;