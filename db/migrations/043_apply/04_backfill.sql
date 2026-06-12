-- =============================================================================
-- PASO 4 — BACKFILL V4 → V5
-- ⚠ Cambiar nombre y slug antes de ejecutar en prod.
-- =============================================================================

DO $$
DECLARE v_org_id uuid; v_ws_id uuid;
BEGIN
  -- 1. Organización por defecto
  -- ⚠ Cambiar 'Mi Organización' y 'mi-organizacion' por los valores reales
  INSERT INTO public.organizacion (nombre, slug)
  VALUES ('Mi Organización', 'mi-organizacion')
  RETURNING id INTO v_org_id;

  -- 2. Workspace interno por defecto
  INSERT INTO public.workspace (organizacion_id, nombre, tipo)
  VALUES (v_org_id, 'Principal', 'interno')
  RETURNING id INTO v_ws_id;

  -- 3. Membresías desde usuario.rol legacy
  INSERT INTO public.workspace_member (workspace_id, usuario_id, rol, joined_at)
  SELECT v_ws_id, id,
    CASE WHEN rol = 'jefe' THEN 'jefe' ELSE 'miembro' END,
    now()
  FROM public.usuario
  WHERE activo = true OR activo IS NULL;

  -- 4. Primer org_admin = primer jefe (si no hay jefe, insertar manualmente post-migración)
  INSERT INTO public.organizacion_member (organizacion_id, usuario_id, rol)
  SELECT v_org_id, id, 'org_admin'
  FROM public.usuario WHERE rol = 'jefe' LIMIT 1
  ON CONFLICT (organizacion_id, usuario_id) DO NOTHING;

  -- 5. Propagar workspace_id a todas las tablas de dominio
  UPDATE public.tarea              SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
  UPDATE public.objetivo           SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
  UPDATE public.evento             SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
  UPDATE public.recurrencia_evento SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
  UPDATE public.nota_bitacora      SET workspace_id = v_ws_id WHERE workspace_id IS NULL;

  -- log_accion / log_ot: triggers inmutables (024/030) bloquean UPDATE — desactivar solo backfill
  ALTER TABLE public.log_accion DISABLE TRIGGER trg_log_accion_inmutable;
  ALTER TABLE public.log_ot       DISABLE TRIGGER trg_log_ot_inmutable;

  UPDATE public.log_accion         SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
  UPDATE public.log_ot             SET workspace_id = v_ws_id WHERE workspace_id IS NULL;

  ALTER TABLE public.log_accion ENABLE TRIGGER trg_log_accion_inmutable;
  ALTER TABLE public.log_ot       ENABLE TRIGGER trg_log_ot_inmutable;

  UPDATE public.orden_trabajo      SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
  UPDATE public.tipo_trabajo_ot    SET workspace_id = v_ws_id WHERE workspace_id IS NULL;

  -- 6. Preferencia por defecto para todos los usuarios
  INSERT INTO public.usuario_preferencia (usuario_id, ultima_org_id, ultima_workspace_id)
  SELECT id, v_org_id, v_ws_id FROM public.usuario
  ON CONFLICT (usuario_id) DO NOTHING;

  RAISE NOTICE 'Backfill V5 OK — org_id=%, workspace_id=%', v_org_id, v_ws_id;
END $$;
