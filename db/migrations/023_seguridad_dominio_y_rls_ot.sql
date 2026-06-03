-- =============================================================================
-- SGTD — Migración 023
-- Archivo: 023_seguridad_dominio_y_rls_ot.sql
--
-- PROBLEMA 1: Validación de dominio de email solo existía en el frontend.
--   Un atacante con acceso directo a la API de InsForge podía hacer INSERT
--   en public.usuario con cualquier email, saltándose la whitelist del cliente.
--
-- SOLUCIÓN: Trigger BEFORE INSERT en public.usuario que valida el dominio
--   contra la tabla de configuración sgtd_config. Si el dominio no está
--   permitido, el INSERT falla con un error claro. El frontend puede seguir
--   haciendo la validación (buena UX), pero ya no es la única barrera.
--
-- PROBLEMA 2: No había políticas RLS en orden_trabajo ni log_ot.
--   El código frontend ya filtraba correctamente por rol, pero si alguien
--   llamaba a la API directamente podía leer/modificar todas las OTs.
--
-- SOLUCIÓN: Políticas RLS para orden_trabajo y log_ot alineadas con el
--   patrón jefe/miembro existente.
--
-- Cómo aplicar: Dashboard InsForge → SQL Editor → Run
-- =============================================================================

BEGIN;

-- =============================================================================
-- PARTE 1: Tabla de configuración + trigger de dominio
-- =============================================================================

-- Tabla de configuración del sistema (clave/valor)
-- Usada inicialmente solo para la whitelist de dominios.
CREATE TABLE IF NOT EXISTS public.sgtd_config (
  clave      text PRIMARY KEY,
  valor      text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Solo el jefe puede leer/escribir la configuración del sistema
ALTER TABLE public.sgtd_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sgtd_jefe_config_all ON public.sgtd_config;
CREATE POLICY sgtd_jefe_config_all ON public.sgtd_config
  FOR ALL TO authenticated
  USING (public.sgtd_es_jefe())
  WITH CHECK (public.sgtd_es_jefe());

-- Insertar dominios iniciales desde el .env actual.
-- IMPORTANTE: Reemplaza 'empresa.com' con el dominio real de tu organización.
-- Si usas múltiples dominios, inserta una fila por cada uno.
-- Ejemplo para dos dominios:
--   INSERT INTO public.sgtd_config VALUES ('allowed_email_domain_1', 'empresa.com', now());
--   INSERT INTO public.sgtd_config VALUES ('allowed_email_domain_2', 'contratistas.empresa.com', now());
--
-- Si VITE_ALLOWED_EMAIL_DOMAINS estaba vacío (sin restricción), no insertes nada
-- y el trigger dejará pasar cualquier dominio (comportamiento equivalente).
--
-- REEMPLAZA ESTO con tu dominio real antes de ejecutar:
INSERT INTO public.sgtd_config (clave, valor, updated_at)
VALUES ('allowed_email_domain_1', 'empresa.com', now())
ON CONFLICT (clave) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Función que valida el dominio del email contra sgtd_config
-- SECURITY DEFINER para poder leer sgtd_config sin RLS
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sgtd_validar_dominio_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dominio        text;
  v_dominios_count int;
  v_permitido      boolean := false;
BEGIN
  -- Si no hay ningún dominio configurado, se permite cualquiera
  -- (equivalente a no tener VITE_ALLOWED_EMAIL_DOMAINS en el .env)
  SELECT COUNT(*) INTO v_dominios_count
  FROM public.sgtd_config
  WHERE clave LIKE 'allowed_email_domain_%';

  IF v_dominios_count = 0 THEN
    RETURN NEW;
  END IF;

  -- Extraer dominio del email
  v_dominio := lower(split_part(NEW.email, '@', 2));

  IF v_dominio = '' THEN
    RAISE EXCEPTION 'Email inválido: %', NEW.email
      USING ERRCODE = 'check_violation';
  END IF;

  -- Verificar contra la lista de dominios permitidos
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

-- Aplicar el trigger en INSERT de usuario
-- (UPDATE no necesita re-validar porque el email no debería cambiar)
DROP TRIGGER IF EXISTS sgtd_trigger_validar_dominio ON public.usuario;
CREATE TRIGGER sgtd_trigger_validar_dominio
  BEFORE INSERT ON public.usuario
  FOR EACH ROW
  EXECUTE FUNCTION public.sgtd_validar_dominio_email();

-- =============================================================================
-- PARTE 2: RLS para orden_trabajo y log_ot
-- =============================================================================

-- Habilitar RLS si no estaba habilitado
ALTER TABLE public.orden_trabajo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_ot        ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- orden_trabajo — Jefe (acceso total, coherente con el patrón existente)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS sgtd_jefe_ot_all ON public.orden_trabajo;
CREATE POLICY sgtd_jefe_ot_all ON public.orden_trabajo
  FOR ALL TO authenticated
  USING (public.sgtd_es_jefe())
  WITH CHECK (public.sgtd_es_jefe());

-- ---------------------------------------------------------------------------
-- orden_trabajo — Miembro
-- SELECT:  propias (creado_por = self)
-- INSERT:  propias (creado_por = self)
-- UPDATE:  propias, solo si está en borrador o rechazada (puede corregir y reenviar)
-- DELETE:  propias, solo si está en borrador (nunca enviadas)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS sgtd_miembro_ot_select ON public.orden_trabajo;
DROP POLICY IF EXISTS sgtd_miembro_ot_insert ON public.orden_trabajo;
DROP POLICY IF EXISTS sgtd_miembro_ot_update ON public.orden_trabajo;
DROP POLICY IF EXISTS sgtd_miembro_ot_delete ON public.orden_trabajo;

CREATE POLICY sgtd_miembro_ot_select ON public.orden_trabajo
  FOR SELECT TO authenticated
  USING (public.sgtd_es_miembro_activo() AND creado_por = auth.uid());

CREATE POLICY sgtd_miembro_ot_insert ON public.orden_trabajo
  FOR INSERT TO authenticated
  WITH CHECK (
    public.sgtd_es_miembro_activo()
    AND creado_por = auth.uid()
    -- Miembro solo puede crear en borrador o pendiente (envío directo)
    AND estado IN ('borrador', 'pendiente')
    -- Nunca puede auto-asignarse como aprobador
    AND aprobado_por IS NULL
  );

CREATE POLICY sgtd_miembro_ot_update ON public.orden_trabajo
  FOR UPDATE TO authenticated
  USING (
    public.sgtd_es_miembro_activo()
    AND creado_por = auth.uid()
    -- Solo puede editar si aún no fue procesada
    AND estado IN ('borrador', 'rechazada')
  )
  WITH CHECK (
    creado_por = auth.uid()
    AND aprobado_por IS NULL
  );

CREATE POLICY sgtd_miembro_ot_delete ON public.orden_trabajo
  FOR DELETE TO authenticated
  USING (
    public.sgtd_es_miembro_activo()
    AND creado_por = auth.uid()
    AND estado = 'borrador'
  );

-- ---------------------------------------------------------------------------
-- log_ot — Jefe (acceso total)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS sgtd_jefe_log_ot_all ON public.log_ot;
CREATE POLICY sgtd_jefe_log_ot_all ON public.log_ot
  FOR ALL TO authenticated
  USING (public.sgtd_es_jefe())
  WITH CHECK (public.sgtd_es_jefe());

-- ---------------------------------------------------------------------------
-- log_ot — Miembro
-- SELECT:  solo logs de sus propias OTs
-- INSERT:  puede registrar acciones sobre sus propias OTs
-- UPDATE / DELETE: nunca (los logs son inmutables)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS sgtd_miembro_log_ot_select ON public.log_ot;
DROP POLICY IF EXISTS sgtd_miembro_log_ot_insert ON public.log_ot;

CREATE POLICY sgtd_miembro_log_ot_select ON public.log_ot
  FOR SELECT TO authenticated
  USING (
    public.sgtd_es_miembro_activo()
    AND EXISTS (
      SELECT 1 FROM public.orden_trabajo ot
      WHERE ot.id = log_ot.ot_id
        AND ot.creado_por = auth.uid()
    )
  );

CREATE POLICY sgtd_miembro_log_ot_insert ON public.log_ot
  FOR INSERT TO authenticated
  WITH CHECK (
    public.sgtd_es_miembro_activo()
    AND usuario_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.orden_trabajo ot
      WHERE ot.id = log_ot.ot_id
        AND ot.creado_por = auth.uid()
    )
  );

-- =============================================================================
-- VERIFICACIÓN — ejecutar después de aplicar para confirmar:
--
-- 1. Trigger creado:
--    SELECT trigger_name, event_manipulation, action_timing
--    FROM information_schema.triggers
--    WHERE event_object_table = 'usuario'
--      AND trigger_name = 'sgtd_trigger_validar_dominio';
--
-- 2. Dominios configurados:
--    SELECT * FROM public.sgtd_config WHERE clave LIKE 'allowed_email_domain_%';
--
-- 3. Políticas RLS creadas:
--    SELECT tablename, policyname, cmd
--    FROM pg_policies
--    WHERE policyname LIKE 'sgtd_%ot%'
--    ORDER BY tablename, policyname;
--    -- Deberías ver 8 políticas (4 para orden_trabajo, 2 para log_ot jefe, 2 miembro)
--
-- 4. Test de dominio bloqueado (ejecutar como usuario anon para simular):
--    INSERT INTO public.usuario (id, nombre, email, rol, activo)
--    VALUES (gen_random_uuid(), 'Test', 'test@dominio-no-autorizado.com', 'miembro', true);
--    -- Debe fallar con: "El dominio... no está autorizado"
-- =============================================================================

COMMIT;