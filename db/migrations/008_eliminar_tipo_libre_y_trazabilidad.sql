-- =============================================================================
-- SGTD — Migración 008
-- Archivo: 008_eliminar_tipo_libre_y_trazabilidad.sql
--
-- Cambios:
--   1. Elimina tipo='libre' de la tabla tarea:
--      - Convierte tareas libres existentes a notas de bitácora
--      - Elimina esas tareas
--      - Actualiza el CHECK constraint
--
--   2. Agrega nota_origen_id a tarea:
--      - Trazabilidad cuando una tarea nace desde una nota de bitácora
--
--   3. Agrega 'iniciada' a tipo_accion en log_accion:
--      - Registra explícitamente cuando una tarea pasa a en_progreso
--
--   4. Actualiza sgtd_convertir_nota_en_tarea para poblar nota_origen_id
--
-- Prerrequisitos: migraciones 001–007 aplicadas.
--
-- Cómo aplicar:
--   Dashboard InsForge → SQL Editor → pegar y ejecutar
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. ELIMINAR TIPO 'LIBRE'
-- -----------------------------------------------------------------------------

-- 1a. Convertir tareas libres existentes a notas de bitácora
--     Se preserva el contenido (titulo + descripcion) y el autor
INSERT INTO public.nota_bitacora (contenido, usuario_id, objetivo_id, visibilidad, created_at)
SELECT
  CASE
    WHEN descripcion IS NOT NULL AND trim(descripcion) <> ''
      THEN titulo || E'\n' || descripcion
    ELSE titulo
  END,
  asignado_a,
  objetivo_id,
  'privado',
  created_at
FROM public.tarea
WHERE tipo = 'libre';

-- 1b. Eliminar las tareas libres (ya están preservadas como notas)
DELETE FROM public.tarea WHERE tipo = 'libre';

-- 1c. Actualizar CHECK constraint en tarea.tipo
ALTER TABLE public.tarea
  DROP CONSTRAINT IF EXISTS tarea_tipo_check;

ALTER TABLE public.tarea
  ADD CONSTRAINT tarea_tipo_check
  CHECK (tipo IN ('planificada', 'no_planificada'));

-- -----------------------------------------------------------------------------
-- 2. AGREGAR nota_origen_id A TAREA
--    Referencia opcional a la nota de bitácora que originó esta tarea.
--    ON DELETE SET NULL: si la nota se borra, la tarea no pierde información.
-- -----------------------------------------------------------------------------

ALTER TABLE public.tarea
  ADD COLUMN IF NOT EXISTS nota_origen_id uuid
  REFERENCES public.nota_bitacora (id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tarea_nota_origen_id
  ON public.tarea (nota_origen_id);

-- -----------------------------------------------------------------------------
-- 3. AGREGAR 'iniciada' A log_accion.tipo_accion
--    Registra el momento exacto en que una tarea pasa a en_progreso.
-- -----------------------------------------------------------------------------

ALTER TABLE public.log_accion
  DROP CONSTRAINT IF EXISTS log_accion_tipo_accion_check;

ALTER TABLE public.log_accion
  ADD CONSTRAINT log_accion_tipo_accion_check
  CHECK (tipo_accion IN (
    'creada',
    'iniciada',
    'reprogramada',
    'eliminada',
    'estado_cambiado',
    'prioridad_cambiada',
    'editada',
    'cancelada',
    'bloqueada',
    'desbloqueada',
    'completada'
  ));

-- -----------------------------------------------------------------------------
-- 4. ACTUALIZAR sgtd_convertir_nota_en_tarea
--    Ahora también puebla nota_origen_id en la tarea creada.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sgtd_convertir_nota_en_tarea(
  p_nota_id           UUID,
  p_titulo            TEXT,
  p_descripcion       TEXT,
  p_prioridad         TEXT,
  p_fecha_planificada TEXT,
  p_semana            TEXT,
  p_asignado_a        UUID,
  p_creado_por        UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_convertida TEXT;
  v_tarea_id   UUID;
BEGIN
  SELECT convertida_en INTO v_convertida
  FROM public.nota_bitacora
  WHERE id = p_nota_id
    AND usuario_id = p_creado_por;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nota no encontrada o sin permiso (id: %)', p_nota_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_convertida IS NOT NULL THEN
    RAISE EXCEPTION 'La nota ya fue convertida en "%"', v_convertida
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.tarea (
    titulo, descripcion, estado, tipo, prioridad,
    fecha_planificada, semana_planificada,
    asignado_a, creado_por, es_imprevisto,
    nota_origen_id
  ) VALUES (
    trim(p_titulo),
    nullif(trim(p_descripcion), ''),
    'pendiente',
    'planificada',
    p_prioridad,
    p_fecha_planificada,
    p_semana,
    p_asignado_a,
    p_creado_por,
    false,
    p_nota_id
  )
  RETURNING id INTO v_tarea_id;

  UPDATE public.nota_bitacora
  SET convertida_en = 'tarea',
      updated_at    = now()
  WHERE id = p_nota_id;

  RETURN v_tarea_id;
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_convertir_nota_en_tarea(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,UUID,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_convertir_nota_en_tarea(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,UUID,UUID) TO authenticated;

-- =============================================================================
-- VERIFICACIÓN
-- Ejecutar después de aplicar para confirmar que todo quedó bien:
--
-- SELECT COUNT(*) FROM public.tarea WHERE tipo = 'libre';
-- → Debe retornar 0
--
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'tarea' AND column_name = 'nota_origen_id';
-- → Debe retornar 1 fila
--
-- SELECT conname, consrc FROM pg_constraint
-- WHERE conrelid = 'public.tarea'::regclass AND contype = 'c';
-- → tarea_tipo_check debe mostrar solo 'planificada' y 'no_planificada'
--
-- SELECT conname FROM pg_constraint
-- WHERE conrelid = 'public.log_accion'::regclass AND contype = 'c';
-- → Debe incluir 'iniciada', 'bloqueada', 'desbloqueada', 'completada'
-- =============================================================================

COMMIT;