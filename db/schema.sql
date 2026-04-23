-- =============================================================================
-- SGTD (Agenda TI v3) - Esquema consolidado
-- Generado desde tipos frontend + migraciones existentes (002, 003, 004).
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Tipos de dominio (como CHECK para máxima compatibilidad)
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- Tabla de usuarios de aplicación (perfil SGTD)
-- `id` referencia al usuario autenticado en InsForge/Auth.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usuario (
  id uuid PRIMARY KEY,
  nombre text NOT NULL,
  email text NOT NULL UNIQUE,
  rol text NOT NULL CHECK (rol IN ('jefe', 'miembro')),
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Objetivos
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.objetivo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descripcion text,
  fecha_limite date,
  estado text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'completado', 'cancelado')),
  creado_por uuid NOT NULL REFERENCES public.usuario (id),
  -- Migración 002: responsable del objetivo.
  responsable_id uuid REFERENCES public.usuario (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Tareas
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tarea (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descripcion text,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (
    estado IN ('pendiente', 'en_progreso', 'reprogramada', 'completada', 'bloqueada', 'atrasada', 'cancelada')
  ),
  tipo text NOT NULL DEFAULT 'planificada' CHECK (tipo IN ('planificada', 'no_planificada', 'libre')),
  prioridad text NOT NULL DEFAULT 'media' CHECK (prioridad IN ('alta', 'media', 'baja')),
  fecha_planificada date,
  semana_planificada text,
  fecha_completada timestamptz,
  asignado_a uuid NOT NULL REFERENCES public.usuario (id),
  objetivo_id uuid REFERENCES public.objetivo (id) ON DELETE SET NULL,
  creado_por uuid NOT NULL REFERENCES public.usuario (id),
  es_imprevisto boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Eventos
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.evento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('reunion', 'entrega', 'personal', 'otro')),
  fecha_inicio timestamptz NOT NULL,
  fecha_fin timestamptz NOT NULL,
  usuario_id uuid NOT NULL REFERENCES public.usuario (id),
  es_recurrente boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evento_rango_fechas_chk CHECK (fecha_fin >= fecha_inicio)
);

-- -----------------------------------------------------------------------------
-- Notas de bitácora
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nota_bitacora (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contenido text NOT NULL,
  usuario_id uuid NOT NULL REFERENCES public.usuario (id),
  objetivo_id uuid REFERENCES public.objetivo (id) ON DELETE SET NULL,
  visibilidad text NOT NULL DEFAULT 'todos' CHECK (visibilidad IN ('todos', 'solo_jefe', 'privado')),
  -- Migración 004: marca en qué entidad se convirtió la nota (si aplica).
  convertida_en text CHECK (convertida_en IN ('tarea', 'evento')) DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Log de acciones sobre tareas
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.log_accion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarea_id uuid REFERENCES public.tarea (id) ON DELETE SET NULL,
  usuario_id uuid NOT NULL REFERENCES public.usuario (id),
  tipo_accion text NOT NULL CHECK (
    tipo_accion IN ('creada', 'reprogramada', 'eliminada', 'estado_cambiado', 'prioridad_cambiada', 'editada', 'cancelada')
  ),
  valor_anterior jsonb,
  valor_nuevo jsonb,
  justificacion text,
  leido_por_jefe boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Configuración de semana
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.configuracion_semana (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha_inicio_semana date NOT NULL UNIQUE,
  notas_semana text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Índices recomendados para consultas habituales
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_objetivo_creado_por ON public.objetivo (creado_por);
CREATE INDEX IF NOT EXISTS idx_objetivo_responsable_id ON public.objetivo (responsable_id);
CREATE INDEX IF NOT EXISTS idx_tarea_asignado_a ON public.tarea (asignado_a);
CREATE INDEX IF NOT EXISTS idx_tarea_objetivo_id ON public.tarea (objetivo_id);
CREATE INDEX IF NOT EXISTS idx_tarea_semana_planificada ON public.tarea (semana_planificada);
CREATE INDEX IF NOT EXISTS idx_tarea_estado ON public.tarea (estado);
CREATE INDEX IF NOT EXISTS idx_evento_usuario_id ON public.evento (usuario_id);
CREATE INDEX IF NOT EXISTS idx_evento_fecha_inicio ON public.evento (fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_nota_bitacora_usuario_id ON public.nota_bitacora (usuario_id);
CREATE INDEX IF NOT EXISTS idx_nota_bitacora_objetivo_id ON public.nota_bitacora (objetivo_id);
CREATE INDEX IF NOT EXISTS idx_log_accion_tarea_id ON public.log_accion (tarea_id);
CREATE INDEX IF NOT EXISTS idx_log_accion_usuario_id ON public.log_accion (usuario_id);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarea ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objetivo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nota_bitacora ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_accion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion_semana ENABLE ROW LEVEL SECURITY;

-- Función de soporte para rol jefe (migración 003)
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

-- Políticas de acceso total para jefe (migración 003)
DROP POLICY IF EXISTS sgtd_jefe_usuario_all ON public.usuario;
CREATE POLICY sgtd_jefe_usuario_all ON public.usuario
  FOR ALL
  TO authenticated
  USING (public.sgtd_es_jefe())
  WITH CHECK (public.sgtd_es_jefe());

DROP POLICY IF EXISTS sgtd_jefe_tarea_all ON public.tarea;
CREATE POLICY sgtd_jefe_tarea_all ON public.tarea
  FOR ALL
  TO authenticated
  USING (public.sgtd_es_jefe())
  WITH CHECK (public.sgtd_es_jefe());

DROP POLICY IF EXISTS sgtd_jefe_objetivo_all ON public.objetivo;
CREATE POLICY sgtd_jefe_objetivo_all ON public.objetivo
  FOR ALL
  TO authenticated
  USING (public.sgtd_es_jefe())
  WITH CHECK (public.sgtd_es_jefe());

DROP POLICY IF EXISTS sgtd_jefe_evento_all ON public.evento;
CREATE POLICY sgtd_jefe_evento_all ON public.evento
  FOR ALL
  TO authenticated
  USING (public.sgtd_es_jefe())
  WITH CHECK (public.sgtd_es_jefe());

DROP POLICY IF EXISTS sgtd_jefe_nota_bitacora_all ON public.nota_bitacora;
CREATE POLICY sgtd_jefe_nota_bitacora_all ON public.nota_bitacora
  FOR ALL
  TO authenticated
  USING (public.sgtd_es_jefe())
  WITH CHECK (public.sgtd_es_jefe());

DROP POLICY IF EXISTS sgtd_jefe_log_accion_all ON public.log_accion;
CREATE POLICY sgtd_jefe_log_accion_all ON public.log_accion
  FOR ALL
  TO authenticated
  USING (public.sgtd_es_jefe())
  WITH CHECK (public.sgtd_es_jefe());

DROP POLICY IF EXISTS sgtd_jefe_configuracion_semana_all ON public.configuracion_semana;
CREATE POLICY sgtd_jefe_configuracion_semana_all ON public.configuracion_semana
  FOR ALL
  TO authenticated
  USING (public.sgtd_es_jefe())
  WITH CHECK (public.sgtd_es_jefe());

COMMIT;
