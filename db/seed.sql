-- =============================================================================
-- SGTD — datos de prueba (seed)
--
-- 1) Alta de usuarios SOLO vía app InsForge (auth.users + public.usuario).
-- 2) Ajusta manualmente el ROL en BD si hace falta: un jefe y dos miembros.
-- 3) Este script inserta objetivos/tareas/eventos/notas/log marcados 'SEED |'.
--
-- Si prefieres UUID fijos en lugar de subconsultas, reemplaza en tu entorno
-- (deben existir en auth.users / public.usuario):
--   :UUID_JEFE      = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
--   :UUID_MIEMBRO1 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
--   :UUID_MIEMBRO2 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
-- y convierte los SELECT de usuario en constantes.
-- =============================================================================

BEGIN;

DELETE FROM public.log_accion WHERE justificacion LIKE 'SEED |%';
DELETE FROM public.nota_bitacora WHERE contenido LIKE 'SEED |%';
DELETE FROM public.evento WHERE titulo LIKE 'SEED |%';
DELETE FROM public.tarea WHERE titulo LIKE 'SEED |%';
DELETE FROM public.objetivo WHERE titulo LIKE 'SEED |%';

INSERT INTO public.objetivo (id, titulo, descripcion, fecha_limite, estado, creado_por, responsable_id)
SELECT gen_random_uuid(), 'SEED | Reducir incidentes de despliegue', 'Objetivo operativo de prueba.', DATE '2026-12-20', 'activo', j.id, j.id
FROM (SELECT id FROM public.usuario WHERE rol = 'jefe' AND activo = true ORDER BY created_at LIMIT 1) j;

INSERT INTO public.objetivo (id, titulo, descripcion, fecha_limite, estado, creado_por, responsable_id)
SELECT gen_random_uuid(), 'SEED | Mejorar documentación interna', 'Segundo objetivo activo.', DATE '2026-11-15', 'activo', j.id, j.id
FROM (SELECT id FROM public.usuario WHERE rol = 'jefe' AND activo = true ORDER BY created_at LIMIT 1) j;

INSERT INTO public.tarea (titulo, descripcion, estado, tipo, prioridad, fecha_planificada, semana_planificada, fecha_completada, asignado_a, objetivo_id, creado_por, es_imprevisto)
SELECT 'SEED | Revisión de backups', 't1', 'pendiente', 'planificada', 'alta', DATE '2026-04-14', '202616', NULL,
       COALESCE((SELECT id FROM public.usuario WHERE rol = 'miembro' ORDER BY created_at LIMIT 1), (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1)),
       (SELECT id FROM public.objetivo WHERE titulo = 'SEED | Reducir incidentes de despliegue' LIMIT 1),
       (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1), false;

INSERT INTO public.tarea (titulo, descripcion, estado, tipo, prioridad, fecha_planificada, semana_planificada, fecha_completada, asignado_a, objetivo_id, creado_por, es_imprevisto)
SELECT 'SEED | Actualizar runbooks', NULL, 'en_progreso', 'planificada', 'media', DATE '2026-04-15', '202616', NULL,
       COALESCE((SELECT id FROM public.usuario WHERE rol = 'miembro' ORDER BY created_at LIMIT 1), (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1)),
       (SELECT id FROM public.objetivo WHERE titulo = 'SEED | Reducir incidentes de despliegue' LIMIT 1),
       (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1), false;

INSERT INTO public.tarea (titulo, descripcion, estado, tipo, prioridad, fecha_planificada, semana_planificada, fecha_completada, asignado_a, objetivo_id, creado_por, es_imprevisto)
SELECT 'SEED | Prueba de smoke QA', NULL, 'bloqueada', 'planificada', 'alta', DATE '2026-04-16', '202616', NULL,
       COALESCE((SELECT id FROM public.usuario WHERE rol = 'miembro' ORDER BY created_at LIMIT 1 OFFSET 1), (SELECT id FROM public.usuario WHERE rol = 'miembro' ORDER BY created_at LIMIT 1), (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1)),
       (SELECT id FROM public.objetivo WHERE titulo = 'SEED | Mejorar documentación interna' LIMIT 1),
       (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1), false;

INSERT INTO public.tarea (titulo, descripcion, estado, tipo, prioridad, fecha_planificada, semana_planificada, fecha_completada, asignado_a, objetivo_id, creado_por, es_imprevisto)
SELECT 'SEED | Cierre de sprint', NULL, 'completada', 'planificada', 'baja', DATE '2026-04-17', '202616', TIMESTAMPTZ '2026-04-17T10:00:00Z',
       COALESCE((SELECT id FROM public.usuario WHERE rol = 'miembro' ORDER BY created_at LIMIT 1), (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1)), NULL,
       (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1), false;

INSERT INTO public.tarea (titulo, descripcion, estado, tipo, prioridad, fecha_planificada, semana_planificada, fecha_completada, asignado_a, objetivo_id, creado_por, es_imprevisto)
SELECT 'SEED | Diseño wireframes', NULL, 'pendiente', 'planificada', 'media', DATE '2026-04-18', '202616', NULL,
       COALESCE((SELECT id FROM public.usuario WHERE rol = 'miembro' ORDER BY created_at LIMIT 1 OFFSET 1), (SELECT id FROM public.usuario WHERE rol = 'miembro' LIMIT 1), (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1)),
       (SELECT id FROM public.objetivo WHERE titulo = 'SEED | Mejorar documentación interna' LIMIT 1),
       (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1), false;

INSERT INTO public.tarea (titulo, descripcion, estado, tipo, prioridad, fecha_planificada, semana_planificada, fecha_completada, asignado_a, objetivo_id, creado_por, es_imprevisto)
SELECT 'SEED | Auditoría de accesos', NULL, 'pendiente', 'planificada', 'alta', DATE '2026-04-01', '202614', NULL,
       COALESCE((SELECT id FROM public.usuario WHERE rol = 'miembro' ORDER BY created_at LIMIT 1), (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1)),
       (SELECT id FROM public.objetivo WHERE titulo = 'SEED | Reducir incidentes de despliegue' LIMIT 1),
       (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1), false;

INSERT INTO public.tarea (titulo, descripcion, estado, tipo, prioridad, fecha_planificada, semana_planificada, fecha_completada, asignado_a, objetivo_id, creado_por, es_imprevisto)
SELECT 'SEED | Limpieza de logs legacy', NULL, 'en_progreso', 'planificada', 'media', DATE '2026-04-02', '202614', NULL,
       COALESCE((SELECT id FROM public.usuario WHERE rol = 'miembro' ORDER BY created_at LIMIT 1 OFFSET 1), (SELECT id FROM public.usuario WHERE rol = 'miembro' LIMIT 1), (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1)), NULL,
       (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1), false;

INSERT INTO public.tarea (titulo, descripcion, estado, tipo, prioridad, fecha_planificada, semana_planificada, fecha_completada, asignado_a, objetivo_id, creado_por, es_imprevisto)
SELECT 'SEED | Renovar certificados', NULL, 'bloqueada', 'planificada', 'alta', DATE '2026-04-03', '202614', NULL,
       COALESCE((SELECT id FROM public.usuario WHERE rol = 'miembro' ORDER BY created_at LIMIT 1), (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1)),
       (SELECT id FROM public.objetivo WHERE titulo = 'SEED | Reducir incidentes de despliegue' LIMIT 1),
       (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1), false;

INSERT INTO public.tarea (titulo, descripcion, estado, tipo, prioridad, fecha_planificada, semana_planificada, fecha_completada, asignado_a, objetivo_id, creado_por, es_imprevisto)
SELECT 'SEED | Informe semanal', NULL, 'atrasada', 'planificada', 'baja', DATE '2026-03-28', '202613', NULL,
       COALESCE((SELECT id FROM public.usuario WHERE rol = 'miembro' ORDER BY created_at LIMIT 1 OFFSET 1), (SELECT id FROM public.usuario WHERE rol = 'miembro' LIMIT 1), (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1)), NULL,
       (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1), false;

INSERT INTO public.tarea (titulo, descripcion, estado, tipo, prioridad, fecha_planificada, semana_planificada, fecha_completada, asignado_a, objetivo_id, creado_por, es_imprevisto)
SELECT 'SEED | Imprevisto: fallo de VPN', 'Registro automático', 'completada', 'no_planificada', 'media', DATE '2026-04-17', '202616', TIMESTAMPTZ '2026-04-17T08:00:00Z',
       COALESCE((SELECT id FROM public.usuario WHERE rol = 'miembro' ORDER BY created_at LIMIT 1), (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1)), NULL,
       (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1), true;

INSERT INTO public.tarea (titulo, descripcion, estado, tipo, prioridad, fecha_planificada, semana_planificada, fecha_completada, asignado_a, objetivo_id, creado_por, es_imprevisto)
SELECT 'SEED | Imprevisto: reunión urgente', NULL, 'completada', 'no_planificada', 'alta', DATE '2026-04-16', '202616', TIMESTAMPTZ '2026-04-16T18:00:00Z',
       COALESCE((SELECT id FROM public.usuario WHERE rol = 'miembro' ORDER BY created_at LIMIT 1 OFFSET 1), (SELECT id FROM public.usuario WHERE rol = 'miembro' LIMIT 1), (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1)), NULL,
       (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1), true;

INSERT INTO public.tarea (titulo, descripcion, estado, tipo, prioridad, fecha_planificada, semana_planificada, fecha_completada, asignado_a, objetivo_id, creado_por, es_imprevisto)
SELECT 'SEED | Investigar herramienta X', NULL, 'pendiente', 'libre', 'baja', NULL, NULL, NULL,
       COALESCE((SELECT id FROM public.usuario WHERE rol = 'miembro' ORDER BY created_at LIMIT 1), (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1)),
       (SELECT id FROM public.objetivo WHERE titulo = 'SEED | Reducir incidentes de despliegue' LIMIT 1),
       (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1), false;

INSERT INTO public.tarea (titulo, descripcion, estado, tipo, prioridad, fecha_planificada, semana_planificada, fecha_completada, asignado_a, objetivo_id, creado_por, es_imprevisto)
SELECT 'SEED | Refactor módulo auth', NULL, 'pendiente', 'libre', 'alta', NULL, NULL, NULL,
       COALESCE((SELECT id FROM public.usuario WHERE rol = 'miembro' ORDER BY created_at LIMIT 1 OFFSET 1), (SELECT id FROM public.usuario WHERE rol = 'miembro' LIMIT 1), (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1)), NULL,
       (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1), false;

INSERT INTO public.tarea (titulo, descripcion, estado, tipo, prioridad, fecha_planificada, semana_planificada, fecha_completada, asignado_a, objetivo_id, creado_por, es_imprevisto)
SELECT 'SEED | Idea: dashboard métricas', NULL, 'pendiente', 'libre', 'media', NULL, NULL, NULL,
       (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1), NULL,
       (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1), false;

INSERT INTO public.tarea (titulo, descripcion, estado, tipo, prioridad, fecha_planificada, semana_planificada, fecha_completada, asignado_a, objetivo_id, creado_por, es_imprevisto)
SELECT 'SEED | Pair programming', NULL, 'pendiente', 'planificada', 'media', DATE '2026-04-19', '202616', NULL,
       COALESCE((SELECT id FROM public.usuario WHERE rol = 'miembro' ORDER BY created_at LIMIT 1), (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1)), NULL,
       (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1), false;

INSERT INTO public.tarea (titulo, descripcion, estado, tipo, prioridad, fecha_planificada, semana_planificada, fecha_completada, asignado_a, objetivo_id, creado_por, es_imprevisto)
SELECT 'SEED | Code review PR #120', NULL, 'en_progreso', 'planificada', 'alta', DATE '2026-04-20', '202616', NULL,
       COALESCE((SELECT id FROM public.usuario WHERE rol = 'miembro' ORDER BY created_at LIMIT 1 OFFSET 1), (SELECT id FROM public.usuario WHERE rol = 'miembro' LIMIT 1), (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1)),
       (SELECT id FROM public.objetivo WHERE titulo = 'SEED | Reducir incidentes de despliegue' LIMIT 1),
       (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1), false;

INSERT INTO public.tarea (titulo, descripcion, estado, tipo, prioridad, fecha_planificada, semana_planificada, fecha_completada, asignado_a, objetivo_id, creado_por, es_imprevisto)
SELECT 'SEED | Deploy staging', NULL, 'completada', 'planificada', 'media', DATE '2026-04-12', '202615', TIMESTAMPTZ '2026-04-12T15:00:00Z',
       COALESCE((SELECT id FROM public.usuario WHERE rol = 'miembro' ORDER BY created_at LIMIT 1), (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1)),
       (SELECT id FROM public.objetivo WHERE titulo = 'SEED | Mejorar documentación interna' LIMIT 1),
       (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1), false;

INSERT INTO public.tarea (titulo, descripcion, estado, tipo, prioridad, fecha_planificada, semana_planificada, fecha_completada, asignado_a, objetivo_id, creado_por, es_imprevisto)
SELECT 'SEED | Monitoreo fin de semana', NULL, 'cancelada', 'planificada', 'baja', DATE '2026-04-05', '202614', NULL,
       COALESCE((SELECT id FROM public.usuario WHERE rol = 'miembro' ORDER BY created_at LIMIT 1 OFFSET 1), (SELECT id FROM public.usuario WHERE rol = 'miembro' LIMIT 1), (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1)), NULL,
       (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1), false;

INSERT INTO public.tarea (titulo, descripcion, estado, tipo, prioridad, fecha_planificada, semana_planificada, fecha_completada, asignado_a, objetivo_id, creado_por, es_imprevisto)
SELECT 'SEED | Capacitación seguridad', NULL, 'pendiente', 'planificada', 'alta', DATE '2026-04-21', '202616', NULL,
       (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1),
       (SELECT id FROM public.objetivo WHERE titulo = 'SEED | Mejorar documentación interna' LIMIT 1),
       (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1), false;

INSERT INTO public.evento (titulo, tipo, fecha_inicio, fecha_fin, usuario_id, es_recurrente)
SELECT 'SEED | Daily equipo', 'reunion', TIMESTAMPTZ '2026-04-18T09:00:00Z', TIMESTAMPTZ '2026-04-18T09:30:00Z', u.id, false
FROM (SELECT id FROM public.usuario WHERE activo = true ORDER BY created_at LIMIT 1) u;

INSERT INTO public.evento (titulo, tipo, fecha_inicio, fecha_fin, usuario_id, es_recurrente)
SELECT 'SEED | Entrega informe', 'entrega', TIMESTAMPTZ '2026-04-19T14:00:00Z', TIMESTAMPTZ '2026-04-19T15:00:00Z', u.id, false
FROM (SELECT id FROM public.usuario WHERE rol = 'miembro' ORDER BY created_at LIMIT 1 OFFSET 0) u;

INSERT INTO public.evento (titulo, tipo, fecha_inicio, fecha_fin, usuario_id, es_recurrente)
SELECT 'SEED | Bloque concentración', 'personal', TIMESTAMPTZ '2026-04-20T08:00:00Z', TIMESTAMPTZ '2026-04-20T12:00:00Z', u.id, false
FROM (SELECT id FROM public.usuario WHERE rol = 'miembro' ORDER BY created_at LIMIT 1 OFFSET 1) u;

INSERT INTO public.evento (titulo, tipo, fecha_inicio, fecha_fin, usuario_id, es_recurrente)
SELECT 'SEED | Revisión con proveedor', 'otro', TIMESTAMPTZ '2026-04-22T16:00:00Z', TIMESTAMPTZ '2026-04-22T17:00:00Z', u.id, false
FROM (SELECT id FROM public.usuario WHERE rol = 'jefe' LIMIT 1) u;

INSERT INTO public.nota_bitacora (contenido, usuario_id, objetivo_id, visibilidad)
SELECT 'SEED | Avance en despliegues: sin incidencias.', u.id, o.id, 'todos'
FROM (SELECT id FROM public.usuario WHERE rol = 'miembro' ORDER BY created_at LIMIT 1) u,
     (SELECT id FROM public.objetivo WHERE titulo LIKE 'SEED |%' ORDER BY created_at LIMIT 1) o;

INSERT INTO public.nota_bitacora (contenido, usuario_id, objetivo_id, visibilidad)
SELECT 'SEED | Riesgo: dependencia externa bloqueada.', u.id, NULL, 'solo_jefe'
FROM (SELECT id FROM public.usuario WHERE rol = 'miembro' ORDER BY created_at LIMIT 1 OFFSET 1) u;

INSERT INTO public.nota_bitacora (contenido, usuario_id, objetivo_id, visibilidad)
SELECT 'SEED | Nota privada de seguimiento personal.', u.id, NULL, 'privado'
FROM (SELECT id FROM public.usuario ORDER BY created_at LIMIT 1) u;

INSERT INTO public.log_accion (tarea_id, usuario_id, tipo_accion, valor_anterior, valor_nuevo, justificacion, leido_por_jefe)
SELECT t.id, t.creado_por, 'reprogramada', '{"fecha_planificada":"2026-04-01"}'::jsonb, '{"fecha_planificada":"2026-04-10"}'::jsonb, 'SEED | Replanificación por cambio de prioridad.', false
FROM public.tarea t WHERE t.titulo = 'SEED | Auditoría de accesos' LIMIT 1;

INSERT INTO public.log_accion (tarea_id, usuario_id, tipo_accion, valor_anterior, valor_nuevo, justificacion, leido_por_jefe)
SELECT t.id, t.creado_por, 'cancelada', '{"estado":"pendiente"}'::jsonb, '{"estado":"cancelada"}'::jsonb, 'SEED | Objetivo dejó de aplicar.', false
FROM public.tarea t WHERE t.titulo = 'SEED | Monitoreo fin de semana' LIMIT 1;

COMMIT;
