-- =============================================================================
-- PASO 3 — FUNCIONES RLS V5
-- (deben existir ANTES de CREATE POLICY)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- sgtd_workspace_id() — ⚠ Validar T3 en InsForge Dev antes de prod
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_workspace_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT NULLIF(
    current_setting('request.headers', true)::json->>'x-workspace-id', ''
  )::uuid;
$$;
REVOKE ALL ON FUNCTION public.sgtd_workspace_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_workspace_id() TO authenticated;
COMMENT ON FUNCTION public.sgtd_workspace_id IS
  'Workspace activo. Lee header x-workspace-id (PostgREST). Validar T3 en Dev.';

-- ---------------------------------------------------------------------------
-- sgtd_puede_acceder_workspace(p_workspace_id) — org_admin sin membresía = false (D7)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_puede_acceder_workspace(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_member wm
    JOIN public.workspace w   ON w.id = wm.workspace_id
    JOIN public.organizacion o ON o.id = w.organizacion_id
    WHERE wm.workspace_id = p_workspace_id
      AND wm.usuario_id   = auth.uid()
      AND wm.activo       = true
      AND wm.joined_at    IS NOT NULL
      AND w.activo        = true
      AND o.activa        = true
  );
$$;
REVOKE ALL ON FUNCTION public.sgtd_puede_acceder_workspace(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_puede_acceder_workspace(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- sgtd_es_jefe() — reemplaza V4 (ya no lee usuario.rol global)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_es_jefe()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_member
    WHERE workspace_id = public.sgtd_workspace_id()
      AND usuario_id   = auth.uid()
      AND rol          = 'jefe'
      AND activo       = true
      AND joined_at    IS NOT NULL
  );
$$;
REVOKE ALL ON FUNCTION public.sgtd_es_jefe() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_es_jefe() TO authenticated;

-- ---------------------------------------------------------------------------
-- sgtd_es_miembro_activo() — semántica ampliada: jefe OR miembro en ws activo
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_es_miembro_activo()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_member
    WHERE workspace_id = public.sgtd_workspace_id()
      AND usuario_id   = auth.uid()
      AND rol          IN ('jefe', 'miembro')
      AND activo       = true
      AND joined_at    IS NOT NULL
  );
$$;
REVOKE ALL ON FUNCTION public.sgtd_es_miembro_activo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_es_miembro_activo() TO authenticated;

-- ---------------------------------------------------------------------------
-- sgtd_es_org_admin(p_org_id)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_es_org_admin(p_org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizacion_member
    WHERE organizacion_id = p_org_id
      AND usuario_id      = auth.uid()
      AND rol             = 'org_admin'
      AND activo          = true
  );
$$;
REVOKE ALL ON FUNCTION public.sgtd_es_org_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_es_org_admin(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- sgtd_generar_numero_ot(p_workspace_id) — formato OT-TI-XXXX, idempotente
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_generar_numero_ot(p_workspace_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_ultimo int; v_nuevo int;
BEGIN
  SELECT COALESCE(MAX(CAST(regexp_replace(numero, '^OT-TI-', '') AS integer)), 0)
  INTO v_ultimo
  FROM public.orden_trabajo
  WHERE workspace_id = p_workspace_id AND numero ~ '^OT-TI-[0-9]+$';
  v_nuevo := v_ultimo + 1;
  RETURN 'OT-TI-' || LPAD(v_nuevo::text, 4, '0');
END;
$$;
REVOKE ALL ON FUNCTION public.sgtd_generar_numero_ot(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_generar_numero_ot(uuid) TO authenticated;
COMMENT ON FUNCTION public.sgtd_generar_numero_ot IS
  'Correlativo OT por workspace. Formato OT-TI-XXXX. Solo interno (D2).';
