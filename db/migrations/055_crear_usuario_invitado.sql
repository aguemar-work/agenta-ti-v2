-- =============================================================================
-- Migración 055 — RPC para completar invitación de usuario (edge function invite-user)
-- =============================================================================
-- La edge function crea auth.users vía API pública; insertar en public.usuario
-- falla por RLS (solo id = auth.uid()). Esta RPC SECURITY DEFINER permite al
-- dueño de plataforma crear la fila de dominio tras verificar auth.users.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.sgtd_crear_usuario_invitado(
  p_usuario_id uuid,
  p_nombre     text,
  p_email      text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.usuario;
  v_email text := lower(trim(p_email));
  v_nombre text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.sgtd_es_plataforma_owner() THEN
    RAISE EXCEPTION 'No tienes permiso para invitar usuarios.' USING ERRCODE = 'P0007';
  END IF;

  IF v_email IS NULL OR v_email = '' OR position('@' in v_email) = 0 THEN
    RAISE EXCEPTION 'email es requerido y debe ser válido' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (SELECT 1 FROM public.usuario u WHERE lower(u.email) = v_email) THEN
    RAISE EXCEPTION 'Ya existe un usuario con ese correo' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p_usuario_id) THEN
    RAISE EXCEPTION 'No existe cuenta de autenticación para completar la invitación' USING ERRCODE = 'P0001';
  END IF;

  v_nombre := COALESCE(NULLIF(trim(p_nombre), ''), split_part(v_email, '@', 1));

  INSERT INTO public.usuario (id, nombre, email, rol, activo)
  VALUES (p_usuario_id, v_nombre, v_email, 'miembro', true)
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.sgtd_crear_usuario_invitado(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_crear_usuario_invitado(uuid, text, text) TO authenticated;

COMMENT ON FUNCTION public.sgtd_crear_usuario_invitado IS
  'V5 055: crea fila public.usuario para cuenta auth invitada (solo plataforma_owner).';

COMMIT;
