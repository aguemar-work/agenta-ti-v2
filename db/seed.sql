-- =============================================================================
-- SGTD — Datos de prueba (seed v2)
-- seed.sql
--
-- Cambios respecto a seed v1:
--   - Eliminadas 3 tareas con tipo='libre' → convertidas a nota_bitacora
--   - Incidencias ahora muestran ambos estados (completada Y pendiente)
--   - Agrega ejemplos con nota_origen_id y log completo
--   - OTs de ejemplo con prioridad y log_ot
--
-- Uso:
--   Dashboard InsForge → SQL Editor → Run
--   Requiere al menos 1 jefe y 1 miembro en public.usuario
-- =============================================================================

BEGIN;

-- Limpiar seed previo
DELETE FROM public.log_ot        WHERE ot_id IN (SELECT id FROM public.orden_trabajo WHERE descripcion LIKE 'SEED |%');
DELETE FROM public.orden_trabajo  WHERE descripcion LIKE 'SEED |%';
DELETE FROM public.log_accion     WHERE justificacion LIKE 'SEED |%';
DELETE FROM public.nota_bitacora  WHERE contenido LIKE 'SEED |%';
DELETE FROM public.evento         WHERE titulo LIKE 'SEED |%';
DELETE FROM public.tarea          WHERE titulo LIKE 'SEED |%';
DELETE FROM public.objetivo       WHERE titulo LIKE 'SEED |%';

-- ── OBJETIVOS ─────────────────────────────────────────────────────────────────

INSERT INTO public.objetivo (id, titulo, descripcion, fecha_limite, estado, creado_por, responsable_id)
SELECT gen_random_uuid(),
       'SEED | Reducir incidentes de despliegue',
       'Objetivo operativo de prueba.',
       DATE '2026-12-20', 'activo', j.id, j.id
FROM (SELECT id FROM public.usuario WHERE rol = 'jefe' AND activo = true ORDER BY created_at LIMIT 1) j;

INSERT INTO public.objetivo (id, titulo, descripcion, fecha_limite, estado, creado_por, responsable_id)
SELECT gen_random_uuid(),
       'SEED | Mejorar documentación interna',
       'Segundo objetivo activo.',
       DATE '2026-06-15', 'activo', j.id, j.id
FROM (SELECT id FROM public.usuario WHERE rol = 'jefe' AND activo = true ORDER BY created_at LIMIT 1) j;

-- ── TAREAS PLANIFICADAS ────────────────────────────────────────────────────────

INSERT INTO public.tarea (titulo, descripcion, estado, tipo, prioridad, fecha_planificada, semana_planificada, fecha_completada, asignado_a, objetivo_id, creado_por, es_imprevisto)
SELECT 'SEED | Revisión de backups', 'Verificar integridad de copias.',
       'pendiente', 'planificada', 'alta',
       CURRENT_DATE + 1, to_char(CURRENT_DATE + 1, 'IYYY') || lpad(to_char(CURRENT_DATE + 1, 'IW'), 2, '0'), NULL,
       COALESCE((SELECT id FROM public.usuario WHERE rol='miembro' ORDER BY created_at LIMIT 1),
                (SELECT id FROM public.usuario WHERE rol='jefe' LIMIT 1)),
       (SELECT id FROM public.objetivo WHERE titulo='SEED | Reducir incidentes de despliegue' LIMIT 1),
       (SELECT id FROM public.usuario WHERE rol='jefe' LIMIT 1), false;

INSERT INTO public.tarea (titulo, descripcion, estado, tipo, prioridad, fecha_planificada, semana_planificada, fecha_completada, asignado_a, objetivo_id, creado_por, es_imprevisto)
SELECT 'SEED | Actualizar runbooks', NULL,
       'en_progreso', 'planificada', 'media',
       CURRENT_DATE, to_char(CURRENT_DATE, 'IYYY') || lpad(to_char(CURRENT_DATE, 'IW'), 2, '0'), NULL,
       COALESCE((SELECT id FROM public.usuario WHERE rol='miembro' ORDER BY created_at LIMIT 1),
                (SELECT id FROM public.usuario WHERE rol='jefe' LIMIT 1)),
       (SELECT id FROM public.objetivo WHERE titulo='SEED | Reducir incidentes de despliegue' LIMIT 1),
       (SELECT id FROM public.usuario WHERE rol='jefe' LIMIT 1), false;

INSERT INTO public.tarea (titulo, descripcion, estado, tipo, prioridad, fecha_planificada, semana_planificada, fecha_completada, asignado_a, objetivo_id, creado_por, es_imprevisto)
SELECT 'SEED | Prueba de smoke QA', NULL,
       'bloqueada', 'planificada', 'alta',
       CURRENT_DATE, to_char(CURRENT_DATE, 'IYYY') || lpad(to_char(CURRENT_DATE, 'IW'), 2, '0'), NULL,
       COALESCE((SELECT id FROM public.usuario WHERE rol='miembro' ORDER BY created_at LIMIT 1 OFFSET 1),
                (SELECT id FROM public.usuario WHERE rol='miembro' ORDER BY created_at LIMIT 1),
                (SELECT id FROM public.usuario WHERE rol='jefe' LIMIT 1)),
       (SELECT id FROM public.objetivo WHERE titulo='SEED | Mejorar documentación interna' LIMIT 1),
       (SELECT id FROM public.usuario WHERE rol='jefe' LIMIT 1), false;

INSERT INTO public.tarea (titulo, descripcion, estado, tipo, prioridad, fecha_planificada, semana_planificada, fecha_completada, asignado_a, objetivo_id, creado_por, es_imprevisto)
SELECT 'SEED | Cierre de sprint', NULL,
       'completada', 'planificada', 'baja',
       CURRENT_DATE - 1,
       to_char(CURRENT_DATE - 1, 'IYYY') || lpad(to_char(CURRENT_DATE - 1, 'IW'), 2, '0'),
       now() - interval '2 hours',
       COALESCE((SELECT id FROM public.usuario WHERE rol='miembro' ORDER BY created_at LIMIT 1),
                (SELECT id FROM public.usuario WHERE rol='jefe' LIMIT 1)),
       NULL,
       (SELECT id FROM public.usuario WHERE rol='jefe' LIMIT 1), false;

-- Tarea atrasada (fecha en el pasado, estado pendiente → trigger la marcará atrasada)
INSERT INTO public.tarea (titulo, descripcion, estado, tipo, prioridad, fecha_planificada, semana_planificada, fecha_completada, asignado_a, objetivo_id, creado_por, es_imprevisto)
SELECT 'SEED | Auditoría de accesos', NULL,
       'pendiente', 'planificada', 'alta',
       CURRENT_DATE - 7,
       to_char(CURRENT_DATE - 7, 'IYYY') || lpad(to_char(CURRENT_DATE - 7, 'IW'), 2, '0'), NULL,
       COALESCE((SELECT id FROM public.usuario WHERE rol='miembro' ORDER BY created_at LIMIT 1),
                (SELECT id FROM public.usuario WHERE rol='jefe' LIMIT 1)),
       (SELECT id FROM public.objetivo WHERE titulo='SEED | Reducir incidentes de despliegue' LIMIT 1),
       (SELECT id FROM public.usuario WHERE rol='jefe' LIMIT 1), false;

INSERT INTO public.tarea (titulo, descripcion, estado, tipo, prioridad, fecha_planificada, semana_planificada, fecha_completada, asignado_a, objetivo_id, creado_por, es_imprevisto)
SELECT 'SEED | Cancelada de ejemplo', NULL,
       'cancelada', 'planificada', 'baja',
       CURRENT_DATE - 3,
       to_char(CURRENT_DATE - 3, 'IYYY') || lpad(to_char(CURRENT_DATE - 3, 'IW'), 2, '0'), NULL,
       COALESCE((SELECT id FROM public.usuario WHERE rol='miembro' ORDER BY created_at LIMIT 1 OFFSET 1),
                (SELECT id FROM public.usuario WHERE rol='miembro' ORDER BY created_at LIMIT 1),
                (SELECT id FROM public.usuario WHERE rol='jefe' LIMIT 1)),
       NULL,
       (SELECT id FROM public.usuario WHERE rol='jefe' LIMIT 1), false;

-- ── INCIDENCIAS — CASO A: ya resuelta (completada) ───────────────────────────

INSERT INTO public.tarea (titulo, descripcion, estado, tipo, prioridad, fecha_planificada, semana_planificada, fecha_completada, asignado_a, objetivo_id, creado_por, es_imprevisto)
SELECT 'SEED | Incidencia: fallo de VPN', 'Usuario reportó caída de VPN. Se restableció el servicio.',
       'completada', 'no_planificada', 'alta',
       CURRENT_DATE,
       to_char(CURRENT_DATE, 'IYYY') || lpad(to_char(CURRENT_DATE, 'IW'), 2, '0'),
       now() - interval '1 hour',
       COALESCE((SELECT id FROM public.usuario WHERE rol='miembro' ORDER BY created_at LIMIT 1),
                (SELECT id FROM public.usuario WHERE rol='jefe' LIMIT 1)),
       NULL,
       (SELECT id FROM public.usuario WHERE rol='jefe' LIMIT 1), true;

-- ── INCIDENCIAS — CASO B: pendiente de atender ────────────────────────────────

INSERT INTO public.tarea (titulo, descripcion, estado, tipo, prioridad, fecha_planificada, semana_planificada, fecha_completada, asignado_a, objetivo_id, creado_por, es_imprevisto)
SELECT 'SEED | Incidencia: sin tinta impresora', 'Impresora de RR.HH. sin tinta. Pendiente de compra.',
       'pendiente', 'no_planificada', 'baja',
       CURRENT_DATE,
       to_char(CURRENT_DATE, 'IYYY') || lpad(to_char(CURRENT_DATE, 'IW'), 2, '0'),
       NULL,
       COALESCE((SELECT id FROM public.usuario WHERE rol='miembro' ORDER BY created_at LIMIT 1),
                (SELECT id FROM public.usuario WHERE rol='jefe' LIMIT 1)),
       NULL,
       (SELECT id FROM public.usuario WHERE rol='jefe' LIMIT 1), true;

-- ── NOTAS DE BITÁCORA ─────────────────────────────────────────────────────────

-- Nota que quedará como nota (sin convertir)
INSERT INTO public.nota_bitacora (contenido, usuario_id, objetivo_id, visibilidad)
SELECT 'SEED | Avance en despliegues sin incidencias esta semana.', u.id, o.id, 'todos'
FROM (SELECT id FROM public.usuario WHERE rol='miembro' ORDER BY created_at LIMIT 1) u,
     (SELECT id FROM public.objetivo WHERE titulo LIKE 'SEED |%' ORDER BY created_at LIMIT 1) o;

-- Nota solo para jefe
INSERT INTO public.nota_bitacora (contenido, usuario_id, objetivo_id, visibilidad)
SELECT 'SEED | Riesgo: dependencia externa bloqueada por proveedor.', u.id, NULL, 'solo_jefe'
FROM (SELECT id FROM public.usuario WHERE rol='miembro' ORDER BY created_at LIMIT 1 OFFSET 1) u
WHERE EXISTS (SELECT 1 FROM public.usuario WHERE rol='miembro' LIMIT 1 OFFSET 1);

-- Ideas que antes eran tareas 'libre' — ahora viven en bitácora
INSERT INTO public.nota_bitacora (contenido, usuario_id, objetivo_id, visibilidad)
SELECT 'SEED | Idea: investigar herramienta X para monitoreo de red.', u.id, NULL, 'privado'
FROM (SELECT id FROM public.usuario WHERE rol='jefe' ORDER BY created_at LIMIT 1) u;

INSERT INTO public.nota_bitacora (contenido, usuario_id, objetivo_id, visibilidad)
SELECT 'SEED | Idea: refactorizar módulo de autenticación cuando haya tiempo.', u.id, NULL, 'privado'
FROM (SELECT id FROM public.usuario WHERE rol='jefe' ORDER BY created_at LIMIT 1) u;

INSERT INTO public.nota_bitacora (contenido, usuario_id, objetivo_id, visibilidad)
SELECT 'SEED | Idea: armar dashboard de métricas para la reunión mensual.', u.id, NULL, 'privado'
FROM (SELECT id FROM public.usuario WHERE rol='jefe' ORDER BY created_at LIMIT 1) u;

-- ── EVENTOS ───────────────────────────────────────────────────────────────────

INSERT INTO public.evento (titulo, tipo, fecha_inicio, fecha_fin, usuario_id, es_recurrente)
SELECT 'SEED | Daily equipo',
       'reunion',
       (CURRENT_DATE + 1)::timestamptz + interval '9 hours',
       (CURRENT_DATE + 1)::timestamptz + interval '9 hours 30 minutes',
       u.id, false
FROM (SELECT id FROM public.usuario WHERE activo=true ORDER BY created_at LIMIT 1) u;

INSERT INTO public.evento (titulo, tipo, fecha_inicio, fecha_fin, usuario_id, es_recurrente)
SELECT 'SEED | Entrega informe mensual',
       'entrega',
       (CURRENT_DATE + 2)::timestamptz + interval '14 hours',
       (CURRENT_DATE + 2)::timestamptz + interval '15 hours',
       u.id, false
FROM (SELECT id FROM public.usuario WHERE rol='miembro' ORDER BY created_at LIMIT 1) u;

-- ── LOG DE ACCIONES ───────────────────────────────────────────────────────────

INSERT INTO public.log_accion (tarea_id, usuario_id, tipo_accion, valor_anterior, valor_nuevo, justificacion, leido_por_jefe)
SELECT t.id, t.creado_por,
       'reprogramada',
       '{"fecha_planificada": "hace una semana"}'::jsonb,
       jsonb_build_object('fecha_planificada', CURRENT_DATE - 7),
       'SEED | Replanificación por cambio de prioridad del cliente.',
       false
FROM public.tarea t WHERE t.titulo = 'SEED | Auditoría de accesos' LIMIT 1;

INSERT INTO public.log_accion (tarea_id, usuario_id, tipo_accion, valor_anterior, valor_nuevo, justificacion, leido_por_jefe)
SELECT t.id, t.creado_por,
       'cancelada',
       '{"estado": "pendiente"}'::jsonb,
       '{"estado": "cancelada"}'::jsonb,
       'SEED | Objetivo cambió de alcance, tarea ya no aplica.',
       false
FROM public.tarea t WHERE t.titulo = 'SEED | Cancelada de ejemplo' LIMIT 1;

COMMIT;