-- =============================================================================
-- Migración 052 — NO APLICAR (no-op) — hipótesis descartada
-- =============================================================================
-- Contexto : Se redactó suponiendo que orgs con workspace inactivo (activo=false)
--             explicaban el HTTP 400 del panel de módulos tras 051.
--
-- Auditoría PRE-APPLY en dev (2026-06-12) mostró lo contrario: todas las orgs
-- activas ya tenían workspace con ws_activo = true, p. ej.:
--   AGUEMAR, Mi Organización, Prueba — cada una con ws_nombre Principal.
--
-- Causa real del 400 : ERRCODE 42702 — ambigüedad de "activo" en
--             sgtd_listar_modulos_organizacion (050). Fix en 053.
--
-- Acción     : NO ejecutar UPDATE de reactivación. Este archivo se conserva por
--             numeración. Si se ejecuta, solo valida y emite NOTICE (sin mutar).
--
-- Prerrequisito : Ninguno. Opcional ejecutar tras 051 para dejar constancia.
-- Idempotente  : Sí (sin cambios de datos).
--
-- PRE-APPLY (misma query que motivó descartar esta migración):
--   SELECT o.id, o.nombre, w.id AS ws_id, w.nombre AS ws_nombre, w.activo AS ws_activo
--   FROM   public.organizacion o
--   LEFT   JOIN public.workspace w ON w.organizacion_id = o.id
--   WHERE  o.activa = true
--   ORDER  BY o.nombre;
--   Si todas muestran ws_activo = true → no aplicar fix de reactivación; ir a 053.
--
-- Identificador de validación (debe ser 0 antes y después):
--   SELECT COUNT(*) FROM organizacion o
--   WHERE o.activa = true
--     AND NOT EXISTS (
--       SELECT 1 FROM workspace w
--       WHERE w.organizacion_id = o.id AND w.activo = true
--     );
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_sin_ws_activo integer;
BEGIN
  SELECT COUNT(*) INTO v_sin_ws_activo
  FROM public.organizacion o
  WHERE o.activa = true
    AND NOT EXISTS (
      SELECT 1 FROM public.workspace w
      WHERE w.organizacion_id = o.id AND w.activo = true
    );

  IF v_sin_ws_activo > 0 THEN
    RAISE WARNING
      '052_reactivar_workspaces: % org(s) activa(s) sin workspace activo. '
      'Este entorno SÍ necesitaría reactivación manual o un script aparte; '
      'el UPDATE original fue retirado de este archivo.',
      v_sin_ws_activo;
  ELSE
    RAISE NOTICE
      '052_reactivar_workspaces: no-op — todas las orgs activas tienen workspace activo. '
      'Sin cambios. El fix del panel de módulos es 053 (ambigüedad activo en listar).';
  END IF;
END;
$$;

COMMIT;


-- =============================================================================
-- SMOKE TEST — ejecutar tras apply (solo constancia; no muta datos)
-- =============================================================================

-- T1: ninguna org activa sin workspace activo (esperado: 0)
--   SELECT COUNT(*) FROM organizacion o
--   WHERE o.activa = true
--     AND NOT EXISTS (
--       SELECT 1 FROM workspace w
--       WHERE w.organizacion_id = o.id AND w.activo = true
--     );

-- T2: el panel de módulos se corrige con 053, no con 052
--   SELECT * FROM sgtd_listar_modulos_organizacion('<org-id>');
--   esperado: 6 filas, sin ERRCODE 42702 (aplicar 053 primero)


-- =============================================================================
-- NOTA HISTÓRICA — UPDATE retirado (no usar)
-- =============================================================================
-- El siguiente UPDATE se descartó tras auditoría dev; conservado solo como referencia
-- si algún entorno futuro tuviera workspaces inactivos sin alternativa activa:
--
-- UPDATE public.workspace w
-- SET    activo = true
-- WHERE  w.activo = false
--   AND  EXISTS (
--          SELECT 1 FROM public.organizacion o
--          WHERE  o.id = w.organizacion_id AND o.activa = true
--        )
--   AND  NOT EXISTS (
--          SELECT 1 FROM public.workspace w2
--          WHERE  w2.organizacion_id = w.organizacion_id AND w2.activo = true
--        );
