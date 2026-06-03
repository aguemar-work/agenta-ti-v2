-- =============================================================================
-- SGTD — Migración 031
-- (1) Blindaje de `rol` contra auto-escalada (trigger; cubre INSERT y UPDATE).
-- (2) Ampliación del SELECT de miembro sobre nota_bitacora: además de las
--     propias, puede leer las notas del equipo con visibilidad = 'todos'.
--
-- Requisitos previos: `sgtd_es_jefe()` (003) y `sgtd_es_miembro_activo()` (005).
-- Ejecutar DESPUÉS de la cadena 005 → 030.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- (1) Trigger anti-escalada de rol en public.usuario
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- (2) nota_bitacora — redefine sgtd_miembro_nota_select (005)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS sgtd_miembro_nota_select ON public.nota_bitacora;
CREATE POLICY sgtd_miembro_nota_select ON public.nota_bitacora
  FOR SELECT
  TO authenticated
  USING (
    public.sgtd_es_miembro_activo()
    AND (usuario_id = auth.uid() OR visibilidad = 'todos')
  );

COMMIT;

-- =============================================================================
-- VERIFICACIÓN
-- 1) Trigger:
--      SELECT tgname FROM pg_trigger WHERE tgname = 'trg_sgtd_proteger_rol_usuario';
-- 2) Escalada bloqueada (MIEMBRO, 42501):
--      UPDATE public.usuario SET rol = 'jefe' WHERE id = auth.uid();
-- 3) Notas (MIEMBRO): ajena 'todos' visible; ajena 'solo_jefe'/'privado' no.
-- =============================================================================
