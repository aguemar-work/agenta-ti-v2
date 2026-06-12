-- =============================================================================
-- PASO 6 — DROP políticas legacy + CREATE POLICY nuevas
-- Todas las políticas V4 (003/005/023/025/031) se eliminan explícitamente
-- antes de recrear con filtro workspace_id. RLS permissive = el OR entre
-- políticas antiguas y nuevas crearía fuga cross-workspace.
-- =============================================================================

-- Habilitar RLS en tablas nuevas
ALTER TABLE public.organizacion        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizacion_member ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_member    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_preferencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proyecto            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.area                ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- usuario — DROP legacy 003/005 + recrear scoped a workspace_member
-- ===========================================================================
DROP POLICY IF EXISTS sgtd_jefe_usuario_all                  ON public.usuario;
DROP POLICY IF EXISTS sgtd_miembro_usuario_select_propio     ON public.usuario;
DROP POLICY IF EXISTS sgtd_miembro_usuario_select_activos    ON public.usuario;
DROP POLICY IF EXISTS sgtd_miembro_usuario_insert_propio     ON public.usuario;
DROP POLICY IF EXISTS sgtd_miembro_usuario_update_propio     ON public.usuario;

-- Jefe: solo miembros del workspace activo (dropdowns de asignación; no global multi-org)
CREATE POLICY sgtd_jefe_usuario_all ON public.usuario
  FOR ALL TO authenticated
  USING (
    sgtd_es_jefe()
    AND EXISTS (
      SELECT 1 FROM public.workspace_member wm
      WHERE wm.workspace_id = sgtd_workspace_id()
        AND wm.usuario_id   = public.usuario.id
        AND wm.activo       = true
        AND wm.joined_at    IS NOT NULL
    )
  )
  WITH CHECK (
    sgtd_es_jefe()
    AND EXISTS (
      SELECT 1 FROM public.workspace_member wm
      WHERE wm.workspace_id = sgtd_workspace_id()
        AND wm.usuario_id   = public.usuario.id
        AND wm.activo       = true
        AND wm.joined_at    IS NOT NULL
    )
  );

-- Miembro: perfil propio siempre
CREATE POLICY sgtd_miembro_usuario_select_propio ON public.usuario
  FOR SELECT TO authenticated
  USING (sgtd_es_miembro_activo() AND id = auth.uid());

-- Miembro: usuarios del mismo workspace (para dropdowns)
CREATE POLICY sgtd_miembro_usuario_select_ws ON public.usuario
  FOR SELECT TO authenticated
  USING (
    sgtd_es_miembro_activo()
    AND EXISTS (
      SELECT 1 FROM public.workspace_member wm
      WHERE wm.workspace_id = sgtd_workspace_id()
        AND wm.usuario_id   = public.usuario.id
        AND wm.activo       = true
        AND wm.joined_at    IS NOT NULL
    )
  );

-- Miembro: puede crear su propio perfil (primer login)
CREATE POLICY sgtd_miembro_usuario_insert_propio ON public.usuario
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- Miembro: puede actualizar su propio perfil (no puede cambiar rol)
CREATE POLICY sgtd_miembro_usuario_update_propio ON public.usuario
  FOR UPDATE TO authenticated
  USING  (sgtd_es_miembro_activo() AND id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ===========================================================================
-- tarea — DROP legacy 003/005 + recrear con workspace_id
-- ===========================================================================
DROP POLICY IF EXISTS sgtd_jefe_tarea_all       ON public.tarea;
DROP POLICY IF EXISTS sgtd_miembro_tarea_select  ON public.tarea;
DROP POLICY IF EXISTS sgtd_miembro_tarea_insert  ON public.tarea;
DROP POLICY IF EXISTS sgtd_miembro_tarea_update  ON public.tarea;
DROP POLICY IF EXISTS sgtd_miembro_tarea_delete  ON public.tarea;

CREATE POLICY sgtd_jefe_tarea_all ON public.tarea
  FOR ALL TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
  )
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
  );

-- Miembro: ve todas las tareas del workspace (vista equipo, lectura)
CREATE POLICY sgtd_miembro_tarea_select ON public.tarea
  FOR SELECT TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
  );

-- Miembro: crea sus propias tareas
CREATE POLICY sgtd_miembro_tarea_insert ON public.tarea
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND asignado_a = auth.uid()
    AND creado_por = auth.uid()
  );

-- Miembro: actualiza solo las que le están asignadas
CREATE POLICY sgtd_miembro_tarea_update ON public.tarea
  FOR UPDATE TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND asignado_a = auth.uid()
  )
  WITH CHECK (asignado_a = auth.uid());

-- Miembro: borra solo las propias no terminales (soft-delete via RPC preferible)
CREATE POLICY sgtd_miembro_tarea_delete ON public.tarea
  FOR DELETE TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND creado_por = auth.uid()
    AND estado NOT IN ('completada', 'cancelada')
  );

-- ===========================================================================
-- objetivo — DROP legacy 003/005 + recrear con workspace_id
-- Columnas reales: creado_por, responsable_id (migración 002/005)
-- ===========================================================================
DROP POLICY IF EXISTS sgtd_jefe_objetivo_all       ON public.objetivo;
DROP POLICY IF EXISTS sgtd_miembro_objetivo_select  ON public.objetivo;
DROP POLICY IF EXISTS sgtd_miembro_objetivo_insert  ON public.objetivo;
DROP POLICY IF EXISTS sgtd_miembro_objetivo_update  ON public.objetivo;

CREATE POLICY sgtd_jefe_objetivo_all ON public.objetivo
  FOR ALL TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
  )
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
  );

-- Miembro: ve todos los objetivos no cancelados del workspace
CREATE POLICY sgtd_miembro_objetivo_select ON public.objetivo
  FOR SELECT TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND estado != 'cancelado'
  );

-- Miembro: crea objetivos propios con responsable = self o null
CREATE POLICY sgtd_miembro_objetivo_insert ON public.objetivo
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND creado_por = auth.uid()
    AND (responsable_id = auth.uid() OR responsable_id IS NULL)
  );

-- Miembro: actualiza si es creador o responsable
CREATE POLICY sgtd_miembro_objetivo_update ON public.objetivo
  FOR UPDATE TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND (responsable_id = auth.uid() OR creado_por = auth.uid())
  )
  WITH CHECK (
    responsable_id = auth.uid() OR responsable_id IS NULL
  );

-- ===========================================================================
-- evento — DROP legacy 003/005 + recrear con workspace_id
-- ===========================================================================
DROP POLICY IF EXISTS sgtd_jefe_evento_all    ON public.evento;
DROP POLICY IF EXISTS sgtd_miembro_evento_select ON public.evento;
DROP POLICY IF EXISTS sgtd_miembro_evento_insert ON public.evento;
DROP POLICY IF EXISTS sgtd_miembro_evento_update ON public.evento;
DROP POLICY IF EXISTS sgtd_miembro_evento_delete ON public.evento;

CREATE POLICY sgtd_jefe_evento_all ON public.evento
  FOR ALL TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
  )
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
  );

CREATE POLICY sgtd_miembro_evento_select ON public.evento
  FOR SELECT TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND usuario_id = auth.uid()
  );

CREATE POLICY sgtd_miembro_evento_insert ON public.evento
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND usuario_id = auth.uid()
  );

CREATE POLICY sgtd_miembro_evento_update ON public.evento
  FOR UPDATE TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND usuario_id = auth.uid()
  )
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY sgtd_miembro_evento_delete ON public.evento
  FOR DELETE TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND usuario_id = auth.uid()
  );

-- ===========================================================================
-- recurrencia_evento — DROP legacy 025 + recrear con workspace_id
-- ===========================================================================
DROP POLICY IF EXISTS sgtd_jefe_recurrencia_all       ON public.recurrencia_evento;
DROP POLICY IF EXISTS sgtd_miembro_recurrencia_select  ON public.recurrencia_evento;
DROP POLICY IF EXISTS sgtd_miembro_recurrencia_insert  ON public.recurrencia_evento;
DROP POLICY IF EXISTS sgtd_miembro_recurrencia_update  ON public.recurrencia_evento;
DROP POLICY IF EXISTS sgtd_miembro_recurrencia_delete  ON public.recurrencia_evento;

CREATE POLICY sgtd_jefe_recurrencia_all ON public.recurrencia_evento
  FOR ALL TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
  )
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
  );

CREATE POLICY sgtd_miembro_recurrencia_select ON public.recurrencia_evento
  FOR SELECT TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND usuario_id = auth.uid()
  );

CREATE POLICY sgtd_miembro_recurrencia_insert ON public.recurrencia_evento
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND usuario_id = auth.uid()
  );

CREATE POLICY sgtd_miembro_recurrencia_update ON public.recurrencia_evento
  FOR UPDATE TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND usuario_id = auth.uid()
  )
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY sgtd_miembro_recurrencia_delete ON public.recurrencia_evento
  FOR DELETE TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND usuario_id = auth.uid()
  );

-- ===========================================================================
-- nota_bitacora — DROP legacy 003/005/031 + recrear con workspace_id
-- 031 amplió SELECT con visibilidad='todos'; se mantiene esa regla.
-- ===========================================================================
DROP POLICY IF EXISTS sgtd_jefe_nota_bitacora_all  ON public.nota_bitacora;
DROP POLICY IF EXISTS sgtd_miembro_nota_select     ON public.nota_bitacora;
DROP POLICY IF EXISTS sgtd_miembro_nota_insert     ON public.nota_bitacora;
DROP POLICY IF EXISTS sgtd_miembro_nota_update     ON public.nota_bitacora;
DROP POLICY IF EXISTS sgtd_miembro_nota_delete     ON public.nota_bitacora;

CREATE POLICY sgtd_jefe_nota_bitacora_all ON public.nota_bitacora
  FOR ALL TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
  )
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
  );

-- SELECT: propias + las del equipo con visibilidad='todos' (031)
CREATE POLICY sgtd_miembro_nota_select ON public.nota_bitacora
  FOR SELECT TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND (usuario_id = auth.uid() OR visibilidad = 'todos')
  );

CREATE POLICY sgtd_miembro_nota_insert ON public.nota_bitacora
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND usuario_id = auth.uid()
  );

CREATE POLICY sgtd_miembro_nota_update ON public.nota_bitacora
  FOR UPDATE TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND usuario_id = auth.uid()
  )
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY sgtd_miembro_nota_delete ON public.nota_bitacora
  FOR DELETE TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND usuario_id    = auth.uid()
    AND convertida_en IS NULL
  );

-- ===========================================================================
-- log_accion — DROP legacy 003/005 + recrear con workspace_id
-- ===========================================================================
DROP POLICY IF EXISTS sgtd_jefe_log_accion_all ON public.log_accion;
DROP POLICY IF EXISTS sgtd_miembro_log_select  ON public.log_accion;
DROP POLICY IF EXISTS sgtd_miembro_log_insert  ON public.log_accion;

CREATE POLICY sgtd_jefe_log_accion_all ON public.log_accion
  FOR ALL TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
  )
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
  );

CREATE POLICY sgtd_miembro_log_select ON public.log_accion
  FOR SELECT TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND usuario_id = auth.uid()
  );

CREATE POLICY sgtd_miembro_log_insert ON public.log_accion
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND usuario_id     = auth.uid()
    AND leido_por_jefe = false
  );

-- ===========================================================================
-- orden_trabajo — DROP legacy 023 + recrear con workspace_id (solo interno)
-- ===========================================================================
DROP POLICY IF EXISTS sgtd_jefe_ot_all       ON public.orden_trabajo;
DROP POLICY IF EXISTS sgtd_miembro_ot_select  ON public.orden_trabajo;
DROP POLICY IF EXISTS sgtd_miembro_ot_insert  ON public.orden_trabajo;
DROP POLICY IF EXISTS sgtd_miembro_ot_update  ON public.orden_trabajo;
DROP POLICY IF EXISTS sgtd_miembro_ot_delete  ON public.orden_trabajo;

CREATE POLICY sgtd_jefe_ot_all ON public.orden_trabajo
  FOR ALL TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
    AND (SELECT tipo FROM public.workspace WHERE id = workspace_id) = 'interno'
  )
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
    AND (SELECT tipo FROM public.workspace WHERE id = workspace_id) = 'interno'
  );

-- Miembro: ve sus propias OT (023)
CREATE POLICY sgtd_miembro_ot_select ON public.orden_trabajo
  FOR SELECT TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND creado_por = auth.uid()
    AND (SELECT tipo FROM public.workspace WHERE id = workspace_id) = 'interno'
  );

-- Miembro: crea borradores propios (023)
CREATE POLICY sgtd_miembro_ot_insert ON public.orden_trabajo
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND creado_por  = auth.uid()
    AND estado      IN ('borrador', 'pendiente')
    AND aprobado_por IS NULL
    AND (SELECT tipo FROM public.workspace WHERE id = workspace_id) = 'interno'
  );

-- Miembro: edita solo borrador/rechazada propios (023)
CREATE POLICY sgtd_miembro_ot_update ON public.orden_trabajo
  FOR UPDATE TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND creado_por = auth.uid()
    AND estado     IN ('borrador', 'rechazada')
    AND (SELECT tipo FROM public.workspace WHERE id = workspace_id) = 'interno'
  )
  WITH CHECK (creado_por = auth.uid() AND aprobado_por IS NULL);

-- Miembro: borra solo borradores propios (023)
CREATE POLICY sgtd_miembro_ot_delete ON public.orden_trabajo
  FOR DELETE TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND creado_por = auth.uid()
    AND estado     = 'borrador'
    AND (SELECT tipo FROM public.workspace WHERE id = workspace_id) = 'interno'
  );

-- ===========================================================================
-- log_ot — DROP legacy 010/023 + recrear con workspace_id
-- ===========================================================================
DROP POLICY IF EXISTS sgtd_jefe_log_ot_all       ON public.log_ot;
DROP POLICY IF EXISTS sgtd_miembro_log_ot_select  ON public.log_ot;
DROP POLICY IF EXISTS sgtd_miembro_log_ot_insert  ON public.log_ot;

CREATE POLICY sgtd_jefe_log_ot_all ON public.log_ot
  FOR ALL TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
  )
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
  );

CREATE POLICY sgtd_miembro_log_ot_select ON public.log_ot
  FOR SELECT TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND EXISTS (
      SELECT 1 FROM public.orden_trabajo ot
      WHERE ot.id = log_ot.ot_id AND ot.creado_por = auth.uid()
    )
  );

CREATE POLICY sgtd_miembro_log_ot_insert ON public.log_ot
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND usuario_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.orden_trabajo ot
      WHERE ot.id = log_ot.ot_id AND ot.creado_por = auth.uid()
    )
  );

-- ===========================================================================
-- tipo_trabajo_ot — DROP legacy + recrear con workspace_id
-- Legacy 005/schema: sgtd_miembro_tipo_trabajo_select (sin _ot_ intermedio)
-- ===========================================================================
DROP POLICY IF EXISTS sgtd_jefe_tipo_trabajo_ot_all       ON public.tipo_trabajo_ot;
DROP POLICY IF EXISTS sgtd_miembro_tipo_trabajo_ot_select  ON public.tipo_trabajo_ot;
DROP POLICY IF EXISTS sgtd_miembro_tipo_trabajo_select     ON public.tipo_trabajo_ot;

CREATE POLICY sgtd_jefe_tipo_trabajo_ot_all ON public.tipo_trabajo_ot
  FOR ALL TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
  )
  WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_jefe()
  );

CREATE POLICY sgtd_miembro_tipo_trabajo_ot_select ON public.tipo_trabajo_ot
  FOR SELECT TO authenticated
  USING (
    workspace_id = sgtd_workspace_id()
    AND sgtd_puede_acceder_workspace(workspace_id)
    AND sgtd_es_miembro_activo()
    AND activo = true
  );

-- ===========================================================================
-- Tablas nuevas: organizacion / workspace / miembros / catálogos
-- ===========================================================================

-- organizacion
CREATE POLICY organizacion_select ON public.organizacion
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.organizacion_member om
            WHERE om.organizacion_id = organizacion.id AND om.usuario_id = auth.uid() AND om.activo = true)
    OR EXISTS (SELECT 1 FROM public.workspace_member wm
               JOIN public.workspace w ON w.id = wm.workspace_id
               WHERE w.organizacion_id = organizacion.id AND wm.usuario_id = auth.uid()
                 AND wm.activo = true AND wm.joined_at IS NOT NULL)
  );
CREATE POLICY organizacion_insert ON public.organizacion
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY organizacion_update ON public.organizacion
  FOR UPDATE USING (sgtd_es_org_admin(organizacion.id));

-- workspace
CREATE POLICY workspace_select ON public.workspace
  FOR SELECT USING (sgtd_puede_acceder_workspace(workspace.id) OR sgtd_es_org_admin(workspace.organizacion_id));
CREATE POLICY workspace_insert ON public.workspace
  FOR INSERT WITH CHECK (sgtd_es_org_admin(organizacion_id));
CREATE POLICY workspace_update ON public.workspace
  FOR UPDATE USING (sgtd_es_org_admin(organizacion_id));

-- organizacion_member
CREATE POLICY org_member_select ON public.organizacion_member
  FOR SELECT USING (sgtd_es_org_admin(organizacion_id) OR usuario_id = auth.uid());
CREATE POLICY org_member_insert ON public.organizacion_member
  FOR INSERT WITH CHECK (sgtd_es_org_admin(organizacion_id));

-- workspace_member
CREATE POLICY ws_member_select ON public.workspace_member
  FOR SELECT USING (
    sgtd_puede_acceder_workspace(workspace_id)
    OR sgtd_es_org_admin((SELECT organizacion_id FROM public.workspace WHERE id = workspace_id))
  );
CREATE POLICY ws_member_insert ON public.workspace_member
  FOR INSERT WITH CHECK (
    sgtd_es_org_admin((SELECT organizacion_id FROM public.workspace WHERE id = workspace_id))
    OR sgtd_es_jefe()
  );
CREATE POLICY ws_member_update ON public.workspace_member
  FOR UPDATE USING (
    sgtd_es_org_admin((SELECT organizacion_id FROM public.workspace WHERE id = workspace_id))
  );

-- usuario_preferencia (solo el propio usuario)
CREATE POLICY usuario_preferencia_select ON public.usuario_preferencia
  FOR SELECT USING (usuario_id = auth.uid());
CREATE POLICY usuario_preferencia_insert ON public.usuario_preferencia
  FOR INSERT WITH CHECK (usuario_id = auth.uid());
CREATE POLICY usuario_preferencia_update ON public.usuario_preferencia
  FOR UPDATE USING (usuario_id = auth.uid());

-- cliente (org_admin OR jefe — D4)
CREATE POLICY cliente_select ON public.cliente
  FOR SELECT USING (
    workspace_id = sgtd_workspace_id() AND sgtd_puede_acceder_workspace(workspace_id)
  );
CREATE POLICY cliente_insert ON public.cliente
  FOR INSERT WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND (SELECT tipo FROM public.workspace WHERE id = workspace_id) = 'agencia'
    AND (sgtd_es_jefe() OR sgtd_es_org_admin((SELECT organizacion_id FROM public.workspace WHERE id = workspace_id)))
  );
CREATE POLICY cliente_update ON public.cliente
  FOR UPDATE USING (
    workspace_id = sgtd_workspace_id()
    AND (sgtd_es_jefe() OR sgtd_es_org_admin((SELECT organizacion_id FROM public.workspace WHERE id = workspace_id)))
  );

-- proyecto
CREATE POLICY proyecto_select ON public.proyecto
  FOR SELECT USING (
    workspace_id = sgtd_workspace_id() AND sgtd_puede_acceder_workspace(workspace_id)
  );
CREATE POLICY proyecto_insert ON public.proyecto
  FOR INSERT WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND (SELECT tipo FROM public.workspace WHERE id = workspace_id) = 'agencia'
    AND (sgtd_es_jefe() OR sgtd_es_org_admin((SELECT organizacion_id FROM public.workspace WHERE id = workspace_id)))
  );
CREATE POLICY proyecto_update ON public.proyecto
  FOR UPDATE USING (
    workspace_id = sgtd_workspace_id()
    AND (sgtd_es_jefe() OR sgtd_es_org_admin((SELECT organizacion_id FROM public.workspace WHERE id = workspace_id)))
  );

-- area
CREATE POLICY area_select ON public.area
  FOR SELECT USING (
    workspace_id = sgtd_workspace_id() AND sgtd_puede_acceder_workspace(workspace_id)
  );
CREATE POLICY area_insert ON public.area
  FOR INSERT WITH CHECK (
    workspace_id = sgtd_workspace_id()
    AND (SELECT tipo FROM public.workspace WHERE id = workspace_id) = 'agencia'
    AND (sgtd_es_jefe() OR sgtd_es_org_admin((SELECT organizacion_id FROM public.workspace WHERE id = workspace_id)))
  );
CREATE POLICY area_update ON public.area
  FOR UPDATE USING (
    workspace_id = sgtd_workspace_id()
    AND (sgtd_es_jefe() OR sgtd_es_org_admin((SELECT organizacion_id FROM public.workspace WHERE id = workspace_id)))
  );
