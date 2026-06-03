-- =============================================================================
-- SGTD — Migración 025
-- Archivo: 025_recurrencia_evento.sql
--
-- Implementa eventos recurrentes:
--   - Tabla recurrencia_evento: regla de repetición (días de semana, hora, rango)
--   - Columna evento.recurrencia_id: FK a la regla que generó el evento
--   - RPC sgtd_crear_recurrencia_evento: crea la regla y genera 3 meses de instancias
--   - RPC sgtd_generar_eventos_recurrentes: extiende instancias al período siguiente
--
-- Comportamiento por rol:
--   - Jefe: genera una instancia por cada miembro activo + él mismo
--   - Miembro: genera instancias solo para sí mismo
--
-- Cómo aplicar: Dashboard InsForge → SQL Editor → pegar y ejecutar.
-- =============================================================================

BEGIN;

-- =============================================================================
-- PARTE 1: Tabla recurrencia_evento
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.recurrencia_evento (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo          text        NOT NULL,
  tipo            text        NOT NULL
                              CHECK (tipo IN ('reunion', 'entrega', 'personal', 'otro')),
  hora_inicio     time        NOT NULL,
  hora_fin        time        NOT NULL,
  usuario_id      uuid        NOT NULL REFERENCES public.usuario (id),
  -- Array de días ISO: 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb, 7=Dom
  dias_semana     integer[]   NOT NULL,
  fecha_inicio    date        NOT NULL,
  fecha_fin       date,
  generado_hasta  date,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recurrencia_rango_chk     CHECK (fecha_fin IS NULL OR fecha_fin > fecha_inicio),
  CONSTRAINT recurrencia_horas_chk     CHECK (hora_fin > hora_inicio),
  CONSTRAINT recurrencia_dias_chk      CHECK (array_length(dias_semana, 1) > 0)
);

CREATE INDEX IF NOT EXISTS idx_recurrencia_evento_usuario_id
  ON public.recurrencia_evento (usuario_id);

-- =============================================================================
-- PARTE 2: Columna recurrencia_id en evento
-- =============================================================================

ALTER TABLE public.evento
  ADD COLUMN IF NOT EXISTS recurrencia_id uuid
  REFERENCES public.recurrencia_evento (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_evento_recurrencia_id
  ON public.evento (recurrencia_id);

-- =============================================================================
-- PARTE 3: RLS para recurrencia_evento
-- =============================================================================

ALTER TABLE public.recurrencia_evento ENABLE ROW LEVEL SECURITY;

-- Jefe: acceso total
DROP POLICY IF EXISTS sgtd_jefe_recurrencia_all ON public.recurrencia_evento;
CREATE POLICY sgtd_jefe_recurrencia_all ON public.recurrencia_evento
  FOR ALL TO authenticated
  USING (public.sgtd_es_jefe())
  WITH CHECK (public.sgtd_es_jefe());

-- Miembro: CRUD solo las propias
DROP POLICY IF EXISTS sgtd_miembro_recurrencia_select ON public.recurrencia_evento;
CREATE POLICY sgtd_miembro_recurrencia_select ON public.recurrencia_evento
  FOR SELECT TO authenticated
  USING (public.sgtd_es_miembro_activo() AND usuario_id = auth.uid());

DROP POLICY IF EXISTS sgtd_miembro_recurrencia_insert ON public.recurrencia_evento;
CREATE POLICY sgtd_miembro_recurrencia_insert ON public.recurrencia_evento
  FOR INSERT TO authenticated
  WITH CHECK (public.sgtd_es_miembro_activo() AND usuario_id = auth.uid());

DROP POLICY IF EXISTS sgtd_miembro_recurrencia_update ON public.recurrencia_evento;
CREATE POLICY sgtd_miembro_recurrencia_update ON public.recurrencia_evento
  FOR UPDATE TO authenticated
  USING (public.sgtd_es_miembro_activo() AND usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

DROP POLICY IF EXISTS sgtd_miembro_recurrencia_delete ON public.recurrencia_evento;
CREATE POLICY sgtd_miembro_recurrencia_delete ON public.recurrencia_evento
  FOR DELETE TO authenticated
  USING (public.sgtd_es_miembro_activo() AND usuario_id = auth.uid());

-- =============================================================================
-- PARTE 4: RPC sgtd_generar_eventos_recurrentes
-- Genera instancias de eventos para un período dado.
-- Llamada internamente por sgtd_crear_recurrencia_evento y por el frontend
-- para extender al siguiente período.
-- Devuelve el número de eventos creados.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sgtd_generar_eventos_recurrentes(
  p_recurrencia_id uuid,
  p_meses_adelante integer DEFAULT 1
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec         recurrencia_evento%ROWTYPE;
  v_desde       date;
  v_hasta       date;
  v_fecha       date;
  v_creador_rol text;
  v_usuarios    uuid[];
  v_uid         uuid;
  v_inicio      timestamptz;
  v_fin         timestamptz;
  v_count       integer := 0;
BEGIN
  -- Cargar la regla
  SELECT * INTO v_rec
  FROM public.recurrencia_evento
  WHERE id = p_recurrencia_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recurrencia no encontrada: %', p_recurrencia_id;
  END IF;

  -- Determinar desde dónde generar
  v_desde := COALESCE(v_rec.generado_hasta + 1, v_rec.fecha_inicio);
  v_hasta := LEAST(
    v_desde + (p_meses_adelante * interval '1 month')::interval,
    COALESCE(v_rec.fecha_fin, v_desde + (p_meses_adelante * interval '1 month')::interval)
  )::date;

  -- Si ya está generado hasta esa fecha, salir
  IF v_desde > v_hasta THEN
    RETURN 0;
  END IF;

  -- Determinar para quién generar
  SELECT rol INTO v_creador_rol
  FROM public.usuario
  WHERE id = v_rec.usuario_id;

  IF v_creador_rol = 'jefe' THEN
    -- Jefe: genera para todos los miembros activos + él mismo
    SELECT array_agg(id) INTO v_usuarios
    FROM public.usuario
    WHERE activo = true;
  ELSE
    -- Miembro: solo para sí mismo
    v_usuarios := ARRAY[v_rec.usuario_id];
  END IF;

  IF v_usuarios IS NULL THEN
    RETURN 0;
  END IF;

  -- Iterar cada día del período
  v_fecha := v_desde;
  WHILE v_fecha <= v_hasta LOOP
    -- ¿Este día de la semana está en la regla? (ISODOW: 1=Lun…7=Dom)
    IF EXTRACT(ISODOW FROM v_fecha)::integer = ANY(v_rec.dias_semana) THEN
      -- Crear una instancia por cada usuario destino
      FOREACH v_uid IN ARRAY v_usuarios LOOP
        v_inicio := (v_fecha::text || ' ' || v_rec.hora_inicio::text)::timestamptz;
        v_fin    := (v_fecha::text || ' ' || v_rec.hora_fin::text)::timestamptz;

        -- Evitar duplicados (misma recurrencia, mismo usuario, mismo inicio)
        IF NOT EXISTS (
          SELECT 1 FROM public.evento
          WHERE recurrencia_id = p_recurrencia_id
            AND usuario_id     = v_uid
            AND fecha_inicio   = v_inicio
        ) THEN
          INSERT INTO public.evento (
            titulo, tipo, fecha_inicio, fecha_fin,
            usuario_id, es_recurrente, recurrencia_id
          ) VALUES (
            v_rec.titulo, v_rec.tipo, v_inicio, v_fin,
            v_uid, true, p_recurrencia_id
          );
          v_count := v_count + 1;
        END IF;
      END LOOP;
    END IF;
    v_fecha := v_fecha + 1;
  END LOOP;

  -- Actualizar hasta dónde se generó
  UPDATE public.recurrencia_evento
  SET generado_hasta = v_hasta
  WHERE id = p_recurrencia_id;

  RETURN v_count;
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_generar_eventos_recurrentes(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_generar_eventos_recurrentes(uuid, integer) TO authenticated;

-- =============================================================================
-- PARTE 5: RPC sgtd_crear_recurrencia_evento
-- Crea la regla y genera 3 meses de instancias en un solo paso.
-- Devuelve el UUID de la recurrencia creada.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sgtd_crear_recurrencia_evento(
  p_titulo       text,
  p_tipo         text,
  p_hora_inicio  text,   -- 'HH:MM'
  p_hora_fin     text,   -- 'HH:MM'
  p_usuario_id   uuid,
  p_dias_semana  integer[],
  p_fecha_inicio text,   -- 'YYYY-MM-DD'
  p_fecha_fin    text    DEFAULT NULL,
  p_meses        integer DEFAULT 3
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Validaciones básicas
  IF p_titulo IS NULL OR length(trim(p_titulo)) = 0 THEN
    RAISE EXCEPTION 'El título de la recurrencia es obligatorio.';
  END IF;

  IF p_dias_semana IS NULL OR array_length(p_dias_semana, 1) = 0 THEN
    RAISE EXCEPTION 'Debes seleccionar al menos un día de la semana.';
  END IF;

  IF p_hora_fin <= p_hora_inicio THEN
    RAISE EXCEPTION 'La hora de fin debe ser posterior a la hora de inicio.';
  END IF;

  -- Insertar la regla
  INSERT INTO public.recurrencia_evento (
    titulo, tipo, hora_inicio, hora_fin,
    usuario_id, dias_semana, fecha_inicio, fecha_fin
  ) VALUES (
    trim(p_titulo),
    p_tipo,
    p_hora_inicio::time,
    p_hora_fin::time,
    p_usuario_id,
    p_dias_semana,
    p_fecha_inicio::date,
    p_fecha_fin::date
  )
  RETURNING id INTO v_id;

  -- Generar instancias para los próximos p_meses meses
  PERFORM public.sgtd_generar_eventos_recurrentes(v_id, p_meses);

  RETURN v_id;
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_crear_recurrencia_evento(text,text,text,text,uuid,integer[],text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_crear_recurrencia_evento(text,text,text,text,uuid,integer[],text,text,integer) TO authenticated;

COMMIT;