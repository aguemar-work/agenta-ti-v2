/**
 * api/semana.ts
 * Capa de acceso a datos para la vista Mi Semana y operaciones de tarea.
 */

import { getInsforge } from '@/lib/insforge';
import { getWorkspaceId } from '@/store/workspaceStore';
import { MIN_JUSTIFICACION_CHARS, MSG_JUSTIFICACION_CORTA } from '@/lib/constants';
import { publicarEventoEquipo } from '@/lib/realtimePublish';
import { parseEvento, parseTarea } from '@/lib/schemas';
import { resolveAsignadoA } from '@/lib/tareaAsignacion';
import { TAREA_ACTIVA } from '@/lib/tareaTables';
import { agregarDias, semanaIsoDesdeFecha } from '@/lib/semanas';
import type { Evento, EstadoTarea, Tarea, TipoEvento } from '@/types';

export async function getTareasSemana(usuarioId: string, semanaISO: string): Promise<Tarea[]> {
  const insforge = getInsforge();

  // Semana actual + tareas atrasadas de semanas anteriores (situación calculada).
  const { data, error } = await insforge.database
    .from(TAREA_ACTIVA)
    .select('*')
    .eq('asignado_a', usuarioId)
    .eq('tipo', 'planificada')
    .or(`semana_planificada.eq.${semanaISO},situacion.eq.atrasada`)
    .order('fecha_planificada', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => parseTarea(r as Record<string, unknown>));
}

function solapaSemana(ev: Evento, lunes: Date): boolean {
  const startWeek = new Date(lunes); startWeek.setHours(0, 0, 0, 0);
  const endWeek   = agregarDias(lunes, 7); endWeek.setHours(0, 0, 0, 0);
  const a = new Date(ev.fecha_inicio).getTime();
  const b = new Date(ev.fecha_fin).getTime();
  return a < endWeek.getTime() && b > startWeek.getTime();
}

export async function getEventosSemana(usuarioId: string, lunes: Date): Promise<Evento[]> {
  const insforge = getInsforge();
  const startWeek = new Date(lunes); startWeek.setHours(0, 0, 0, 0);
  const endWeek   = agregarDias(lunes, 7); endWeek.setHours(0, 0, 0, 0);
  const { data, error } = await insforge.database
    .from('evento')
    .select('*')
    .eq('usuario_id', usuarioId)
    .lt('fecha_inicio', endWeek.toISOString())
    .gt('fecha_fin', startWeek.toISOString());
  if (error) throw error;
  return (data ?? []).map((r) => parseEvento(r as Record<string, unknown>))
    .filter((e) => solapaSemana(e, lunes));
}

export type CrearTareaPlanificadaInput = {
  titulo:             string;
  prioridad:          Tarea['prioridad'];
  descripcion?:       string | null;
  fecha_planificada:  string;
  asignado_a?:        string | null;
  creado_por:         string;
  objetivo_id?:       string | null;
  /** UUID de la nota de bitácora que originó esta tarea (opcional). */
  nota_origen_id?:    string | null;
  cliente_id?:        string | null;
  proyecto_id?:       string | null;
  area_id?:           string | null;
};

/** Punto de escritura canónico para tareas planificadas (Mi Semana, Planificación, conversión de notas). */
export async function crearTareaPlanificada(data: CrearTareaPlanificadaInput): Promise<Tarea> {
  const insforge = getInsforge();
  const semana   = semanaIsoDesdeFecha(new Date(`${data.fecha_planificada}T12:00:00`));
  const asignado = resolveAsignadoA(data.asignado_a, data.creado_por);
  const { data: rows, error } = await insforge.database
    .rpc('sgtd_crear_tarea_planificada', {
      p_titulo:             data.titulo.trim(),
      p_descripcion:        data.descripcion ?? null,
      p_prioridad:          data.prioridad,
      p_fecha_planificada:  data.fecha_planificada,
      p_semana_planificada: semana,
      p_asignado_a:         asignado ?? null,
      p_creado_por:         data.creado_por ?? null,
      p_objetivo_id:        data.objetivo_id ?? null,
      p_nota_origen_id:     data.nota_origen_id ?? null,
      p_es_imprevisto:      false,
      p_cliente_id:         data.cliente_id ?? null,
      p_proyecto_id:        data.proyecto_id ?? null,
      p_area_id:            data.area_id ?? null,
    });
  if (error) throw error;
  const inserted = Array.isArray(rows) ? rows[0] : rows;
  return parseTarea(inserted as Record<string, unknown>);
}

export async function moverTareaADia(tareaId: string, fecha: string, semana: string): Promise<void> {
  const { error } = await getInsforge().database.rpc('sgtd_mover_tarea_dia', {
    p_tarea_id: tareaId,
    p_fecha:    fecha,
    p_semana:   semana,
  });
  if (error) throw error;
}

export async function moverTareaEntreDias(tareaId: string, nuevaFecha: string): Promise<void> {
  const semana = semanaIsoDesdeFecha(new Date(`${nuevaFecha}T12:00:00`));
  return moverTareaADia(tareaId, nuevaFecha, semana);
}

export type ActualizarTareaInput = {
  tareaId:        string;
  usuarioActorId: string;
  titulo:         string;
  prioridad:      Tarea['prioridad'];
  descripcion?:   string | null;
  objetivo_id?:   string | null;
  asignado_a?:    string | null;
  cliente_id?:    string | null;
  proyecto_id?:   string | null;
  area_id?:       string | null;
};

export async function actualizarTarea(input: ActualizarTareaInput): Promise<void> {
  const { error } = await getInsforge().database.rpc('sgtd_actualizar_tarea', {
    p_tarea_id:    input.tareaId,
    p_usuario_id:  input.usuarioActorId,
    p_titulo:      input.titulo.trim(),
    p_prioridad:   input.prioridad,
    p_descripcion: input.descripcion ?? null,
    p_objetivo_id: input.objetivo_id ?? null,
    p_asignado_a:  input.asignado_a ?? null,
    p_cliente_id:  input.cliente_id ?? null,
    p_proyecto_id: input.proyecto_id ?? null,
    p_area_id:     input.area_id ?? null,
  });
  if (error) throw error;
}

/**
 * Cambia el estado de una tarea vía RPC sgtd_cambiar_estado_tarea.
 * El log se registra automáticamente en el servidor.
 *
 * Estado que requiere justificación: 'cancelada'
 */
export async function cambiarEstadoTarea(input: {
  tareaId:        string;
  nuevoEstado:    EstadoTarea;
  justificacion?: string;
}): Promise<void> {
  const requiereJustificacion = input.nuevoEstado === 'cancelada';

  if (requiereJustificacion) {
    const j = (input.justificacion ?? '').trim();
    if (j.length < MIN_JUSTIFICACION_CHARS) throw new Error(MSG_JUSTIFICACION_CORTA);
  }

  const { error } = await getInsforge().database.rpc('sgtd_cambiar_estado_tarea', {
    p_tarea_id:      input.tareaId,
    p_nuevo_estado:  input.nuevoEstado,
    p_justificacion: input.justificacion?.trim() ?? null,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Alias hacia las RPCs existentes (sin cambios de firma)
// ---------------------------------------------------------------------------

export async function eliminarTareaConMotivo(input: {
  tareaId:   string;
  usuarioId: string;
  motivo:    string;
}): Promise<void> {
  if (input.motivo.trim().length < MIN_JUSTIFICACION_CHARS) throw new Error(MSG_JUSTIFICACION_CORTA);
  const { error } = await getInsforge().database.rpc('sgtd_eliminar_tarea_con_motivo', {
    p_tarea_id:   input.tareaId,
    p_usuario_id: input.usuarioId,
    p_motivo:     input.motivo.trim(),
  });
  if (error) throw error;
}

export async function reprogramarTareaConLog(input: {
  tareaId:       string;
  usuarioId:     string;
  nuevaFecha:    string;
  justificacion: string;
}): Promise<void> {
  const j = input.justificacion.trim();
  if (j.length < MIN_JUSTIFICACION_CHARS) throw new Error(MSG_JUSTIFICACION_CORTA);
  const { error } = await getInsforge().database.rpc('sgtd_reprogramar_tarea_con_log', {
    p_tarea_id:     input.tareaId,
    p_usuario_id:   input.usuarioId,
    p_nueva_fecha:  input.nuevaFecha,
    p_justificacion: j,
    p_nuevo_estado: null,
  });
  if (error) throw error;
}

/** Completa tarea en progreso con resumen (RPC atómica; cancela OTs abiertas vinculadas). */
export async function completarTareaConResumen(input: {
  tareaId:        string;
  usuarioId:      string;
  resumen:        string;
  usuarioNombre?: string;
  tareaTitulo?:   string;
  jefeId?:        string;
  jefeIds?:       string[];
}): Promise<void> {
  const { error } = await getInsforge().database.rpc('sgtd_completar_tarea_con_resumen', {
    p_tarea_id:   input.tareaId,
    p_usuario_id: input.usuarioId,
    p_resumen:    input.resumen.trim(),
  });
  if (error) throw error;

  const jefeIds = input.jefeIds ?? (input.jefeId ? [input.jefeId] : []);
  if (jefeIds.length > 0) {
    const resumen = input.resumen.trim();
    void Promise.all(jefeIds.map((jefeId) =>
      publicarEventoEquipo({
        tipo:          'tarea_completada',
        jefeId,
        tareaId:       input.tareaId,
        titulo:        input.tareaTitulo ?? 'Tarea',
        usuarioNombre: input.usuarioNombre ?? 'Miembro',
        resumen,
      }),
    ));
  }
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

export type CrearEventoUsuarioInput = {
  titulo:        string;
  tipo:          TipoEvento;
  fecha_dia:     string;
  hora_inicio:   string;
  hora_fin:      string;
  usuario_id:    string;
  es_recurrente: boolean;
};

function toIsoLocal(fechaDia: string, hora: string): string {
  const [h, m] = hora.split(':').map(Number);
  const d = new Date(`${fechaDia}T00:00:00`);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toISOString();
}

export async function crearEventoUsuario(input: CrearEventoUsuarioInput): Promise<Evento> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) throw new Error('Sin workspace activo');

  const insforge = getInsforge();
  const { data: inserted, error } = await insforge.database
    .from('evento')
    .insert([{
      titulo:        input.titulo.trim(),
      tipo:          input.tipo,
      fecha_inicio:  toIsoLocal(input.fecha_dia, input.hora_inicio),
      fecha_fin:     toIsoLocal(input.fecha_dia, input.hora_fin),
      usuario_id:    input.usuario_id,
      es_recurrente: input.es_recurrente,
      workspace_id:  workspaceId,
    }])
    .select('*')
    .single();
  if (error) throw error;
  return parseEvento(inserted as Record<string, unknown>);
}

const prioridadOrden: Record<Tarea['prioridad'], number> = {
  critica: 0,
  alta: 1,
  media: 2,
  baja: 3,
};

/** Tareas planificadas del día + atrasadas (columna HOY / selector). */
export async function getTareasHoyUsuario(asignadoA: string, hoyYmd: string): Promise<Tarea[]> {
  const { data, error } = await getInsforge().database
    .from(TAREA_ACTIVA)
    .select('*')
    .eq('asignado_a', asignadoA)
    .eq('tipo', 'planificada')
    .or(`fecha_planificada.eq.${hoyYmd},situacion.eq.atrasada`);
  if (error) throw error;
  const list = (data ?? []).map((r) => parseTarea(r as Record<string, unknown>));
  list.sort((a, b) => prioridadOrden[a.prioridad] - prioridadOrden[b.prioridad]);
  return list;
}

/** Backfill masivo de situación atrasada (throttle en hook). */
export async function marcarAtrasadasEquipo(): Promise<void> {
  const { error } = await getInsforge().database.rpc('sgtd_marcar_atrasadas_equipo');
  if (error) throw error;
}