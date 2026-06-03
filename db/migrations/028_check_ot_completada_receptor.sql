-- =============================================================================
-- SGTD — Migración 028
-- A-03: OT en estado completada debe tener receptor_nombre y receptor_dni.
--
-- Capas:
--   1. CHECK ck_ot_completada_tiene_receptor (schema)
--   2. sgtd_completar_ot — valida nombre y DNI antes del UPDATE
--
-- receptor_cargo permanece opcional.
--
-- PRE-REQUISITO: ejecutar la query de pre-flight (sección VERIFICACIÓN).
-- Si devuelve filas, corregir datos antes de COMMIT o el ADD CONSTRAINT fallará.
--
-- Tras aplicar en InsForge, activar en web/.env:
--   VITE_OT_MIGRATION_028=true
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Pre-flight (solo lectura — ejecutar aparte si aplica)
-- -----------------------------------------------------------------------------
-- SELECT id, numero, estado, receptor_nombre, receptor_dni
-- FROM public.orden_trabajo
-- WHERE estado = 'completada'
--   AND (
--     receptor_nombre IS NULL OR btrim(receptor_nombre) = ''
--     OR receptor_dni    IS NULL OR btrim(receptor_dni)    = ''
--   );

-- -----------------------------------------------------------------------------
-- 1. CHECK: completada ⇒ nombre + DNI no vacíos
-- -----------------------------------------------------------------------------
ALTER TABLE public.orden_trabajo
  DROP CONSTRAINT IF EXISTS ck_ot_completada_tiene_receptor;

ALTER TABLE public.orden_trabajo
  ADD CONSTRAINT ck_ot_completada_tiene_receptor
  CHECK (
    estado <> 'completada'
    OR (
      receptor_nombre IS NOT NULL AND btrim(receptor_nombre) <> ''
      AND receptor_dni    IS NOT NULL AND btrim(receptor_dni)    <> ''
    )
  );

-- -----------------------------------------------------------------------------
-- 2. RPC: alinear validación con el CHECK (DNI obligatorio al cerrar)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_completar_ot(
  p_ot_id                UUID,
  p_usuario_id           UUID,
  p_receptor_nombre      TEXT,
  p_receptor_dni         TEXT,
  p_receptor_cargo       TEXT,
  p_observaciones_cierre TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_estado      TEXT;
  v_solicitante UUID;
BEGIN
  SELECT estado, creado_por INTO v_estado, v_solicitante
  FROM public.orden_trabajo WHERE id = p_ot_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OT no encontrada (id: %)', p_ot_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_estado <> 'en_ejecucion' THEN
    RAISE EXCEPTION 'Solo se puede completar una OT en ejecución (estado actual: "%")', v_estado
      USING ERRCODE = 'P0002';
  END IF;

  IF v_solicitante <> p_usuario_id AND NOT public.sgtd_es_jefe() THEN
    RAISE EXCEPTION 'Sin permiso para completar esta OT'
      USING ERRCODE = 'P0003';
  END IF;

  IF btrim(coalesce(p_receptor_nombre, '')) = '' THEN
    RAISE EXCEPTION 'El nombre del receptor es obligatorio'
      USING ERRCODE = 'P0004';
  END IF;

  IF btrim(coalesce(p_receptor_dni, '')) = '' THEN
    RAISE EXCEPTION 'El DNI del receptor es obligatorio'
      USING ERRCODE = 'P0005';
  END IF;

  UPDATE public.orden_trabajo
  SET estado                = 'completada',
      fecha_fin_real        = now(),
      receptor_nombre       = btrim(p_receptor_nombre),
      receptor_dni          = btrim(p_receptor_dni),
      receptor_cargo        = nullif(btrim(coalesce(p_receptor_cargo, '')), ''),
      observaciones_cierre  = nullif(btrim(coalesce(p_observaciones_cierre, '')), ''),
      updated_at            = now()
  WHERE id = p_ot_id;

  INSERT INTO public.log_ot (ot_id, usuario_id, accion, estado_anterior, estado_nuevo)
  VALUES (p_ot_id, p_usuario_id, 'completada', 'en_ejecucion', 'completada');
END;
$$;

REVOKE ALL    ON FUNCTION public.sgtd_completar_ot(UUID, UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_completar_ot(UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMIT;

-- =============================================================================
-- VERIFICACIÓN (ejecutar tras COMMIT)
-- =============================================================================
--
-- 1) Constraint presente:
-- SELECT conname
-- FROM pg_constraint
-- WHERE conrelid = 'public.orden_trabajo'::regclass
--   AND conname = 'ck_ot_completada_tiene_receptor';
-- → 1 fila
--
-- 2) RPC valida DNI (cuerpo incluye P0005 / obligatorio):
-- SELECT pg_get_functiondef(p.oid) LIKE '%P0005%'
-- FROM pg_proc p
-- JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public' AND proname = 'sgtd_completar_ot';
-- → true
--
-- 3) CLI one-liner:
-- npx @insforge/cli db query "SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.orden_trabajo'::regclass AND conname = 'ck_ot_completada_tiene_receptor') AS migration_028_ok"
-- → migration_028_ok = true
--
-- 4) QA app: completar OT con nombre + DNI → OK; sin DNI → error RPC;
--    activar VITE_OT_MIGRATION_028=true y reiniciar dev server.
-- =============================================================================
