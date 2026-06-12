-- =============================================================================
-- Migración 054 — Soft-delete de organización con purga automática a 3 meses
-- =============================================================================
-- Flujo:
--   1. Dueño clica "Mover a papelera" → sgtd_desactivar_organizacion()
--      → activa = false, desactivada_en = now()
--   2. Panel muestra "Papelera" con cuenta regresiva (purga_en = desactivada_en + interval '3 months')
--   3. Dueño puede reactivar antes de purga_en → sgtd_reactivar_organizacion()
--      → activa = true, desactivada_en = NULL
--   4. pg_cron ejecuta sgtd_purgar_organizaciones_inactivas() cada día a las 03:00 UTC
--      → hard-delete de orgs donde desactivada_en < now() - interval '3 months'
--      → borra dominio en orden FK-seguro antes de borrar la org
--      Nota: "3 meses" = interval '3 months' (~89–92 días según el mes).
--      Si el contrato requiere exactamente 90 días usar interval '90 days'.
--
-- Funciones:
--   sgtd_desactivar_organizacion(uuid)     → jsonb  (gate: dueño)
--   sgtd_reactivar_organizacion(uuid)      → jsonb  (gate: dueño)
--   sgtd_listar_orgs_desactivadas()        → TABLE  (gate: dueño)
--   sgtd_purgar_organizaciones_inactivas() → integer (sin gate; solo cron/service role)
--
-- Prerequisito : 043–053 aplicadas.
-- Idempotente  : Sí (CREATE OR REPLACE + ADD COLUMN IF NOT EXISTS).
-- Reversible   : Ver ROLLBACK al final.
--
-- Identificador de validación:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='organizacion' AND column_name='desactivada_en';
--   esperado: 1 fila
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Columna desactivada_en
-- ---------------------------------------------------------------------------
ALTER TABLE public.organizacion
  ADD COLUMN IF NOT EXISTS desactivada_en timestamptz NULL;

COMMENT ON COLUMN public.organizacion.desactivada_en IS
  'Timestamp del soft-delete. NULL = org activa. La purga automática elimina la org '
  'cuando desactivada_en < now() - interval ''3 months'' (sgtd_purgar_organizaciones_inactivas). '
  'Orgs con activa=false y desactivada_en NULL son pre-054 (suspendidas manualmente; no se purgan).';

-- ---------------------------------------------------------------------------
-- 2. sgtd_desactivar_organizacion — soft-delete (solo dueño)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_desactivar_organizacion(
  p_organizacion_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_nombre text;
  v_ahora  timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.sgtd_es_plataforma_owner() THEN
    RAISE EXCEPTION 'No tienes permiso para eliminar organizaciones.' USING ERRCODE = 'P0007';
  END IF;

  SELECT o.nombre INTO v_nombre
  FROM public.organizacion o
  WHERE o.id = p_organizacion_id AND o.activa = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La organización no existe o ya está en la papelera.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.organizacion
  SET activa = false, desactivada_en = v_ahora
  WHERE id = p_organizacion_id;

  RETURN jsonb_build_object(
    'organizacion_id', p_organizacion_id,
    'nombre',          v_nombre,
    'desactivada_en',  v_ahora,
    'purga_en',        v_ahora + interval '3 months'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sgtd_desactivar_organizacion(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_desactivar_organizacion(uuid) TO authenticated;

COMMENT ON FUNCTION public.sgtd_desactivar_organizacion IS
  'V5 054: soft-delete de org. Reactivable en 90 días antes de purga automática.';

-- ---------------------------------------------------------------------------
-- 3. sgtd_reactivar_organizacion — cancela soft-delete (solo dueño)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_reactivar_organizacion(
  p_organizacion_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_nombre text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.sgtd_es_plataforma_owner() THEN
    RAISE EXCEPTION 'No tienes permiso para reactivar organizaciones.' USING ERRCODE = 'P0007';
  END IF;

  SELECT o.nombre INTO v_nombre
  FROM public.organizacion o
  WHERE o.id = p_organizacion_id AND o.activa = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La organización no existe o ya está activa.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.organizacion
  SET activa = true, desactivada_en = NULL
  WHERE id = p_organizacion_id;

  RETURN jsonb_build_object(
    'organizacion_id', p_organizacion_id,
    'nombre',          v_nombre
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sgtd_reactivar_organizacion(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_reactivar_organizacion(uuid) TO authenticated;

COMMENT ON FUNCTION public.sgtd_reactivar_organizacion IS
  'V5 054: cancela soft-delete antes de que se cumpla el período de purga.';

-- ---------------------------------------------------------------------------
-- 4. sgtd_listar_orgs_desactivadas — lista la papelera del dueño
--    Todas las referencias usan alias "o." para evitar ERRCODE 42702
--    (output vars RETURNS TABLE tienen los mismos nombres que las columnas).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_listar_orgs_desactivadas()
RETURNS TABLE (
  id             uuid,
  nombre         text,
  slug           text,
  desactivada_en timestamptz,
  purga_en       timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.sgtd_es_plataforma_owner() THEN
    RAISE EXCEPTION 'No tienes permiso.' USING ERRCODE = 'P0007';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.nombre,
    o.slug,
    o.desactivada_en,
    o.desactivada_en + interval '3 months'
  FROM public.organizacion o
  WHERE o.activa = false
    AND o.desactivada_en IS NOT NULL
  ORDER BY o.desactivada_en ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.sgtd_listar_orgs_desactivadas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_listar_orgs_desactivadas() TO authenticated;

COMMENT ON FUNCTION public.sgtd_listar_orgs_desactivadas IS
  'V5 054: papelera del dueño — orgs desactivadas con fecha de purga.';

-- ---------------------------------------------------------------------------
-- 5. sgtd_purgar_organizaciones_inactivas — hard-delete (llamada por cron)
--
--    Orden de borrado FK-seguro (workspace_id FKs son RESTRICT, no CASCADE):
--      log_ot → log_accion → orden_trabajo → tipo_trabajo_ot
--      → tarea → objetivo → evento → recurrencia_evento → nota_bitacora
--      → DELETE organizacion (CASCADE: workspace → workspace_member,
--        workspace_modulo, cliente, proyecto, area; organizacion_member)
--
--    Sin gate de dueño: ejecutada por el scheduler, no por usuarios autenticados.
--    Sin GRANT a authenticated: solo accesible vía service role / cron.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_purgar_organizaciones_inactivas()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org_id     uuid;
  v_org_nombre text;
  v_ws_ids     uuid[];
  v_count      integer := 0;
BEGIN
  FOR v_org_id, v_org_nombre IN
    SELECT o.id, o.nombre
    FROM public.organizacion o
    WHERE o.activa = false
      AND o.desactivada_en IS NOT NULL
      AND o.desactivada_en < now() - interval '3 months'
    ORDER BY o.desactivada_en ASC
  LOOP
    BEGIN
      -- Workspace IDs de esta org (puede ser más de uno si hubo backfill)
      SELECT ARRAY(
        SELECT w.id FROM public.workspace w WHERE w.organizacion_id = v_org_id
      ) INTO v_ws_ids;

      -- Borrar dominio en orden FK-seguro
      DELETE FROM public.log_ot            WHERE workspace_id = ANY(v_ws_ids);
      DELETE FROM public.log_accion        WHERE workspace_id = ANY(v_ws_ids);
      DELETE FROM public.orden_trabajo     WHERE workspace_id = ANY(v_ws_ids);
      DELETE FROM public.tipo_trabajo_ot   WHERE workspace_id = ANY(v_ws_ids);
      DELETE FROM public.tarea             WHERE workspace_id = ANY(v_ws_ids);
      DELETE FROM public.objetivo          WHERE workspace_id = ANY(v_ws_ids);
      DELETE FROM public.evento            WHERE workspace_id = ANY(v_ws_ids);
      DELETE FROM public.recurrencia_evento WHERE workspace_id = ANY(v_ws_ids);
      DELETE FROM public.nota_bitacora     WHERE workspace_id = ANY(v_ws_ids);

      -- Hard-delete de la org (CASCADE: workspace, workspace_member,
      -- workspace_modulo, cliente, proyecto, area, organizacion_member)
      DELETE FROM public.organizacion WHERE id = v_org_id;

      v_count := v_count + 1;
      RAISE NOTICE 'Org purgada: % (%)', v_org_nombre, v_org_id;

    EXCEPTION WHEN OTHERS THEN
      -- FK inesperada: saltear esta org y loguear sin romper el batch
      RAISE WARNING 'Error al purgar org % (%): % — se omite.', v_org_nombre, v_org_id, SQLERRM;
    END;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Sin GRANT: solo cron/service role
REVOKE ALL ON FUNCTION public.sgtd_purgar_organizaciones_inactivas() FROM PUBLIC;

COMMENT ON FUNCTION public.sgtd_purgar_organizaciones_inactivas IS
  'V5 054: hard-delete de orgs con grace period expirado (>3 meses). '
  'Llamada por pg_cron diariamente. Sin gate de auth — no exponer a authenticated.';

-- ---------------------------------------------------------------------------
-- 6. Cron job — purga diaria a las 03:00 UTC
--    Guard: solo programa si pg_cron está disponible.
--    Idempotente: unschedule previo evita duplicado al re-aplicar.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    -- Eliminar job anterior si existe (evita duplicado al re-aplicar)
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'sgtd-purgar-orgs-inactivas';

    PERFORM cron.schedule(
      'sgtd-purgar-orgs-inactivas',
      '0 3 * * *',
      'SELECT public.sgtd_purgar_organizaciones_inactivas()'
    );

    RAISE NOTICE '054: cron job sgtd-purgar-orgs-inactivas programado (03:00 UTC diario).';
  ELSE
    RAISE NOTICE '054: pg_cron no disponible — programar la purga manualmente en InsForge/cron externo.';
  END IF;
END $$;

COMMIT;


-- =============================================================================
-- SMOKE TESTS — ejecutar tras apply
-- =============================================================================

-- T1: columna existe
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='organizacion' AND column_name='desactivada_en';
--   esperado: 1 fila

-- T2 (dueño): desactivar org de prueba
--   SELECT sgtd_desactivar_organizacion('<org-id-prueba>');
--   esperado: {organizacion_id, nombre, desactivada_en, purga_en (= desactivada_en + 3 meses)}

-- T3 (dueño): listar papelera
--   SELECT * FROM sgtd_listar_orgs_desactivadas();
--   esperado: la org del T2 aparece con purga_en

-- T4 (dueño): reactivar
--   SELECT sgtd_reactivar_organizacion('<org-id-prueba>');
--   esperado: {organizacion_id, nombre}; la org ya no aparece en sgtd_listar_orgs_desactivadas

-- T5: cron registrado
--   SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'sgtd-purgar-orgs-inactivas';
--   esperado: 1 fila, schedule = '0 3 * * *'

-- T6 (no-dueño): desactivar → P0007
-- T7: purgar manualmente con org que lleva >3 meses desactivada (staging solo):
--   UPDATE organizacion SET desactivada_en = now() - interval '4 months' WHERE id = '<id>';
--   SELECT sgtd_purgar_organizaciones_inactivas();
--   esperado: 1 (org eliminada permanentemente)


-- =============================================================================
-- ROLLBACK — solo staging
-- =============================================================================
-- SELECT cron.unschedule('sgtd-purgar-orgs-inactivas');
-- DROP FUNCTION IF EXISTS public.sgtd_purgar_organizaciones_inactivas();
-- DROP FUNCTION IF EXISTS public.sgtd_listar_orgs_desactivadas();
-- DROP FUNCTION IF EXISTS public.sgtd_reactivar_organizacion(uuid);
-- DROP FUNCTION IF EXISTS public.sgtd_desactivar_organizacion(uuid);
-- ALTER TABLE public.organizacion DROP COLUMN IF EXISTS desactivada_en;
