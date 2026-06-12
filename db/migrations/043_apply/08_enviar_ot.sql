-- =============================================================================
-- PASO 8 — REBIND sgtd_enviar_ot
-- Cuerpo idéntico a 036; solo cambia la generación del número.
-- Firma original: (p_ot_id uuid, p_usuario_id uuid) — SECURITY INVOKER
-- Flujo: borrador → pendiente (NO aprobada)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sgtd_enviar_ot(
  p_ot_id      uuid,
  p_usuario_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_ot record;
BEGIN
  SELECT id, estado, creado_por, descripcion, area_destino, fecha_estimada, numero, workspace_id
  INTO v_ot
  FROM public.orden_trabajo
  WHERE id = p_ot_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OT no encontrada (id: %)', p_ot_id USING ERRCODE = 'P0001';
  END IF;

  IF v_ot.estado <> 'borrador' THEN
    RAISE EXCEPTION 'Solo se puede enviar una OT en borrador (estado actual: "%")', v_ot.estado
      USING ERRCODE = 'P0002';
  END IF;

  -- Permiso: creador o jefe (036)
  IF v_ot.creado_por <> p_usuario_id AND NOT public.sgtd_es_jefe() THEN
    RAISE EXCEPTION 'Sin permiso para enviar esta OT' USING ERRCODE = 'P0003';
  END IF;

  -- Validaciones de campos (036)
  IF btrim(coalesce(v_ot.descripcion, '')) IN ('', '(borrador)') THEN
    RAISE EXCEPTION 'La descripción es obligatoria para enviar' USING ERRCODE = 'P0004';
  END IF;

  IF btrim(coalesce(v_ot.area_destino, '')) IN ('', '(pendiente)') THEN
    RAISE EXCEPTION 'El área destino es obligatoria para enviar' USING ERRCODE = 'P0005';
  END IF;

  IF v_ot.fecha_estimada IS NULL THEN
    RAISE EXCEPTION 'La fecha estimada es obligatoria para enviar' USING ERRCODE = 'P0006';
  END IF;

  IF v_ot.fecha_estimada < CURRENT_DATE THEN
    RAISE EXCEPTION 'La fecha estimada no puede ser anterior a hoy' USING ERRCODE = 'P0007';
  END IF;

  -- Número correlativo por workspace (idempotente: solo asigna si aún no tiene)
  IF v_ot.numero IS NULL OR btrim(v_ot.numero) = '' THEN
    UPDATE public.orden_trabajo
    SET numero     = public.sgtd_generar_numero_ot(v_ot.workspace_id),
        updated_at = now()
    WHERE id = p_ot_id;
  END IF;

  -- Transición: borrador → pendiente (036)
  UPDATE public.orden_trabajo
  SET estado     = 'pendiente',
      updated_at = now()
  WHERE id = p_ot_id;

  -- Log con schema real de log_ot (ot_id, estado_anterior, estado_nuevo)
  INSERT INTO public.log_ot (ot_id, workspace_id, usuario_id, accion, estado_anterior, estado_nuevo)
  VALUES (p_ot_id, v_ot.workspace_id, p_usuario_id, 'enviada', 'borrador', 'pendiente');

END;
$$;

REVOKE ALL ON FUNCTION public.sgtd_enviar_ot(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgtd_enviar_ot(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.sgtd_enviar_ot IS
  'Flujo OT: borrador → pendiente. Número OT-TI-XXXX por workspace (idempotente). '
  'Firma idéntica a 036 (p_ot_id, p_usuario_id). Solo workspace interno (D2).';
