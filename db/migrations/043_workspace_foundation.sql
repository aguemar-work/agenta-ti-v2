-- =============================================================================
-- Migración 043 — Workspace Foundation (Materen V5)
-- =============================================================================
-- Descripción : Introduce organización, workspace y membresías multi-workspace.
--               Elimina rol global de usuario como fuente de verdad RBAC.
--               Añade workspace_id a todas las tablas de dominio.
--               Backfill: datos V4 → 1 org + 1 workspace interno por defecto.
--               Recrea TODAS las políticas RLS con filtro workspace_id.
--               Rebind sgtd_enviar_ot → sgtd_generar_numero_ot(workspace_id).
--
-- Prerequisito : Migraciones 001–042 aplicadas.
-- Reversible   : Ver sección ROLLBACK al final (staging únicamente).
-- Checklist    : Marcar Dev/Staging/Prod en CONTEXT.mdc §12 al aplicar.
--
-- ORDEN DE EJECUCIÓN (crítico — no reordenar):
--   PASO 1 · CREATE TABLE nuevas (sin políticas aún)
--   PASO 2 · ALTER dominio V4 (+ columnas workspace_id)
--   PASO 3 · CREATE FUNCTION sgtd_* (deben existir antes de CREATE POLICY)
--   PASO 4 · BACKFILL
--   PASO 5 · NOT NULL post-backfill
--   PASO 6 · DROP políticas legacy + CREATE POLICY nuevas (todas al final)
--   PASO 7 · Triggers + vista tarea_activa
--   PASO 8 · Rebind sgtd_enviar_ot
--
-- Identificador de validación → ejecutar db/migrations/043_check_status.sql
-- (seguro antes y después del apply; no usa tarea.workspace_id directamente).
--
--   Parcial ⚠ → ver columna estado en 043_check_status.sql
--   No aplicada ❌ → tablas_v5_ok=false y tablas_con_columna_ws_id=0
--
-- INSFORGE — CÓMO EJECUTAR (SQL Editor):
--   1. Si aparece "current transaction is aborted" →  ROLLBACK;
--   2. Ejecuta TODO el archivo en una sola pasada (incluye BEGIN/COMMIT).
--   3. Si falla: ROLLBACK; → 043_check_status.sql → cleanup o paso2 según estado.
--   4. NO uses SELECT ... FROM tarea WHERE workspace_id antes de aplicar PASO 2
--      (error: column "workspace_id" does not exist).
--   5. Reintento "already exists" en DEV → 043_cleanup_partial_dev.sql + 043 completo.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. EXTENSIONES
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- =============================================================================
-- PASO 1 — CREATE TABLE nuevas (sin políticas aún)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.organizacion (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text        NOT NULL,
  slug       text        NOT NULL,
  activa     boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizacion_slug_unique UNIQUE (slug)
);

COMMENT ON TABLE  public.organizacion        IS 'Empresa o entidad que contrata Materen. Contenedor de workspaces.';
COMMENT ON COLUMN public.organizacion.slug   IS 'Identificador URL-safe único global. Ej: mi-agencia.';
COMMENT ON COLUMN public.organizacion.activa IS 'false = org suspendida; sus miembros no pueden operar.';

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid        NOT NULL REFERENCES public.organizacion (id) ON DELETE CASCADE,
  nombre          text        NOT NULL,
  tipo            text        NOT NULL,
  activo          boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_tipo_check CHECK (tipo IN ('interno', 'agencia'))
);

COMMENT ON TABLE  public.workspace      IS 'Unidad operativa aislada. Tipo inmutable tras creación (D6).';
COMMENT ON COLUMN public.workspace.tipo IS 'interno = SGTD clásico. agencia = + cliente/proyecto/área.';

CREATE INDEX IF NOT EXISTS idx_workspace_organizacion ON public.workspace (organizacion_id);

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizacion_member (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid        NOT NULL REFERENCES public.organizacion (id) ON DELETE CASCADE,
  usuario_id      uuid        NOT NULL REFERENCES public.usuario (id) ON DELETE CASCADE,
  rol             text        NOT NULL DEFAULT 'org_admin',
  activo          boolean     NOT NULL DEFAULT true,
  joined_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizacion_member_unique    UNIQUE (organizacion_id, usuario_id),
  CONSTRAINT organizacion_member_rol_check CHECK (rol IN ('org_admin'))
);

COMMENT ON TABLE  public.organizacion_member     IS 'Admins de org. Sin membresía en workspace = sin acceso operativo (D7).';
COMMENT ON COLUMN public.organizacion_member.rol IS 'org_admin: crea ws, invita usuarios, asigna membresías. No opera Mi Semana ajena.';

CREATE INDEX IF NOT EXISTS idx_org_member_usuario ON public.organizacion_member (usuario_id);

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_member (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES public.workspace (id) ON DELETE CASCADE,
  usuario_id   uuid        NOT NULL REFERENCES public.usuario (id) ON DELETE CASCADE,
  rol          text        NOT NULL,
  activo       boolean     NOT NULL DEFAULT true,
  invited_at   timestamptz NOT NULL DEFAULT now(),
  joined_at    timestamptz NULL,  -- NULL = pendiente; NOT NULL = activo
  CONSTRAINT workspace_member_rol_check CHECK (rol IN ('jefe', 'miembro')),
  CONSTRAINT workspace_member_unique    UNIQUE (workspace_id, usuario_id)
);

COMMENT ON TABLE  public.workspace_member           IS 'Membresía operativa. Fuente de verdad RBAC V5.';
COMMENT ON COLUMN public.workspace_member.joined_at IS 'NULL = invitación pendiente. NOT NULL = acceso activo.';

CREATE INDEX IF NOT EXISTS idx_ws_member_workspace ON public.workspace_member (workspace_id);
CREATE INDEX IF NOT EXISTS idx_ws_member_usuario   ON public.workspace_member (usuario_id);

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usuario_preferencia (
  usuario_id          uuid        PRIMARY KEY REFERENCES public.usuario (id) ON DELETE CASCADE,
  ultima_org_id       uuid        NULL REFERENCES public.organizacion (id) ON DELETE SET NULL,
  ultima_workspace_id uuid        NULL REFERENCES public.workspace (id) ON DELETE SET NULL,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.usuario_preferencia IS 'Último contexto para re-login sin picker. RPC valida membresía activa antes de usar.';

-- ---------------------------------------------------------------------------
-- Catálogos agencia (solo workspace tipo agencia)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cliente (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES public.workspace (id) ON DELETE CASCADE,
  nombre       text        NOT NULL,
  activo       boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cliente_workspace_unique UNIQUE (workspace_id, id)
);

CREATE INDEX IF NOT EXISTS idx_cliente_workspace ON public.cliente (workspace_id);
CREATE UNIQUE INDEX IF NOT EXISTS cliente_nombre_unique ON public.cliente (workspace_id, lower(nombre));

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.proyecto (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES public.workspace (id) ON DELETE CASCADE,
  cliente_id   uuid        NULL REFERENCES public.cliente (id) ON DELETE SET NULL,
  nombre       text        NOT NULL,
  descripcion  text        NULL,
  estado       text        NOT NULL DEFAULT 'activo',
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proyecto_estado_check     CHECK (estado IN ('activo', 'completado', 'archivado')),
  CONSTRAINT proyecto_workspace_unique UNIQUE (workspace_id, id)
);

COMMENT ON COLUMN public.proyecto.cliente_id IS 'NULL = proyecto interno de la agencia (D3).';

CREATE INDEX IF NOT EXISTS idx_proyecto_workspace ON public.proyecto (workspace_id);
CREATE INDEX IF NOT EXISTS idx_proyecto_cliente   ON public.proyecto (cliente_id);

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.area (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES public.workspace (id) ON DELETE CASCADE,
  nombre       text        NOT NULL,
  activo       boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT area_workspace_unique UNIQUE (workspace_id, id)
);

COMMENT ON TABLE public.area IS 'Catálogo de áreas por workspace agencia. Crea org_admin o jefe (D4).';

CREATE INDEX IF NOT EXISTS idx_area_workspace ON public.area (workspace_id);
CREATE UNIQUE INDEX IF NOT EXISTS area_nombre_unique ON public.area (workspace_id, lower(nombre));


-- =============================================================================
-- PASO 2 — ALTER dominio V4 (+ columnas workspace_id)
-- =============================================================================

-- usuario: añadir columnas faltantes, deprecar rol global
ALTER TABLE public.usuario
  ADD COLUMN IF NOT EXISTS activo     boolean     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS avatar_url text        NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.usuario ALTER COLUMN rol DROP NOT NULL;

COMMENT ON COLUMN public.usuario.rol    IS 'DEPRECATED v5 — migrado a workspace_member. DROP en 046 (pendiente).';
COMMENT ON COLUMN public.usuario.activo IS 'false = baja global; impide login aunque siga en membresías.';

-- Tablas de dominio: workspace_id nullable primero (NOT NULL post-backfill)
ALTER TABLE public.tarea
  ADD COLUMN IF NOT EXISTS workspace_id uuid NULL REFERENCES public.workspace (id),
  ADD COLUMN IF NOT EXISTS cliente_id   uuid NULL,
  ADD COLUMN IF NOT EXISTS proyecto_id  uuid NULL,
  ADD COLUMN IF NOT EXISTS area_id      uuid NULL;

DO $$ BEGIN
  ALTER TABLE public.tarea
    ADD CONSTRAINT tarea_cliente_fk  FOREIGN KEY (cliente_id)  REFERENCES public.cliente (id)  ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.tarea
    ADD CONSTRAINT tarea_proyecto_fk FOREIGN KEY (proyecto_id) REFERENCES public.proyecto (id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.tarea
    ADD CONSTRAINT tarea_area_fk     FOREIGN KEY (area_id)     REFERENCES public.area (id)     ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_tarea_workspace ON public.tarea (workspace_id);
CREATE INDEX IF NOT EXISTS idx_tarea_cliente   ON public.tarea (cliente_id);
CREATE INDEX IF NOT EXISTS idx_tarea_proyecto  ON public.tarea (proyecto_id);
CREATE INDEX IF NOT EXISTS idx_tarea_area      ON public.tarea (area_id);

ALTER TABLE public.objetivo           ADD COLUMN IF NOT EXISTS workspace_id uuid NULL REFERENCES public.workspace (id);
ALTER TABLE public.evento             ADD COLUMN IF NOT EXISTS workspace_id uuid NULL REFERENCES public.workspace (id);
ALTER TABLE public.recurrencia_evento ADD COLUMN IF NOT EXISTS workspace_id uuid NULL REFERENCES public.workspace (id);
ALTER TABLE public.nota_bitacora      ADD COLUMN IF NOT EXISTS workspace_id uuid NULL REFERENCES public.workspace (id);
ALTER TABLE public.log_accion         ADD COLUMN IF NOT EXISTS workspace_id uuid NULL REFERENCES public.workspace (id);
ALTER TABLE public.orden_trabajo      ADD COLUMN IF NOT EXISTS workspace_id uuid NULL REFERENCES public.workspace (id);
ALTER TABLE public.tipo_trabajo_ot    ADD COLUMN IF NOT EXISTS workspace_id uuid NULL REFERENCES public.workspace (id);
ALTER TABLE public.log_ot             ADD COLUMN IF NOT EXISTS workspace_id uuid NULL REFERENCES public.workspace (id);

CREATE INDEX IF NOT EXISTS idx_objetivo_workspace    ON public.objetivo (workspace_id);
CREATE INDEX IF NOT EXISTS idx_evento_workspace      ON public.evento (workspace_id);
CREATE INDEX IF NOT EXISTS idx_recurrencia_workspace ON public.recurrencia_evento (workspace_id);
CREATE INDEX IF NOT EXISTS idx_nota_workspace        ON public.nota_bitacora (workspace_id);
CREATE INDEX IF NOT EXISTS idx_log_accion_workspace  ON public.log_accion (workspace_id);
CREATE INDEX IF NOT EXISTS idx_ot_workspace          ON public.orden_trabajo (workspace_id);
CREATE INDEX IF NOT EXISTS idx_tipo_ot_workspace     ON public.tipo_trabajo_ot (workspace_id);
CREATE INDEX IF NOT EXISTS idx_log_ot_workspace      ON public.log_ot (workspace_id);

-- OT: correlativo por workspace (reemplaza UNIQUE global)
ALTER TABLE public.orden_trabajo DROP CONSTRAINT IF EXISTS orden_trabajo_numero_key;
DO $$ BEGIN
  ALTER TABLE public.orden_trabajo
    ADD CONSTRAINT orden_trabajo_numero_workspace_unique UNIQUE (workspace_id, numero);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- Guard: PASO 2 debe existir antes de funciones que referencian orden_trabajo.workspace_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'orden_trabajo'
      AND column_name  = 'workspace_id'
  ) THEN
    RAISE EXCEPTION
      '043 PASO 2 incompleto: falta orden_trabajo.workspace_id. '
      'Ejecuta db/migrations/043_paso2_columns.sql o cleanup + 043 completo.';
  END IF;
END $$;


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


-- =============================================================================
-- PASO 5 — NOT NULL post-backfill
-- =============================================================================

ALTER TABLE public.tarea              ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.objetivo           ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.evento             ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.recurrencia_evento ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.nota_bitacora      ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.log_accion         ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.orden_trabajo      ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.tipo_trabajo_ot    ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.log_ot             ALTER COLUMN workspace_id SET NOT NULL;


-- =============================================================================
-- PASO 6 — DROP políticas legacy + CREATE POLICY nuevas
-- Todas las políticas V4 (003/005/023/025/031) se eliminan explícitamente
-- antes de recrear con filtro workspace_id. RLS permissive = el OR entre
-- políticas antiguas y nuevas crearía fuga cross-workspace.
-- =============================================================================

-- Habilitar RLS en tablas nuevas
ALTER TABLE public.organizacion        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizacion_member ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_member    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_preferencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proyecto            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.area                ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- usuario — DROP legacy 003/005 + recrear scoped a workspace_member
-- ===========================================================================
DROP POLICY IF EXISTS sgtd_jefe_usuario_all                  ON public.usuario;
DROP POLICY IF EXISTS sgtd_miembro_usuario_select_propio     ON public.usuario;
DROP POLICY IF EXISTS sgtd_miembro_usuario_select_activos    ON public.usuario;
DROP POLICY IF EXISTS sgtd_miembro_usuario_insert_propio     ON public.usuario;
DROP POLICY IF EXISTS sgtd_miembro_usuario_update_propio     ON public.usuario;

-- Jefe: solo miembros del workspace activo (dropdowns de asignación; no global multi-org)
CREATE POLICY sgtd_jefe_usuario_all ON public.usuario
  FOR ALL TO authenticated
  USING (
    sgtd_es_jefe()
    AND EXISTS (
      SELECT 1 FROM public.workspace_member wm
      WHERE wm.workspace_id = sgtd_workspace_id()
        AND wm.usuario_id   = public.usuario.id
        AND wm.activo       = true
        AND wm.joined_at    IS NOT NULL
    )
  )
  WITH CHECK (
    sgtd_es_jefe()
    AND EXISTS (
      SELECT 1 FROM public.workspace_member wm
      WHERE wm.workspace_id = sgtd_workspace_id()
        AND wm.usuario_id   = public.usuario.id
        AND wm.activo       = true
        AND wm.joined_at    IS NOT NULL
    )
  );

-- Miembro: perfil propio siempre
CREATE POLICY sgtd_miembro_usuario_select_propio ON public.usuario
  FOR SELECT TO authenticated
  USING (sgtd_es_miembro_activo() AND id = auth.uid());

-- Miembro: usuarios del mismo workspace (para dropdowns)
CREATE POLICY sgtd_miembro_usuario_select_ws ON public.usuario
  FOR SELECT TO authenticated
  USING (
    sgtd_es_miembro_activo()
    AND EXISTS (
      SELECT 1 FROM public.workspace_member wm
      WHERE wm.workspace_id = sgtd_workspace_id()
        AND wm.usuario_id   = public.usuario.id
        AND wm.activo       = true
        AND wm.joined_at    IS NOT NULL
    )
  );

-- Miembro: puede crear su propio perfil (primer login)
CREATE POLICY sgtd_miembro_usuario_insert_propio ON public.usuario
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- Miembro: puede actualizar su propio perfil (no puede cambiar rol)
CREATE POLICY sgtd_miembro_usuario_update_propio ON public.usuario
  FOR UPDATE TO authenticated
  USING  (sgtd_es_miembro_activo() AND id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ===========================================================================
-- tarea — DROP legacy 003/005 + recrear con workspace_id
-- ===========================================================================
DROP POLICY IF EXISTS sgtd_jefe_tarea_all       ON public.tarea;
DROP POLICY IF EXISTS sgtd_miembro_tarea_select  ON public.tarea;
DROP POLICY IF EXISTS sgtd_miembro_tarea_insert  ON public.tarea;
DROP POLICY IF EXISTS sgtd_miembro_tarea_update  ON public.tarea;
DROP POLICY IF EXISTS sgtd_miembro_tarea_delete  ON public.tarea;

CREATE POLICY sgtd_jefe_tarea_all ON public.tarea
  FOR ALL TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
  )
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
  );

-- Miembro: ve todas las tareas del workspace (vista equipo, lectura)
CREATE POLICY sgtd_miembro_tarea_select ON public.tarea
  FOR SELECT TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
  );

-- Miembro: crea sus propias tareas
CREATE POLICY sgtd_miembro_tarea_insert ON public.tarea
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND asignado_a = auth.uid()
    AND creado_por = auth.uid()
  );

-- Miembro: actualiza solo las que le están asignadas
CREATE POLICY sgtd_miembro_tarea_update ON public.tarea
  FOR UPDATE TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND asignado_a = auth.uid()
  )
  WITH CHECK (asignado_a = auth.uid());

-- Miembro: borra solo las propias no terminales (soft-delete via RPC preferible)
CREATE POLICY sgtd_miembro_tarea_delete ON public.tarea
  FOR DELETE TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND creado_por = auth.uid()
    AND estado NOT IN ('completada', 'cancelada')
  );

-- ===========================================================================
-- objetivo — DROP legacy 003/005 + recrear con workspace_id
-- Columnas reales: creado_por, responsable_id (migración 002/005)
-- ===========================================================================
DROP POLICY IF EXISTS sgtd_jefe_objetivo_all       ON public.objetivo;
DROP POLICY IF EXISTS sgtd_miembro_objetivo_select  ON public.objetivo;
DROP POLICY IF EXISTS sgtd_miembro_objetivo_insert  ON public.objetivo;
DROP POLICY IF EXISTS sgtd_miembro_objetivo_update  ON public.objetivo;

CREATE POLICY sgtd_jefe_objetivo_all ON public.objetivo
  FOR ALL TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
  )
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
  );

-- Miembro: ve todos los objetivos no cancelados del workspace
CREATE POLICY sgtd_miembro_objetivo_select ON public.objetivo
  FOR SELECT TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND estado != 'cancelado'
  );

-- Miembro: crea objetivos propios con responsable = self o null
CREATE POLICY sgtd_miembro_objetivo_insert ON public.objetivo
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND creado_por = auth.uid()
    AND (responsable_id = auth.uid() OR responsable_id IS NULL)
  );

-- Miembro: actualiza si es creador o responsable
CREATE POLICY sgtd_miembro_objetivo_update ON public.objetivo
  FOR UPDATE TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND (responsable_id = auth.uid() OR creado_por = auth.uid())
  )
  WITH CHECK (
    responsable_id = auth.uid() OR responsable_id IS NULL
  );

-- ===========================================================================
-- evento — DROP legacy 003/005 + recrear con workspace_id
-- ===========================================================================
DROP POLICY IF EXISTS sgtd_jefe_evento_all    ON public.evento;
DROP POLICY IF EXISTS sgtd_miembro_evento_select ON public.evento;
DROP POLICY IF EXISTS sgtd_miembro_evento_insert ON public.evento;
DROP POLICY IF EXISTS sgtd_miembro_evento_update ON public.evento;
DROP POLICY IF EXISTS sgtd_miembro_evento_delete ON public.evento;

CREATE POLICY sgtd_jefe_evento_all ON public.evento
  FOR ALL TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
  )
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
  );

CREATE POLICY sgtd_miembro_evento_select ON public.evento
  FOR SELECT TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND usuario_id = auth.uid()
  );

CREATE POLICY sgtd_miembro_evento_insert ON public.evento
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND usuario_id = auth.uid()
  );

CREATE POLICY sgtd_miembro_evento_update ON public.evento
  FOR UPDATE TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND usuario_id = auth.uid()
  )
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY sgtd_miembro_evento_delete ON public.evento
  FOR DELETE TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND usuario_id = auth.uid()
  );

-- ===========================================================================
-- recurrencia_evento — DROP legacy 025 + recrear con workspace_id
-- ===========================================================================
DROP POLICY IF EXISTS sgtd_jefe_recurrencia_all       ON public.recurrencia_evento;
DROP POLICY IF EXISTS sgtd_miembro_recurrencia_select  ON public.recurrencia_evento;
DROP POLICY IF EXISTS sgtd_miembro_recurrencia_insert  ON public.recurrencia_evento;
DROP POLICY IF EXISTS sgtd_miembro_recurrencia_update  ON public.recurrencia_evento;
DROP POLICY IF EXISTS sgtd_miembro_recurrencia_delete  ON public.recurrencia_evento;

CREATE POLICY sgtd_jefe_recurrencia_all ON public.recurrencia_evento
  FOR ALL TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
  )
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
  );

CREATE POLICY sgtd_miembro_recurrencia_select ON public.recurrencia_evento
  FOR SELECT TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND usuario_id = auth.uid()
  );

CREATE POLICY sgtd_miembro_recurrencia_insert ON public.recurrencia_evento
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND usuario_id = auth.uid()
  );

CREATE POLICY sgtd_miembro_recurrencia_update ON public.recurrencia_evento
  FOR UPDATE TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND usuario_id = auth.uid()
  )
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY sgtd_miembro_recurrencia_delete ON public.recurrencia_evento
  FOR DELETE TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND usuario_id = auth.uid()
  );

-- ===========================================================================
-- nota_bitacora — DROP legacy 003/005/031 + recrear con workspace_id
-- 031 amplió SELECT con visibilidad='todos'; se mantiene esa regla.
-- ===========================================================================
DROP POLICY IF EXISTS sgtd_jefe_nota_bitacora_all  ON public.nota_bitacora;
DROP POLICY IF EXISTS sgtd_miembro_nota_select     ON public.nota_bitacora;
DROP POLICY IF EXISTS sgtd_miembro_nota_insert     ON public.nota_bitacora;
DROP POLICY IF EXISTS sgtd_miembro_nota_update     ON public.nota_bitacora;
DROP POLICY IF EXISTS sgtd_miembro_nota_delete     ON public.nota_bitacora;

CREATE POLICY sgtd_jefe_nota_bitacora_all ON public.nota_bitacora
  FOR ALL TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
  )
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
  );

-- SELECT: propias + las del equipo con visibilidad='todos' (031)
CREATE POLICY sgtd_miembro_nota_select ON public.nota_bitacora
  FOR SELECT TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND (usuario_id = auth.uid() OR visibilidad = 'todos')
  );

CREATE POLICY sgtd_miembro_nota_insert ON public.nota_bitacora
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND usuario_id = auth.uid()
  );

CREATE POLICY sgtd_miembro_nota_update ON public.nota_bitacora
  FOR UPDATE TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND usuario_id = auth.uid()
  )
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY sgtd_miembro_nota_delete ON public.nota_bitacora
  FOR DELETE TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND usuario_id    = auth.uid()
    AND convertida_en IS NULL
  );

-- ===========================================================================
-- log_accion — DROP legacy 003/005 + recrear con workspace_id
-- ===========================================================================
DROP POLICY IF EXISTS sgtd_jefe_log_accion_all ON public.log_accion;
DROP POLICY IF EXISTS sgtd_miembro_log_select  ON public.log_accion;
DROP POLICY IF EXISTS sgtd_miembro_log_insert  ON public.log_accion;

CREATE POLICY sgtd_jefe_log_accion_all ON public.log_accion
  FOR ALL TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
  )
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
  );

CREATE POLICY sgtd_miembro_log_select ON public.log_accion
  FOR SELECT TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND usuario_id = auth.uid()
  );

CREATE POLICY sgtd_miembro_log_insert ON public.log_accion
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND usuario_id     = auth.uid()
    AND leido_por_jefe = false
  );

-- ===========================================================================
-- orden_trabajo — DROP legacy 023 + recrear con workspace_id (solo interno)
-- ===========================================================================
DROP POLICY IF EXISTS sgtd_jefe_ot_all       ON public.orden_trabajo;
DROP POLICY IF EXISTS sgtd_miembro_ot_select  ON public.orden_trabajo;
DROP POLICY IF EXISTS sgtd_miembro_ot_insert  ON public.orden_trabajo;
DROP POLICY IF EXISTS sgtd_miembro_ot_update  ON public.orden_trabajo;
DROP POLICY IF EXISTS sgtd_miembro_ot_delete  ON public.orden_trabajo;

CREATE POLICY sgtd_jefe_ot_all ON public.orden_trabajo
  FOR ALL TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
    AND (SELECT tipo FROM public.workspace WHERE id = workspace_id) = 'interno'
  )
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
    AND (SELECT tipo FROM public.workspace WHERE id = workspace_id) = 'interno'
  );

-- Miembro: ve sus propias OT (023)
CREATE POLICY sgtd_miembro_ot_select ON public.orden_trabajo
  FOR SELECT TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND creado_por = auth.uid()
    AND (SELECT tipo FROM public.workspace WHERE id = workspace_id) = 'interno'
  );

-- Miembro: crea borradores propios (023)
CREATE POLICY sgtd_miembro_ot_insert ON public.orden_trabajo
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND creado_por  = auth.uid()
    AND estado      IN ('borrador', 'pendiente')
    AND aprobado_por IS NULL
    AND (SELECT tipo FROM public.workspace WHERE id = workspace_id) = 'interno'
  );

-- Miembro: edita solo borrador/rechazada propios (023)
CREATE POLICY sgtd_miembro_ot_update ON public.orden_trabajo
  FOR UPDATE TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND creado_por = auth.uid()
    AND estado     IN ('borrador', 'rechazada')
    AND (SELECT tipo FROM public.workspace WHERE id = workspace_id) = 'interno'
  )
  WITH CHECK (creado_por = auth.uid() AND aprobado_por IS NULL);

-- Miembro: borra solo borradores propios (023)
CREATE POLICY sgtd_miembro_ot_delete ON public.orden_trabajo
  FOR DELETE TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND creado_por = auth.uid()
    AND estado     = 'borrador'
    AND (SELECT tipo FROM public.workspace WHERE id = workspace_id) = 'interno'
  );

-- ===========================================================================
-- log_ot — DROP legacy 010/023 + recrear con workspace_id
-- ===========================================================================
DROP POLICY IF EXISTS sgtd_jefe_log_ot_all       ON public.log_ot;
DROP POLICY IF EXISTS sgtd_miembro_log_ot_select  ON public.log_ot;
DROP POLICY IF EXISTS sgtd_miembro_log_ot_insert  ON public.log_ot;

CREATE POLICY sgtd_jefe_log_ot_all ON public.log_ot
  FOR ALL TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
  )
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
  );

CREATE POLICY sgtd_miembro_log_ot_select ON public.log_ot
  FOR SELECT TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND EXISTS (
      SELECT 1 FROM public.orden_trabajo ot
      WHERE ot.id = log_ot.ot_id AND ot.creado_por = auth.uid()
    )
  );

CREATE POLICY sgtd_miembro_log_ot_insert ON public.log_ot
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND usuario_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.orden_trabajo ot
      WHERE ot.id = log_ot.ot_id AND ot.creado_por = auth.uid()
    )
  );

-- ===========================================================================
-- tipo_trabajo_ot — DROP legacy + recrear con workspace_id
-- Legacy 005/schema: sgtd_miembro_tipo_trabajo_select (sin _ot_ intermedio)
-- ===========================================================================
DROP POLICY IF EXISTS sgtd_jefe_tipo_trabajo_ot_all       ON public.tipo_trabajo_ot;
DROP POLICY IF EXISTS sgtd_miembro_tipo_trabajo_ot_select  ON public.tipo_trabajo_ot;
DROP POLICY IF EXISTS sgtd_miembro_tipo_trabajo_select     ON public.tipo_trabajo_ot;

CREATE POLICY sgtd_jefe_tipo_trabajo_ot_all ON public.tipo_trabajo_ot
  FOR ALL TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
  )
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
  );

CREATE POLICY sgtd_miembro_tipo_trabajo_ot_select ON public.tipo_trabajo_ot
  FOR SELECT TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND activo = true
  );

-- ===========================================================================
-- Tablas nuevas: organizacion / workspace / miembros / catálogos
-- ===========================================================================

-- organizacion
CREATE POLICY organizacion_select ON public.organizacion
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.organizacion_member om
            WHERE om.organizacion_id = organizacion.id AND om.usuario_id = auth.uid() AND om.activo = true)
    OR EXISTS (SELECT 1 FROM public.workspace_member wm
               JOIN public.workspace w ON w.id = wm.workspace_id
               WHERE w.organizacion_id = organizacion.id AND wm.usuario_id = auth.uid()
                 AND wm.activo = true AND wm.joined_at IS NOT NULL)
  );
CREATE POLICY organizacion_insert ON public.organizacion
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY organizacion_update ON public.organizacion
  FOR UPDATE USING (sgtd_es_org_admin(organizacion.id));

-- workspace
CREATE POLICY workspace_select ON public.workspace
  FOR SELECT USING (sgtd_puede_acceder_workspace(workspace.id) OR sgtd_es_org_admin(workspace.organizacion_id));
CREATE POLICY workspace_insert ON public.workspace
  FOR INSERT WITH CHECK (sgtd_es_org_admin(organizacion_id));
CREATE POLICY workspace_update ON public.workspace
  FOR UPDATE USING (sgtd_es_org_admin(organizacion_id));

-- organizacion_member
CREATE POLICY org_member_select ON public.organizacion_member
  FOR SELECT USING (sgtd_es_org_admin(organizacion_id) OR usuario_id = auth.uid());
CREATE POLICY org_member_insert ON public.organizacion_member
  FOR INSERT WITH CHECK (sgtd_es_org_admin(organizacion_id));

-- workspace_member
CREATE POLICY ws_member_select ON public.workspace_member
  FOR SELECT USING (
    sgtd_puede_acceder_workspace(workspace_id)
    OR sgtd_es_org_admin((SELECT organizacion_id FROM public.workspace WHERE id = workspace_id))
  );
CREATE POLICY ws_member_insert ON public.workspace_member
  FOR INSERT WITH CHECK (
    sgtd_es_org_admin((SELECT organizacion_id FROM public.workspace WHERE id = workspace_id))
    OR sgtd_es_jefe()
  );
CREATE POLICY ws_member_update ON public.workspace_member
  FOR UPDATE USING (
    sgtd_es_org_admin((SELECT organizacion_id FROM public.workspace WHERE id = workspace_id))
  );

-- usuario_preferencia (solo el propio usuario)
CREATE POLICY usuario_preferencia_select ON public.usuario_preferencia
  FOR SELECT USING (usuario_id = auth.uid());
CREATE POLICY usuario_preferencia_insert ON public.usuario_preferencia
  FOR INSERT WITH CHECK (usuario_id = auth.uid());
CREATE POLICY usuario_preferencia_update ON public.usuario_preferencia
  FOR UPDATE USING (usuario_id = auth.uid());

-- cliente (org_admin OR jefe — D4)
CREATE POLICY cliente_select ON public.cliente
  FOR SELECT USING (
    workspace_id = sgtd_workspace_id() AND sgtd_puede_acceder_workspace(workspace_id)
  );
CREATE POLICY cliente_insert ON public.cliente
  FOR INSERT WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND (SELECT tipo FROM public.workspace WHERE id = workspace_id) = 'agencia'
    AND (sgtd_es_jefe() OR sgtd_es_org_admin((SELECT organizacion_id FROM public.workspace WHERE id = workspace_id)))
  );
CREATE POLICY cliente_update ON public.cliente
  FOR UPDATE USING (
    workspace_id = sgtd_workspace_id()
    AND (sgtd_es_jefe() OR sgtd_es_org_admin((SELECT organizacion_id FROM public.workspace WHERE id = workspace_id)))
  );

-- proyecto
CREATE POLICY proyecto_select ON public.proyecto
  FOR SELECT USING (
    workspace_id = sgtd_workspace_id() AND sgtd_puede_acceder_workspace(workspace_id)
  );
CREATE POLICY proyecto_insert ON public.proyecto
  FOR INSERT WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND (SELECT tipo FROM public.workspace WHERE id = workspace_id) = 'agencia'
    AND (sgtd_es_jefe() OR sgtd_es_org_admin((SELECT organizacion_id FROM public.workspace WHERE id = workspace_id)))
  );
CREATE POLICY proyecto_update ON public.proyecto
  FOR UPDATE USING (
    workspace_id = sgtd_workspace_id()
    AND (sgtd_es_jefe() OR sgtd_es_org_admin((SELECT organizacion_id FROM public.workspace WHERE id = workspace_id)))
  );

-- area
CREATE POLICY area_select ON public.area
  FOR SELECT USING (
    workspace_id = sgtd_workspace_id() AND sgtd_puede_acceder_workspace(workspace_id)
  );
CREATE POLICY area_insert ON public.area
  FOR INSERT WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND (SELECT tipo FROM public.workspace WHERE id = workspace_id) = 'agencia'
    AND (sgtd_es_jefe() OR sgtd_es_org_admin((SELECT organizacion_id FROM public.workspace WHERE id = workspace_id)))
  );
CREATE POLICY area_update ON public.area
  FOR UPDATE USING (
    workspace_id = sgtd_workspace_id()
    AND (sgtd_es_jefe() OR sgtd_es_org_admin((SELECT organizacion_id FROM public.workspace WHERE id = workspace_id)))
  );


-- =============================================================================
-- PASO 7 — TRIGGERS + VISTA tarea_activa
-- =============================================================================

-- Trigger: proyecto.cliente_id debe pertenecer al mismo workspace
CREATE OR REPLACE FUNCTION public.proyecto_cliente_integridad()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.cliente_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.cliente WHERE id = NEW.cliente_id AND workspace_id = NEW.workspace_id) THEN
      RAISE EXCEPTION 'cliente_id no pertenece al workspace del proyecto.';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER proyecto_cliente_integridad_trigger
  BEFORE INSERT OR UPDATE ON public.proyecto
  FOR EACH ROW EXECUTE FUNCTION public.proyecto_cliente_integridad();

-- Trigger: integridad agencia en tarea
CREATE OR REPLACE FUNCTION public.tarea_agencia_integridad()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tipo text;
BEGIN
  SELECT tipo INTO v_tipo FROM public.workspace WHERE id = NEW.workspace_id;

  IF v_tipo = 'interno' THEN
    IF NEW.cliente_id IS NOT NULL OR NEW.proyecto_id IS NOT NULL OR NEW.area_id IS NOT NULL THEN
      RAISE EXCEPTION 'Workspace interno: cliente_id, proyecto_id y area_id deben ser NULL.';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.cliente_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cliente WHERE id = NEW.cliente_id AND workspace_id = NEW.workspace_id
  ) THEN RAISE EXCEPTION 'cliente_id no pertenece al workspace de la tarea.'; END IF;

  IF NEW.proyecto_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.proyecto WHERE id = NEW.proyecto_id AND workspace_id = NEW.workspace_id
  ) THEN RAISE EXCEPTION 'proyecto_id no pertenece al workspace de la tarea.'; END IF;

  IF NEW.area_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.area WHERE id = NEW.area_id AND workspace_id = NEW.workspace_id
  ) THEN RAISE EXCEPTION 'area_id no pertenece al workspace de la tarea.'; END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER tarea_agencia_integridad_trigger
  BEFORE INSERT OR UPDATE ON public.tarea
  FOR EACH ROW EXECUTE FUNCTION public.tarea_agencia_integridad();

-- Vista tarea_activa — recrear con workspace_id, cliente_id, proyecto_id, area_id
-- Fix 040 preservado: fecha_planificada IS NOT NULL antes de evaluar atrasada
DROP VIEW IF EXISTS public.tarea_activa;

CREATE VIEW public.tarea_activa
WITH (security_invoker = true) AS
SELECT t.*,
  CASE
    WHEN t.estado IN ('completada', 'cancelada')                 THEN NULL
    WHEN t.tipo = 'planificada'
         AND t.fecha_planificada IS NOT NULL
         AND t.fecha_planificada < CURRENT_DATE
         AND t.estado IN ('pendiente', 'en_progreso')            THEN 'atrasada'
    WHEN t.reprogramaciones > 0                                  THEN 'reprogramada'
    ELSE 'creada'
  END::text AS situacion
FROM public.tarea t
WHERE t.eliminada_en IS NULL;

GRANT SELECT ON public.tarea_activa TO authenticated;

COMMENT ON VIEW public.tarea_activa IS
  'Vista operativa V5. security_invoker=true respeta RLS. '
  'Incluye workspace_id, cliente_id, proyecto_id, area_id.';


-- =============================================================================
-- PASO 8 — REBIND sgtd_enviar_ot
-- Cuerpo idéntico a 036; solo cambia la generación del número.
-- Firma original: (p_ot_id uuid, p_usuario_id uuid) — SECURITY INVOKER
-- Flujo: borrador → pendiente (NO aprobada)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sgtd_enviar_ot(
  p_ot_id      uuid,
  p_usuario_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_ot record;
BEGIN
  SELECT id, estado, creado_por, descripcion, area_destino, fecha_estimada, numero, workspace_id
  INTO v_ot
  FROM public.orden_trabajo
  WHERE id = p_ot_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OT no encontrada (id: %)', p_ot_id USING ERRCODE = 'P0001';
  END IF;

  IF v_ot.estado <> 'borrador' THEN
    RAISE EXCEPTION 'Solo se puede enviar una OT en borrador (estado actual: "%")', v_ot.estado
      USING ERRCODE = 'P0002';
  END IF;

  -- Permiso: creador o jefe (036)
  IF v_ot.creado_por <> p_usuario_id AND NOT public.sgtd_es_jefe() THEN
    RAISE EXCEPTION 'Sin permiso para enviar esta OT' USING ERRCODE = 'P0003';
  END IF;

  -- Validaciones de campos (036)
  IF btrim(coalesce(v_ot.descripcion, '')) IN ('', '(borrador)') THEN
    RAISE EXCEPTION 'La descripción es obligatoria para enviar' USING ERRCODE = 'P0004';
  END IF;

  IF btrim(coalesce(v_ot.area_destino, '')) IN ('', '(pendiente)') THEN
    RAISE EXCEPTION 'El área destino es obligatoria para enviar' USING ERRCODE = 'P0005';
  END IF;

  IF v_ot.fecha_estimada IS NULL THEN
    RAISE EXCEPTION 'La fecha estimada es obligatoria para enviar' USING ERRCODE = 'P0006';
  END IF;

  IF v_ot.fecha_estimada < CURRENT_DATE THEN
    RAISE EXCEPTION 'La fecha estimada no puede ser anterior a hoy' USING ERRCODE = 'P0007';
  END IF;

  -- Número correlativo por workspace (idempotente: solo asigna si aún no tiene)
  IF v_ot.numero IS NULL OR btrim(v_ot.numero) = '' THEN
    UPDATE public.orden_trabajo
    SET numero     = public.sgtd_generar_numero_ot(v_ot.workspace_id),
        updated_at = now()
    WHERE id = p_ot_id;
  END IF;

  -- Transición: borrador → pendiente (036)
  UPDATE public.orden_trabajo
  SET estado     = 'pendiente',
      updated_at = now()
  WHERE id = p_ot_id;

  -- Log con schema real de log_ot (ot_id, estado_anterior, estado_nuevo)
  INSERT INTO public.log_ot (ot_id, workspace_id, usuario_id, accion, estado_anterior, estado_nuevo)
  VALUES (p_ot_id, v_ot.workspace_id, p_usuario_id, 'enviada', 'borrador', 'pendiente');

END;
$$;

REVOKE ALL ON FUNCTION public.sgtd_enviar_ot(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_enviar_ot(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.sgtd_enviar_ot IS
  'Flujo OT: borrador → pendiente. Número OT-TI-XXXX por workspace (idempotente). '
  'Firma idéntica a 036 (p_ot_id, p_usuario_id). Solo workspace interno (D2).';


COMMIT;


-- =============================================================================
-- SMOKE TESTS — ejecutar en staging antes de prod
-- =============================================================================

-- T0: ¿043 aplicada? (ver bloque identificador al inicio del archivo)
-- migration_043_ok=true AND fn_workspace_id=true AND tareas_sin_ws=0 → OK

-- T1: workspace_id NOT NULL en tablas operativas (todas deben retornar 0)
-- SELECT COUNT(*) FROM public.tarea              WHERE workspace_id IS NULL;
-- SELECT COUNT(*) FROM public.objetivo           WHERE workspace_id IS NULL;
-- SELECT COUNT(*) FROM public.orden_trabajo      WHERE workspace_id IS NULL;
-- SELECT COUNT(*) FROM public.log_accion         WHERE workspace_id IS NULL;

-- T2: membresías = usuarios activos V4
-- SELECT COUNT(*) FROM public.workspace_member;

-- T3: ⚠ sgtd_workspace_id() con header x-workspace-id en InsForge Dev
-- SELECT sgtd_workspace_id();  -- debe retornar UUID del header

-- T4: sgtd_puede_acceder_workspace = true para miembro activo
-- SELECT sgtd_puede_acceder_workspace('<ws_id_default>');

-- T5: Aislamiento cross-workspace — 0 filas en workspace ajeno
-- Autenticarse como usuario ws A, enviar header ws B → SELECT * FROM tarea → 0 filas

-- T6: Trigger interno rechaza campos agencia
-- INSERT INTO tarea (workspace_id=<interno_id>, cliente_id=<uuid>...) → EXCEPTION

-- T7: Correlativo OT por workspace
-- SELECT sgtd_generar_numero_ot('<ws_id>');  -- OT-TI-0001

-- T8: sgtd_es_jefe() = true para jefe con header correcto
-- SELECT sgtd_es_jefe();  -- true (autenticado como jefe)

-- T9: tarea_activa no marca atrasada si fecha_planificada IS NULL
-- SELECT * FROM tarea_activa WHERE fecha_planificada IS NULL AND situacion = 'atrasada';  -- 0 filas

-- T10: sgtd_enviar_ot — OT en borrador → pendiente con número OT-TI-XXXX
-- T11: miembro puede ver objetivos no cancelados del workspace

-- T12: sin políticas legacy huérfanas en dominio (debe retornar 0 filas):
-- SELECT policyname, tablename FROM pg_policies
-- WHERE schemaname = 'public'
--   AND policyname LIKE 'sgtd_%'
--   AND tablename IN (
--     'tarea','objetivo','evento','recurrencia_evento','nota_bitacora',
--     'log_accion','orden_trabajo','log_ot','tipo_trabajo_ot'
--   )
--   AND COALESCE(qual, '') NOT LIKE '%workspace_id%'
--   AND COALESCE(with_check, '') NOT LIKE '%workspace_id%';
-- usuario: jefe/miembro usan workspace_member (no columna workspace_id en la fila)


-- =============================================================================
-- ROLLBACK — solo staging, nunca prod
-- =============================================================================

-- DROP TABLE IF EXISTS public.usuario_preferencia CASCADE;
-- DROP TABLE IF EXISTS public.area CASCADE;
-- DROP TABLE IF EXISTS public.proyecto CASCADE;
-- DROP TABLE IF EXISTS public.cliente CASCADE;
-- DROP TABLE IF EXISTS public.workspace_member CASCADE;
-- DROP TABLE IF EXISTS public.organizacion_member CASCADE;
-- DROP TABLE IF EXISTS public.workspace CASCADE;
-- DROP TABLE IF EXISTS public.organizacion CASCADE;
-- ALTER TABLE public.tarea DROP COLUMN IF EXISTS workspace_id, DROP COLUMN IF EXISTS cliente_id, DROP COLUMN IF EXISTS proyecto_id, DROP COLUMN IF EXISTS area_id;
-- ALTER TABLE public.objetivo           DROP COLUMN IF EXISTS workspace_id;
-- ALTER TABLE public.evento             DROP COLUMN IF EXISTS workspace_id;
-- ALTER TABLE public.recurrencia_evento DROP COLUMN IF EXISTS workspace_id;
-- ALTER TABLE public.nota_bitacora      DROP COLUMN IF EXISTS workspace_id;
-- ALTER TABLE public.log_accion         DROP COLUMN IF EXISTS workspace_id;
-- ALTER TABLE public.orden_trabajo      DROP COLUMN IF EXISTS workspace_id;
-- ALTER TABLE public.tipo_trabajo_ot    DROP COLUMN IF EXISTS workspace_id;
-- ALTER TABLE public.log_ot             DROP COLUMN IF EXISTS workspace_id;
-- ALTER TABLE public.usuario DROP COLUMN IF EXISTS activo, DROP COLUMN IF EXISTS avatar_url, DROP COLUMN IF EXISTS updated_at;
-- ALTER TABLE public.usuario ALTER COLUMN rol SET NOT NULL;
-- DROP FUNCTION IF EXISTS public.sgtd_workspace_id();
-- DROP FUNCTION IF EXISTS public.sgtd_puede_acceder_workspace(uuid);
-- DROP FUNCTION IF EXISTS public.sgtd_es_jefe();
-- DROP FUNCTION IF EXISTS public.sgtd_es_miembro_activo();
-- DROP FUNCTION IF EXISTS public.sgtd_es_org_admin(uuid);
-- DROP FUNCTION IF EXISTS public.sgtd_generar_numero_ot(uuid);
-- DROP FUNCTION IF EXISTS public.tarea_agencia_integridad();
-- DROP FUNCTION IF EXISTS public.proyecto_cliente_integridad();
-- (Restaurar sgtd_enviar_ot original desde 036)


-- =============================================================================
-- POST-MIGRACIÓN: checklist
-- =============================================================================
-- [ ] ⚠ Cambiar nombre/slug de org en backfill antes de prod
-- [ ] ⚠ Validar T3 (sgtd_workspace_id con header) en InsForge Dev
-- [ ] Ejecutar T1–T12 en staging (T12 = políticas legacy sin workspace_id)
-- [ ] Marcar 043 ✅ en CONTEXT.mdc §12 (Dev / Staging / Prod)
-- [ ] Actualizar CONTEXT/CONTEXT.md §8 schema V5
-- [ ] Actualizar .cursor/rules/sgtd-rbac.mdc (roles por workspace)
-- [ ] Añadir header x-workspace-id en @insforge/sdk (workspaceStore)
-- [ ] Verificar tarea_activa incluye cliente_id, proyecto_id, area_id en frontend
-- [ ] Agregar identificador 043 en db/migrations/README.md
-- [ ] Si no hay usuario con rol=jefe: insertar org_admin manualmente post-backfill
-- =============================================================================