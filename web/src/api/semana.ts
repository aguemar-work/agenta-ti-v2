import { getInsforge } from '@/lib/insforge';
import { parseEvento, parseTarea } from '@/lib/schemas';
import { resolveAsignadoA } from '@/lib/tareaAsignacion';
import { agregarDias, semanaIsoDesdeFecha } from '@/lib/semanas';
import type { Evento, Tarea, TipoEvento } from '@/types';

export async function getTareasSemana(usuarioId: string, semanaISO: string): Promise<Tarea[]> {
  const insforge = getInsforge();
  const { data, error } = await insforge.database
    .from('tarea')
    .select('*')
    .eq('asignado_a', usuarioId)
    .eq('tipo', 'planificada')
    .eq('semana_planificada', semanaISO)
    .order('fecha_planificada', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => parseTarea(r as Record<string, unknown>));
}

export async function getTareasLibres(usuarioId: string): Promise<Tarea[]> {
  const insforge = getInsforge();
  const { data, error } = await insforge.database
    .from('tarea')
    .select('*')
    .eq('asignado_a', usuarioId)
    .eq('tipo', 'libre')
    .order('prioridad', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => parseTarea(r as Record<string, unknown>));
}

function solapaSemana(ev: Evento, lunes: Date): boolean {
  const startWeek = new Date(lunes);
  startWeek.setHours(0, 0, 0, 0);
  const endWeek = agregarDias(lunes, 7);
  endWeek.setHours(0, 0, 0, 0);
  const a = new Date(ev.fecha_inicio).getTime();
  const b = new Date(ev.fecha_fin).getTime();
  return a < endWeek.getTime() && b > startWeek.getTime();
}

export async function getEventosSemana(usuarioId: string, lunes: Date): Promise<Evento[]> {
  const insforge = getInsforge();
  const startWeek = new Date(lunes);
  startWeek.setHours(0, 0, 0, 0);
  const endWeek = agregarDias(lunes, 7);
  endWeek.setHours(0, 0, 0, 0);
  const { data, error } = await insforge.database
    .from('evento')
    .select('*')
    .eq('usuario_id', usuarioId)
    .lt('fecha_inicio', endWeek.toISOString())
    .gt('fecha_fin', startWeek.toISOString());
  if (error) throw error;
  const list = (data ?? []).map((r) => parseEvento(r as Record<string, unknown>));
  return list.filter((e) => solapaSemana(e, lunes));
}

export type CrearTareaLibreInput = {
  titulo: string;
  prioridad: Tarea['prioridad'];
  descripcion?: string | null;
  asignado_a?: string | null;
  creado_por: string;
  objetivo_id?: string | null;
};

export async function crearTareaLibre(data: CrearTareaLibreInput): Promise<Tarea> {
  const insforge = getInsforge();
  const asignado = resolveAsignadoA(data.asignado_a, data.creado_por);
  const row = {
    titulo: data.titulo,
    descripcion: data.descripcion ?? null,
    prioridad: data.prioridad,
    estado: 'pendiente' as const,
    tipo: 'libre' as const,
    fecha_planificada: null,
    semana_planificada: null,
    asignado_a: asignado,
    creado_por: data.creado_por,
    objetivo_id: data.objetivo_id ?? null,
    es_imprevisto: false,
  };
  const { data: inserted, error } = await insforge.database.from('tarea').insert([row]).select('*').single();
  if (error) throw error;
  return parseTarea(inserted as Record<string, unknown>);
}

export type CrearTareaPlanificadaInput = {
  titulo: string;
  prioridad: Tarea['prioridad'];
  descripcion?: string | null;
  fecha_planificada: string;
  asignado_a?: string | null;
  creado_por: string;
  objetivo_id?: string | null;
};

export async function crearTareaPlanificada(data: CrearTareaPlanificadaInput): Promise<Tarea> {
  const insforge = getInsforge();
  const semana = semanaIsoDesdeFecha(new Date(`${data.fecha_planificada}T12:00:00`));
  const asignado = resolveAsignadoA(data.asignado_a, data.creado_por);
  const row = {
    titulo: data.titulo,
    descripcion: data.descripcion ?? null,
    prioridad: data.prioridad,
    estado: 'pendiente' as const,
    tipo: 'planificada' as const,
    fecha_planificada: data.fecha_planificada,
    semana_planificada: semana,
    asignado_a: asignado,
    creado_por: data.creado_por,
    objetivo_id: data.objetivo_id ?? null,
    es_imprevisto: false,
  };
  const { data: inserted, error } = await insforge.database.from('tarea').insert([row]).select('*').single();
  if (error) throw error;
  return parseTarea(inserted as Record<string, unknown>);
}

export async function moverTareaADia(tareaId: string, fecha: string, semana: string, tipo: Tarea['tipo']): Promise<void> {
  const insforge = getInsforge();
  const patch: Partial<Tarea> = { fecha_planificada: fecha, semana_planificada: semana };
  if (tipo === 'libre') patch.tipo = 'planificada';
  const { error } = await insforge.database.from('tarea').update(patch).eq('id', tareaId);
  if (error) throw error;
}

export async function moverTareaEntreDias(tareaId: string, nuevaFecha: string): Promise<void> {
  const semana = semanaIsoDesdeFecha(new Date(`${nuevaFecha}T12:00:00`));
  return moverTareaADia(tareaId, nuevaFecha, semana, 'planificada');
}

export async function moverTareaABacklog(tareaId: string): Promise<void> {
  const insforge = getInsforge();
  const { error } = await insforge.database
    .from('tarea')
    .update({ tipo: 'libre', fecha_planificada: null, semana_planificada: null })
    .eq('id', tareaId);
  if (error) throw error;
}

export type ActualizarTareaInput = {
  tareaId: string;
  titulo: string;
  prioridad: Tarea['prioridad'];
  descripcion?: string | null;
  objetivo_id?: string | null;
  asignado_a?: string | null;
};

export async function actualizarTarea(input: ActualizarTareaInput): Promise<void> {
  const insforge = getInsforge();
  const patch: Record<string, unknown> = {
    titulo: input.titulo.trim(),
    prioridad: input.prioridad,
    descripcion: input.descripcion ?? null,
    objetivo_id: input.objetivo_id ?? null,
  };
  if (input.asignado_a !== undefined) {
    patch.asignado_a =
      input.asignado_a === null || String(input.asignado_a).trim() === ''
        ? null
        : String(input.asignado_a).trim();
  }
  const { error } = await insforge.database.from('tarea').update(patch).eq('id', input.tareaId);
  if (error) throw error;
}

export type CrearEventoUsuarioInput = {
  titulo: string;
  tipo: TipoEvento;
  fecha_dia: string;
  hora_inicio: string;
  hora_fin: string;
  usuario_id: string;
  es_recurrente: boolean;
};

function toIsoLocal(fechaDia: string, hora: string): string {
  const [h, m] = hora.split(':').map(Number);
  const d = new Date(`${fechaDia}T00:00:00`);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toISOString();
}

export async function crearEventoUsuario(input: CrearEventoUsuarioInput): Promise<Evento> {
  const insforge = getInsforge();
  const row = {
    titulo: input.titulo.trim(),
    tipo: input.tipo,
    fecha_inicio: toIsoLocal(input.fecha_dia, input.hora_inicio),
    fecha_fin: toIsoLocal(input.fecha_dia, input.hora_fin),
    usuario_id: input.usuario_id,
    es_recurrente: input.es_recurrente,
  };
  const { data: inserted, error } = await insforge.database.from('evento').insert([row]).select('*').single();
  if (error) throw error;
  return parseEvento(inserted as Record<string, unknown>);
}

// =============================================================================
// Operaciones multi-paso — RPC atómica (transaccional en Postgres).
// Requiere: db/migrations/005_rpc_operaciones_atomicas.sql aplicado.
// =============================================================================

export async function eliminarTareaConMotivo(input: {
  tareaId: string;
  usuarioId: string;
  motivo: string;
}): Promise<void> {
  if (input.motivo.trim().length < 10) {
    throw new Error('Debes registrar un motivo de al menos 10 caracteres.');
  }
  const { error } = await getInsforge().database.rpc('sgtd_eliminar_tarea_con_motivo', {
    p_tarea_id: input.tareaId,
    p_usuario_id: input.usuarioId,
    p_motivo: input.motivo.trim(),
  });
  if (error) throw error;
}

export async function bloquearTareaConLog(input: {
  tareaId: string;
  usuarioId: string;
  justificacion: string;
}): Promise<void> {
  if (input.justificacion.trim().length < 10) {
    throw new Error('La justificación debe tener al menos 10 caracteres.');
  }
  const { error } = await getInsforge().database.rpc('sgtd_bloquear_tarea_con_log', {
    p_tarea_id: input.tareaId,
    p_usuario_id: input.usuarioId,
    p_justificacion: input.justificacion.trim(),
  });
  if (error) throw error;
}

export async function reprogramarTareaConLog(input: {
  tareaId: string;
  usuarioId: string;
  nuevaFecha: string;
  justificacion: string;
  nuevoEstado?: Tarea['estado'];
}): Promise<void> {
  const justificacion = input.justificacion.trim();
  if (justificacion.length < 10) {
    throw new Error('La justificación debe tener al menos 10 caracteres.');
  }
  const { error } = await getInsforge().database.rpc('sgtd_reprogramar_tarea_con_log', {
    p_tarea_id: input.tareaId,
    p_usuario_id: input.usuarioId,
    p_nueva_fecha: input.nuevaFecha,
    p_justificacion: justificacion,
    p_nuevo_estado: input.nuevoEstado ?? null,
  });
  if (error) throw error;
}

export async function desbloquearTareaConLog(input: {
  tareaId: string;
  usuarioId: string;
  nuevaFecha: string;
  justificacion: string;
}): Promise<void> {
  if (input.justificacion.trim().length < 10) {
    throw new Error('La justificación debe tener al menos 10 caracteres.');
  }
  const { error } = await getInsforge().database.rpc('sgtd_desbloquear_tarea_con_log', {
    p_tarea_id: input.tareaId,
    p_usuario_id: input.usuarioId,
    p_nueva_fecha: input.nuevaFecha,
    p_justificacion: input.justificacion.trim(),
  });
  if (error) throw error;
}