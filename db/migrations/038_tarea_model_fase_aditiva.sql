-- =============================================================================
-- SGTD — Migración 038  ·  Modelo de tarea v1.1 — FASE ADITIVA (lectura dual)
--
-- Segura y reversible en la práctica: NO quita valores de enum, NO borra
-- funciones, NO cambia estados. Los triggers viejos (009/015/027/029/034)
-- siguen funcionando igual. Solo AGREGA lo que el nuevo modelo necesita para
-- que el frontend empiece a leer la "situación" calculada.
--
-- Prerrequisitos: 029, 034 aplicadas. Siguientes: 039 (RPCs/cron), 040 (enum/remapeo).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Prioridad: agregar 'critica'  (NO se usa en esta migración → seguro en tx)
--    Orden monótono: critica > alta > media > baja
-- -----------------------------------------------------------------------------
ALTER TYPE public.prioridad_tarea ADD VALUE IF NOT EXISTS 'critica' BEFORE 'alta';
-- NOTA: 'critica' queda disponible en BD, pero el frontend (TareaSchema) aún solo
-- acepta alta|media|baja. No usar 'critica' en la UI hasta el paso 5 del plan.

-- -----------------------------------------------------------------------------
-- 2. Contador de reprogramaciones (eje 2) + backfill desde el log existente
-- -----------------------------------------------------------------------------
ALTER TABLE public.tarea
  ADD COLUMN IF NOT EXISTS reprogramaciones integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.tarea.reprogramaciones IS
  'Veces que se reprogramó (DnD o reprogramar). Base de situacion=reprogramada.';

UPDATE public.tarea t
SET reprogramaciones = sub.c
FROM (
  SELECT tarea_id, count(*) AS c
  FROM public.log_accion
  WHERE tipo_accion = 'reprogramada' AND tarea_id IS NOT NULL
  GROUP BY tarea_id
) sub
WHERE t.id = sub.tarea_id
  AND t.reprogramaciones = 0;   -- idempotente

-- -----------------------------------------------------------------------------
-- 3. Dedup de notificación de atraso (reemplaza a sla_bloqueada_notificada_at).
--    La columna vieja se deprecará en 040; aquí solo se agrega la nueva.
-- -----------------------------------------------------------------------------
ALTER TABLE public.tarea
  ADD COLUMN IF NOT EXISTS sla_atrasada_notificada_at timestamptz;

COMMENT ON COLUMN public.tarea.sla_atrasada_notificada_at IS
  'Marca de envío del evento realtime tarea_atrasada; se limpia al dejar de estar atrasada.';

-- -----------------------------------------------------------------------------
-- 4. Vista operativa con eje 2 (situacion) calculado.
--    Conserva security_invoker=true (RLS del caller). Cast a text para que
--    siga válida después de reducir el enum en la 040.
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.tarea_activa;

CREATE VIEW public.tarea_activa
  WITH (security_invoker = true) AS
  SELECT
    t.*,
    CASE
      WHEN t.estado::text IN ('completada','cancelada') THEN NULL
      WHEN t.tipo::text = 'planificada'
           AND t.fecha_planificada IS NOT NULL
           AND t.fecha_planificada < CURRENT_DATE
           AND t.estado::text IN ('pendiente','en_progreso','reprogramada','atrasada')
        THEN 'atrasada'
      WHEN t.reprogramaciones > 0
           OR t.estado::text = 'reprogramada'   -- legacy dual-read hasta la 040
        THEN 'reprogramada'
      ELSE 'creada'
    END AS situacion
  FROM public.tarea t
  WHERE t.eliminada_en IS NULL;

GRANT SELECT ON public.tarea_activa TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. Fix de la 032 (idempotente): EXECUTE de la notificación al rol authenticated
--    (ya aplicado en vivo; se incluye para que el repo quede consistente)
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.sgtd_notificar_tarea_asignada(uuid, uuid, text, uuid)
  TO authenticated;

-- -----------------------------------------------------------------------------
-- 6. (OPCIONAL) Sembrar el dedup de atraso desde la columna vieja, para no
--    re-notificar en masa cuando el cron de la 039 entre en acción.
--    OJO: la semántica difiere (bloqueada ≠ atrasada); copiar la marca puede
--    SUPRIMIR notificaciones legítimas de atraso. Descoméntalo solo si lo asumes.
-- -----------------------------------------------------------------------------
-- UPDATE public.tarea
-- SET sla_atrasada_notificada_at = sla_bloqueada_notificada_at
-- WHERE sla_atrasada_notificada_at IS NULL
--   AND sla_bloqueada_notificada_at IS NOT NULL;

COMMIT;

-- -----------------------------------------------------------------------------
-- Verificación (correr aparte tras el COMMIT):
--
--   -- GRANT de la 032 aplicado
--   SELECT has_function_privilege('authenticated',
--     'public.sgtd_notificar_tarea_asignada(uuid,uuid,text,uuid)', 'EXECUTE') AS grant_032;
--
--   -- 'critica' presente en el enum
--   SELECT EXISTS (
--     SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
--     WHERE t.typname = 'prioridad_tarea' AND e.enumlabel = 'critica'
--   ) AS tiene_critica;
--
--   -- Distribución de la situación calculada
--   SELECT situacion, count(*) FROM public.tarea_activa GROUP BY 1 ORDER BY 1;
-- -----------------------------------------------------------------------------
