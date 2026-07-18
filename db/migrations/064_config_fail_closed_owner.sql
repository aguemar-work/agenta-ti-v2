-- =============================================================================
-- SGTD — Migración 064
-- Archivo: 064_config_fail_closed_owner.sql
--
-- SEGURIDAD (auditoría 2026-07-17, hallazgo S5):
--   1. El trigger de dominio de email (023) era fail-open: sin filas
--      'allowed_email_domain_%' en sgtd_config permitía CUALQUIER dominio.
--      Si alguien borra las filas (o un entorno se seedea mal), el alta de
--      usuarios queda abierta sin que nadie lo note.
--   2. La policy sgtd_jefe_config_all (023) daba FOR ALL a cualquier jefe:
--      un jefe podía ampliar la whitelist y habilitar registros externos.
--
-- Cambios:
--   1. Fail-closed: sin dominios configurados el alta se RECHAZA, salvo
--      opt-out explícito con la fila ('email_domain_policy','open').
--   2. sgtd_config: lectura para jefes, escritura solo plataforma_owner.
--
-- POST-APLICAR (verificar una vez por entorno): confirmar que existen filas
--   'allowed_email_domain_%' (o la política 'open' a propósito); si no, el
--   alta de usuarios fallará con el mensaje de abajo — ese es el comportamiento
--   deseado, pero debe ser una decisión, no un accidente.
--
-- Prerrequisitos: 023, 047 (sgtd_es_plataforma_owner).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Trigger de dominio fail-closed con opt-out explícito
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_validar_dominio_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dominio        text;
  v_dominios_count int;
  v_policy         text;
  v_permitido      boolean := false;
BEGIN
  SELECT COUNT(*) INTO v_dominios_count
  FROM public.sgtd_config
  WHERE clave LIKE 'allowed_email_domain_%';

  IF v_dominios_count = 0 THEN
    -- Fail-closed (antes: RETURN NEW). Permitir todos los dominios exige
    -- decirlo explícitamente: INSERT ('email_domain_policy','open').
    SELECT valor INTO v_policy
    FROM public.sgtd_config
    WHERE clave = 'email_domain_policy';

    IF v_policy = 'open' THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'No hay dominios de correo autorizados configurados. Un administrador debe registrar allowed_email_domain_%% en sgtd_config (o fijar email_domain_policy=open).'
      USING ERRCODE = 'check_violation';
  END IF;

  v_dominio := lower(split_part(NEW.email, '@', 2));

  IF v_dominio = '' THEN
    RAISE EXCEPTION 'Email inválido: %', NEW.email
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.sgtd_config
    WHERE clave LIKE 'allowed_email_domain_%'
      AND lower(valor) = v_dominio
  ) INTO v_permitido;

  IF NOT v_permitido THEN
    RAISE EXCEPTION 'El dominio "%" no está autorizado para registrarse en este sistema. Contacta al administrador.',
      v_dominio
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. sgtd_config: lectura jefe / escritura solo dueño de plataforma
--    (el frontend no consulta esta tabla; 0 usos en web/src)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS sgtd_jefe_config_all ON public.sgtd_config;

DROP POLICY IF EXISTS sgtd_config_select_jefe ON public.sgtd_config;
CREATE POLICY sgtd_config_select_jefe ON public.sgtd_config
  FOR SELECT TO authenticated
  USING (public.sgtd_es_jefe() OR public.sgtd_es_plataforma_owner());

DROP POLICY IF EXISTS sgtd_config_write_owner ON public.sgtd_config;
CREATE POLICY sgtd_config_write_owner ON public.sgtd_config
  FOR ALL TO authenticated
  USING (public.sgtd_es_plataforma_owner())
  WITH CHECK (public.sgtd_es_plataforma_owner());

COMMIT;

-- -----------------------------------------------------------------------------
-- Verificación (ejecutar tras COMMIT)
-- -----------------------------------------------------------------------------
-- 1) Estado actual de la whitelist (debe tener filas o política 'open' a propósito):
-- SELECT * FROM public.sgtd_config
--  WHERE clave LIKE 'allowed_email_domain_%' OR clave = 'email_domain_policy';
--
-- 2) Policies resultantes:
-- SELECT polname, polcmd FROM pg_policy
--  WHERE polrelid = 'public.sgtd_config'::regclass;
--   → sgtd_config_select_jefe (r), sgtd_config_write_owner (*)
--
-- 3) Como jefe (no owner): UPDATE public.sgtd_config SET valor = 'x' → 0 filas.
