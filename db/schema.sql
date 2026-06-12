-- =============================================================================
-- SGTD (Agenda TI v3) — Esquema consolidado (referencia)
-- schema.sql
--
-- Entornos vivos: aplicar migraciones 002–040 en orden (no ejecutar este archivo
-- sobre una BD ya migrada). Modelo tarea v1.1 documentado en web/CONTEXT/TAREA-MODEL.md.
--
-- Cambios clave post-040:
--   - estado_tarea: 4 valores (pendiente, en_progreso, completada, cancelada)
--   - situacion calculada en vista tarea_activa (atrasada / reprogramada / creada)
--   - reprogramaciones, prioridad critica, soft-delete eliminada_en
--   - Sin trigger que escriba 'atrasada'; sin RPCs bloquear/desbloquear
--
-- USO: Referencia / fresh install parcial. Fuente operativa: db/migrations/.
-- Para entornos existentes, aplicar las migraciones 008–011 en orden.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- usuario
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usuario (
  id         uuid        PRIMARY KEY,
  nombre     text        NOT NULL,
  email      text        NOT NULL UNIQUE,
  rol        text        NOT NULL CHECK (rol IN ('jefe', 'miembro')),
  activo     boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- objetivo
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.objetivo (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo         text        NOT NULL,
  descripcion    text,
  fecha_limite   date,
  estado         text        NOT NULL DEFAULT 'activo'
                             CHECK (estado IN ('activo', 'completado', 'cancelado')),
  creado_por     uuid        NOT NULL REFERENCES public.usuario (id),
  responsable_id uuid        REFERENCES public.usuario (id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- nota_bitacora
-- (declarada antes de tarea por la FK nota_origen_id)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nota_bitacora (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contenido      text        NOT NULL,
  usuario_id     uuid        NOT NULL REFERENCES public.usuario (id),
  objetivo_id    uuid        REFERENCES public.objetivo (id) ON DELETE SET NULL,
  visibilidad    text        NOT NULL DEFAULT 'todos'
                             CHECK (visibilidad IN ('todos', 'solo_jefe', 'privado')),
  convertida_en  text        CHECK (convertida_en IN ('tarea', 'evento')) DEFAULT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- tarea
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tarea (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo              text        NOT NULL,
  descripcion         text,
  estado              text        NOT NULL DEFAULT 'pendiente'
                                  CHECK (estado IN (
                                    'pendiente', 'en_progreso', 'completada', 'cancelada'
                                  )),
  tipo                text        NOT NULL DEFAULT 'planificada'
                                  CHECK (tipo IN ('planificada', 'no_planificada')),
  prioridad           text        NOT NULL DEFAULT 'media'
                                  CHECK (prioridad IN ('critica', 'alta', 'media', 'baja')),
  reprogramaciones    integer     NOT NULL DEFAULT 0,
  eliminada_en        timestamptz,
  sla_atrasada_notificada_at timestamptz,
  fecha_planificada   date,
  semana_planificada  text,
  fecha_completada    timestamptz,
  asignado_a          uuid        NOT NULL REFERENCES public.usuario (id),
  objetivo_id         uuid        REFERENCES public.objetivo (id) ON DELETE SET NULL,
  creado_por          uuid        NOT NULL REFERENCES public.usuario (id),
  es_imprevisto       boolean     NOT NULL DEFAULT false,
  nota_origen_id      uuid        REFERENCES public.nota_bitacora (id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- evento
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.evento (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo         text        NOT NULL,
  tipo           text        NOT NULL
                             CHECK (tipo IN ('reunion', 'entrega', 'personal', 'otro')),
  fecha_inicio   timestamptz NOT NULL,
  fecha_fin      timestamptz NOT NULL,
  usuario_id     uuid        NOT NULL REFERENCES public.usuario (id),
  es_recurrente  boolean     NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evento_rango_fechas_chk CHECK (fecha_fin >= fecha_inicio)
);

-- -----------------------------------------------------------------------------
-- log_accion (inmutable: sin UPDATE ni DELETE por RLS)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.log_accion (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tarea_id        uuid        REFERENCES public.tarea (id) ON DELETE SET NULL,
  usuario_id      uuid        NOT NULL REFERENCES public.usuario (id),
  tipo_accion     text        NOT NULL CHECK (tipo_accion IN (
    'creada', 'iniciada', 'reprogramada', 'eliminada',
    'estado_cambiado', 'prioridad_cambiada', 'editada',
    'cancelada', 'bloqueada', 'desbloqueada', 'completada'
  )),
  valor_anterior  jsonb,
  valor_nuevo     jsonb,
  justificacion   text,
  leido_por_jefe  boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- tipo_trabajo_ot
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tipo_trabajo_ot (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text        NOT NULL UNIQUE,
  activo     boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- orden_trabajo
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orden_trabajo (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  numero                text        UNIQUE,
  creado_por            uuid        NOT NULL REFERENCES public.usuario (id),
  tipo_trabajo_id       uuid        REFERENCES public.tipo_trabajo_ot (id),
  tarea_id              uuid        REFERENCES public.tarea (id) ON DELETE SET NULL,
  objetivo_id           uuid        REFERENCES public.objetivo (id) ON DELETE SET NULL,
  estado                text        NOT NULL DEFAULT 'borrador'
                                    CHECK (estado IN (
                                      'borrador', 'pendiente', 'aprobada',
                                      'completada', 'rechazada', 'cancelada'
                                    )),
  prioridad             text        NOT NULL DEFAULT 'normal'
                                    CHECK (prioridad IN ('normal', 'urgente')),
  descripcion           text        NOT NULL,
  area_destino          text        NOT NULL,
  ubicacion             text,
  modalidad             text        NOT NULL DEFAULT 'presencial'
                                    CHECK (modalidad IN ('presencial', 'remoto', 'viaje')),
  fecha_estimada        date        NOT NULL,
  hora_inicio_est       time,
  duracion_est_min      integer,
  equipos_materiales    text,
  observaciones         text,
  aprobado_por          uuid        REFERENCES public.usuario (id),
  fecha_aprobacion      timestamptz,
  motivo_rechazo        text,
  fecha_inicio_real     timestamptz,
  fecha_fin_real        timestamptz,
  observaciones_cierre  text,
  receptor_nombre       text,
  receptor_dni          text,
  receptor_cargo        text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_ot_completada_tiene_receptor CHECK (
    estado <> 'completada'
    OR (
      receptor_nombre IS NOT NULL AND btrim(receptor_nombre) <> ''
      AND receptor_dni    IS NOT NULL AND btrim(receptor_dni)    <> ''
    )
  ),
  CONSTRAINT ck_ot_pendiente_tiene_numero CHECK (
    estado IN ('borrador', 'cancelada')
    OR (numero IS NOT NULL AND btrim(numero) <> '')
  )
);

-- -----------------------------------------------------------------------------
-- log_ot (auditoría de OTs, inmutable)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.log_ot (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ot_id           uuid        NOT NULL REFERENCES public.orden_trabajo (id) ON DELETE CASCADE,
  usuario_id      uuid        NOT NULL REFERENCES public.usuario (id),
  accion          text        NOT NULL CHECK (accion IN (
    'creada', 'enviada', 'aprobada', 'rechazada',
    'iniciada', 'completada', 'cancelada', 'editada'
  )),
  estado_anterior text,
  estado_nuevo    text,
  motivo          text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Índices
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_objetivo_creado_por       ON public.objetivo (creado_por);
CREATE INDEX IF NOT EXISTS idx_objetivo_responsable_id   ON public.objetivo (responsable_id);
CREATE INDEX IF NOT EXISTS idx_tarea_asignado_a          ON public.tarea (asignado_a);
CREATE INDEX IF NOT EXISTS idx_tarea_objetivo_id         ON public.tarea (objetivo_id);
CREATE INDEX IF NOT EXISTS idx_tarea_semana_planificada  ON public.tarea (semana_planificada);
CREATE INDEX IF NOT EXISTS idx_tarea_estado              ON public.tarea (estado);
CREATE INDEX IF NOT EXISTS idx_tarea_es_imprevisto       ON public.tarea (es_imprevisto);
CREATE INDEX IF NOT EXISTS idx_tarea_nota_origen_id      ON public.tarea (nota_origen_id);
CREATE INDEX IF NOT EXISTS idx_evento_usuario_id         ON public.evento (usuario_id);
CREATE INDEX IF NOT EXISTS idx_evento_fecha_inicio       ON public.evento (fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_nota_bitacora_usuario_id  ON public.nota_bitacora (usuario_id);
CREATE INDEX IF NOT EXISTS idx_nota_bitacora_objetivo_id ON public.nota_bitacora (objetivo_id);
CREATE INDEX IF NOT EXISTS idx_log_accion_tarea_id       ON public.log_accion (tarea_id);
CREATE INDEX IF NOT EXISTS idx_log_accion_usuario_id     ON public.log_accion (usuario_id);
CREATE INDEX IF NOT EXISTS idx_orden_trabajo_creado_por  ON public.orden_trabajo (creado_por);
CREATE INDEX IF NOT EXISTS idx_orden_trabajo_estado      ON public.orden_trabajo (estado);
CREATE INDEX IF NOT EXISTS idx_orden_trabajo_prioridad   ON public.orden_trabajo (prioridad);
CREATE INDEX IF NOT EXISTS idx_orden_trabajo_objetivo_id ON public.orden_trabajo (objetivo_id);
CREATE INDEX IF NOT EXISTS idx_orden_trabajo_tarea_id   ON public.orden_trabajo (tarea_id) WHERE tarea_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_log_ot_ot_id              ON public.log_ot (ot_id);
CREATE INDEX IF NOT EXISTS idx_log_ot_usuario_id         ON public.log_ot (usuario_id);

-- -----------------------------------------------------------------------------
-- Vista tarea_activa — eje 2 (situacion) calculado (migr. 038–040)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.tarea_activa
  WITH (security_invoker = true) AS
  SELECT
    t.*,
    CASE
      WHEN t.estado IN ('completada','cancelada') THEN NULL
      WHEN t.tipo = 'planificada'
           AND t.fecha_planificada IS NOT NULL
           AND t.fecha_planificada < CURRENT_DATE
           AND t.estado IN ('pendiente','en_progreso')
        THEN 'atrasada'
      WHEN t.reprogramaciones > 0 THEN 'reprogramada'
      ELSE 'creada'
    END AS situacion
  FROM public.tarea t
  WHERE t.eliminada_en IS NULL;

GRANT SELECT ON public.tarea_activa TO authenticated;

-- -----------------------------------------------------------------------------
-- RLS — habilitar en todas las tablas
-- -----------------------------------------------------------------------------
ALTER TABLE public.usuario         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objetivo        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nota_bitacora   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarea           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evento          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_accion      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipo_trabajo_ot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orden_trabajo   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_ot          ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Funciones de rol (SECURITY DEFINER para evitar recursión)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_es_jefe()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuario u
    WHERE u.id = auth.uid() AND u.rol = 'jefe' AND COALESCE(u.activo, true)
  );
$$;

REVOKE ALL    ON FUNCTION public.sgtd_es_jefe() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_es_jefe() TO authenticated;

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

-- -----------------------------------------------------------------------------
-- Trigger: anti-escalada de rol en usuario (migración 031)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_proteger_rol_usuario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.sgtd_es_jefe() THEN
    RETURN NEW;
  END IF;
  IF NEW.rol IS DISTINCT FROM 'miembro' THEN
    RAISE EXCEPTION 'Solo un jefe puede asignar el rol %', NEW.rol
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sgtd_proteger_rol_usuario() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_proteger_rol_usuario() TO authenticated;

DROP TRIGGER IF EXISTS trg_sgtd_proteger_rol_usuario ON public.usuario;
CREATE TRIGGER trg_sgtd_proteger_rol_usuario
  BEFORE INSERT OR UPDATE OF rol ON public.usuario
  FOR EACH ROW
  EXECUTE FUNCTION public.sgtd_proteger_rol_usuario();

-- -----------------------------------------------------------------------------
-- Políticas RLS — Jefe (acceso total a todas las tablas)
-- -----------------------------------------------------------------------------
DO $$ DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'usuario','objetivo','nota_bitacora','tarea','evento',
    'log_accion','tipo_trabajo_ot','orden_trabajo','log_ot'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS sgtd_jefe_%s_all ON public.%s', t, t);
    EXECUTE format(
      'CREATE POLICY sgtd_jefe_%s_all ON public.%s FOR ALL TO authenticated
       USING (public.sgtd_es_jefe()) WITH CHECK (public.sgtd_es_jefe())',
      t, t
    );
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- Políticas RLS — Miembro (acceso restringido)
-- (ver detalle completo en migración 005 — se reproducen aquí para fresh install)
-- -----------------------------------------------------------------------------

-- usuario: ver todos los activos + propio, insertar/actualizar propio
CREATE POLICY sgtd_miembro_usuario_select_activos ON public.usuario
  FOR SELECT TO authenticated USING (public.sgtd_es_miembro_activo() AND activo = true);
CREATE POLICY sgtd_miembro_usuario_insert_propio ON public.usuario
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY sgtd_miembro_usuario_update_propio ON public.usuario
  FOR UPDATE TO authenticated
  USING (public.sgtd_es_miembro_activo() AND id = auth.uid())
  WITH CHECK (id = auth.uid());

-- objetivo: ver activos, crear propios, editar si responsable
CREATE POLICY sgtd_miembro_objetivo_select ON public.objetivo
  FOR SELECT TO authenticated USING (public.sgtd_es_miembro_activo() AND estado != 'cancelado');
CREATE POLICY sgtd_miembro_objetivo_insert ON public.objetivo
  FOR INSERT TO authenticated
  WITH CHECK (public.sgtd_es_miembro_activo() AND creado_por = auth.uid()
              AND (responsable_id = auth.uid() OR responsable_id IS NULL));
CREATE POLICY sgtd_miembro_objetivo_update ON public.objetivo
  FOR UPDATE TO authenticated
  USING (public.sgtd_es_miembro_activo()
         AND (responsable_id = auth.uid() OR creado_por = auth.uid()))
  WITH CHECK (responsable_id = auth.uid() OR responsable_id IS NULL);

-- nota_bitacora: leer propias + 'todos' del equipo; CRUD escritura solo propias
CREATE POLICY sgtd_miembro_nota_select ON public.nota_bitacora
  FOR SELECT TO authenticated
  USING (
    public.sgtd_es_miembro_activo()
    AND (usuario_id = auth.uid() OR visibilidad = 'todos')
  );
CREATE POLICY sgtd_miembro_nota_insert ON public.nota_bitacora
  FOR INSERT TO authenticated WITH CHECK (public.sgtd_es_miembro_activo() AND usuario_id = auth.uid());
CREATE POLICY sgtd_miembro_nota_update ON public.nota_bitacora
  FOR UPDATE TO authenticated
  USING (public.sgtd_es_miembro_activo() AND usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());
CREATE POLICY sgtd_miembro_nota_delete ON public.nota_bitacora
  FOR DELETE TO authenticated
  USING (public.sgtd_es_miembro_activo() AND usuario_id = auth.uid() AND convertida_en IS NULL);

-- tarea: CRUD propio (asignado_a = self)
CREATE POLICY sgtd_miembro_tarea_select ON public.tarea
  FOR SELECT TO authenticated USING (public.sgtd_es_miembro_activo() AND asignado_a = auth.uid());
CREATE POLICY sgtd_miembro_tarea_insert ON public.tarea
  FOR INSERT TO authenticated
  WITH CHECK (public.sgtd_es_miembro_activo() AND asignado_a = auth.uid() AND creado_por = auth.uid());
CREATE POLICY sgtd_miembro_tarea_update ON public.tarea
  FOR UPDATE TO authenticated
  USING (public.sgtd_es_miembro_activo() AND asignado_a = auth.uid())
  WITH CHECK (asignado_a = auth.uid());
CREATE POLICY sgtd_miembro_tarea_delete ON public.tarea
  FOR DELETE TO authenticated
  USING (public.sgtd_es_miembro_activo() AND creado_por = auth.uid()
         AND estado NOT IN ('completada', 'cancelada'));

-- evento: CRUD propio
CREATE POLICY sgtd_miembro_evento_select ON public.evento
  FOR SELECT TO authenticated USING (public.sgtd_es_miembro_activo() AND usuario_id = auth.uid());
CREATE POLICY sgtd_miembro_evento_insert ON public.evento
  FOR INSERT TO authenticated WITH CHECK (public.sgtd_es_miembro_activo() AND usuario_id = auth.uid());
CREATE POLICY sgtd_miembro_evento_update ON public.evento
  FOR UPDATE TO authenticated
  USING (public.sgtd_es_miembro_activo() AND usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());
CREATE POLICY sgtd_miembro_evento_delete ON public.evento
  FOR DELETE TO authenticated USING (public.sgtd_es_miembro_activo() AND usuario_id = auth.uid());

-- log_accion: select e insert propios, inmutable
CREATE POLICY sgtd_miembro_log_select ON public.log_accion
  FOR SELECT TO authenticated USING (public.sgtd_es_miembro_activo() AND usuario_id = auth.uid());
CREATE POLICY sgtd_miembro_log_insert ON public.log_accion
  FOR INSERT TO authenticated
  WITH CHECK (public.sgtd_es_miembro_activo() AND usuario_id = auth.uid() AND leido_por_jefe = false);

-- tipo_trabajo_ot: solo lectura para miembros
CREATE POLICY sgtd_miembro_tipo_trabajo_select ON public.tipo_trabajo_ot
  FOR SELECT TO authenticated USING (public.sgtd_es_miembro_activo() AND activo = true);

-- orden_trabajo: CRUD propias
CREATE POLICY sgtd_miembro_ot_select ON public.orden_trabajo
  FOR SELECT TO authenticated USING (public.sgtd_es_miembro_activo() AND creado_por = auth.uid());
CREATE POLICY sgtd_miembro_ot_insert ON public.orden_trabajo
  FOR INSERT TO authenticated WITH CHECK (public.sgtd_es_miembro_activo() AND creado_por = auth.uid());
CREATE POLICY sgtd_miembro_ot_update ON public.orden_trabajo
  FOR UPDATE TO authenticated
  USING (public.sgtd_es_miembro_activo() AND creado_por = auth.uid()
         AND estado IN ('borrador'))
  WITH CHECK (creado_por = auth.uid());

-- log_ot: select propias, insert propio, inmutable
CREATE POLICY sgtd_miembro_log_ot_select ON public.log_ot
  FOR SELECT TO authenticated
  USING (public.sgtd_es_miembro_activo()
         AND ot_id IN (SELECT id FROM public.orden_trabajo WHERE creado_por = auth.uid()));
CREATE POLICY sgtd_miembro_log_ot_insert ON public.log_ot
  FOR INSERT TO authenticated
  WITH CHECK (public.sgtd_es_miembro_activo() AND usuario_id = auth.uid());

COMMIT;