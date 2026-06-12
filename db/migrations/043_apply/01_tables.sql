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
