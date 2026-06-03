-- =============================================================================
-- SGTD — Migración 037
-- Archivo: 037_fix_ck_ot_numero_cancelada.sql
--
-- Fix: cancelar un borrador sin número (numero NULL) fallaba el CHECK
-- ck_ot_pendiente_tiene_numero al pasar a estado cancelada.
--
-- Prerrequisito: 036
-- =============================================================================

BEGIN;

ALTER TABLE public.orden_trabajo
  DROP CONSTRAINT IF EXISTS ck_ot_pendiente_tiene_numero;

ALTER TABLE public.orden_trabajo
  ADD CONSTRAINT ck_ot_pendiente_tiene_numero
  CHECK (
    estado IN ('borrador', 'cancelada')
    OR (numero IS NOT NULL AND btrim(numero) <> '')
  );

COMMIT;

-- VERIFICACIÓN:
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint
-- WHERE conrelid = 'public.orden_trabajo'::regclass
--   AND conname = 'ck_ot_pendiente_tiene_numero';
-- → debe incluir 'cancelada'
