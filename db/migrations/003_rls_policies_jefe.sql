-- =============================================================================
-- SGTD — Políticas RLS para el rol `jefe` (control total sobre datos operativos)
--
-- Contexto InsForge: `auth.uid()` = id del usuario en sesión (misma clave que
-- `public.usuario.id`). Rol canónico en `public.usuario.rol` = 'jefe' | 'miembro'.
--
-- La función `public.sgtd_es_jefe()` es SECURITY DEFINER para leer `usuario`
-- sin provocar recursión con políticas RLS sobre esa tabla.
--
-- Uso:
--   1) Debe existir RLS activo en las tablas y políticas para miembros (o al
--      menos una política que permita el flujo normal); estas políticas son
--      aditivas: si CUALQUIERA pasa, la fila es visible/modificable.
--   2) Si RLS aún no está habilitado, las políticas quedan creadas pero no
--      aplican hasta `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sgtd_es_jefe()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuario u
    WHERE u.id = auth.uid()
      AND u.rol = 'jefe'
      AND COALESCE(u.activo, true)
  );
$$;

REVOKE ALL ON FUNCTION public.sgtd_es_jefe() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_es_jefe() TO authenticated;

-- ---------------------------------------------------------------------------
-- public.usuario
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS sgtd_jefe_usuario_all ON public.usuario;
CREATE POLICY sgtd_jefe_usuario_all ON public.usuario
  FOR ALL
  TO authenticated
  USING (public.sgtd_es_jefe())
  WITH CHECK (public.sgtd_es_jefe());

-- ---------------------------------------------------------------------------
-- public.tarea
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS sgtd_jefe_tarea_all ON public.tarea;
CREATE POLICY sgtd_jefe_tarea_all ON public.tarea
  FOR ALL
  TO authenticated
  USING (public.sgtd_es_jefe())
  WITH CHECK (public.sgtd_es_jefe());

-- ---------------------------------------------------------------------------
-- public.objetivo
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS sgtd_jefe_objetivo_all ON public.objetivo;
CREATE POLICY sgtd_jefe_objetivo_all ON public.objetivo
  FOR ALL
  TO authenticated
  USING (public.sgtd_es_jefe())
  WITH CHECK (public.sgtd_es_jefe());

-- ---------------------------------------------------------------------------
-- public.evento
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS sgtd_jefe_evento_all ON public.evento;
CREATE POLICY sgtd_jefe_evento_all ON public.evento
  FOR ALL
  TO authenticated
  USING (public.sgtd_es_jefe())
  WITH CHECK (public.sgtd_es_jefe());

-- ---------------------------------------------------------------------------
-- public.nota_bitacora
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS sgtd_jefe_nota_bitacora_all ON public.nota_bitacora;
CREATE POLICY sgtd_jefe_nota_bitacora_all ON public.nota_bitacora
  FOR ALL
  TO authenticated
  USING (public.sgtd_es_jefe())
  WITH CHECK (public.sgtd_es_jefe());

-- ---------------------------------------------------------------------------
-- public.log_accion
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS sgtd_jefe_log_accion_all ON public.log_accion;
CREATE POLICY sgtd_jefe_log_accion_all ON public.log_accion
  FOR ALL
  TO authenticated
  USING (public.sgtd_es_jefe())
  WITH CHECK (public.sgtd_es_jefe());

-- ---------------------------------------------------------------------------
-- public.configuracion_semana (planificación / notas de semana)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS sgtd_jefe_configuracion_semana_all ON public.configuracion_semana;
CREATE POLICY sgtd_jefe_configuracion_semana_all ON public.configuracion_semana
  FOR ALL
  TO authenticated
  USING (public.sgtd_es_jefe())
  WITH CHECK (public.sgtd_es_jefe());
