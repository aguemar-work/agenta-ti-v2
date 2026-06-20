-- =============================================================================
-- Migración 058 — Fix trigger rol: invitaciones 057 con usuario.rol NULL
-- =============================================================================
-- Problema: sgtd_invitar_a_workspace (057) inserta public.usuario con rol NULL
-- (rol operativo vive en workspace_member). El trigger 031 trata NULL como
-- distinto de 'miembro' y bloquea al plataforma_owner (no es sgtd_es_jefe()).
--
-- Error observado: "Solo un jefe puede asignar el rol <NULL>" → invite-user 500.
--
-- Fix: permitir rol NULL (no es escalada) y bypass para plataforma_owner.
--
-- Identificador:
--   SELECT pg_get_functiondef(p.oid) LIKE '%sgtd_es_plataforma_owner%'
--   FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
--   WHERE n.nspname='public' AND p.proname='sgtd_proteger_rol_usuario';
-- =============================================================================

BEGIN;

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

  -- Dueño de plataforma y jefes pueden asignar cualquier rol (incl. NULL deprecado)
  IF public.sgtd_es_plataforma_owner() OR public.sgtd_es_jefe() THEN
    RETURN NEW;
  END IF;

  -- NULL = sin rol global (V5: rol operativo en workspace_member); no es escalada
  IF NEW.rol IS NULL THEN
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

COMMENT ON FUNCTION public.sgtd_proteger_rol_usuario IS
  '031 + 058: anti-escalada de rol en public.usuario. '
  'Permite NULL (rol global deprecado) y bypass owner/jefe.';

COMMIT;

-- =============================================================================
-- ROLLBACK (solo staging)
-- =============================================================================
-- Restaurar versión 031 original (sin owner bypass ni NULL):
-- CREATE OR REPLACE FUNCTION public.sgtd_proteger_rol_usuario() ... (ver 031)
