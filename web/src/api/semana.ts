import { getInsforge } from '@/lib/insforge';
import { resolveAsignadoA } from '@/lib/tareaAsignacion';
import { agregarDias } from '@/lib/semanas';
import { semanaIsoDesdeFecha } from '@/lib/semanas';
import type { Evento, Tarea, TipoEvento } from '@/types';

function parseTarea(row: Record<string, unknown>): Tarea {
  return row as unknown as Tarea;
}

function parseEvento(row: Record<string, unknown>): Evento {
  return row as unknown as Evento;
}

/** Tareas planificadas de la semana ISO indicada. */
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

/** Eventos del usuario que solapan el rango [lunes, domingo] (local). */
export async function getEventosSemana(usuarioId: string, lunes: Date): Promise<Evento[]> {
  const insforge = getInsforge();
  const desde = agregarDias(lunes, -14);
  const hasta = agregarDias(lunes, 21);
  const { data, error } = await insforge.database
    .from('evento')
    .select('*')
    .eq('usuario_id', usuarioId)
    .gte('fecha_inicio', desde.toISOString())
    .lte('fecha_inicio', hasta.toISOString());
  if (error) throw error;
  const list = (data ?? []).map((r) => parseEvento(r as Record<string, unknown>));
  return list.filter((e) => solapaSemana(e, lunes));
}

export type CrearTareaLibreInput = {
  titulo: string;
  prioridad: Tarea['prioridad'];
  descripcion?: string | null;
  /** Si viene vacío o null, se usa `creado_por`. */
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
  /** Si viene vacío o null, se usa `creado_por`. */
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

export async function moverTareaADia(
  tareaId: string,
  fecha: string,
  semana: string,
  tipo: Tarea['tipo'],
): Promise<void> {
  const insforge = getInsforge();
  const patch: Partial<Tarea> = {
    fecha_planificada: fecha,
    semana_planificada: semana,
  };
  if (tipo === 'libre') {
    patch.tipo = 'planificada';
  }
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
    .update({
      tipo: 'libre',
      fecha_planificada: null,
      semana_planificada: null,
    })
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
  if (input.asignado_a !== undefined && input.asignado_a !== null && input.asignado_a.trim().length > 0) {
    patch.asignado_a = input.asignado_a.trim();
  }
  const { error } = await insforge.database.from('tarea').update(patch).eq('id', input.tareaId);
  if (error) throw error;
}

export type CrearEventoUsuarioInput = {
  titulo: string;
  tipo: TipoEvento;
  /** `YYYY-MM-DD` día local */
  fecha_dia: string;
  /** `HH:mm` */
  hora_inicio: string;
  /** `HH:mm` */
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
  const fecha_inicio = toIsoLocal(input.fecha_dia, input.hora_inicio);
  const fecha_fin = toIsoLocal(input.fecha_dia, input.hora_fin);
  const row = {
    titulo: input.titulo.trim(),
    tipo: input.tipo,
    fecha_inicio,
    fecha_fin,
    usuario_id: input.usuario_id,
    es_recurrente: input.es_recurrente,
  };
  const { data: inserted, error } = await insforge.database.from('evento').insert([row]).select('*').single();
  if (error) throw error;
  return parseEvento(inserted as Record<string, unknown>);
}

export async function eliminarTareaConMotivo(input: {
  tareaId: string;
  usuarioId: string;
  motivo: string;
}): Promise<void> {
  const insforge = getInsforge();
  const motivo = input.motivo.trim();
  if (motivo.length < 10) {
    throw new Error('Debes registrar un motivo de al menos 10 caracteres.');
  }

  const { error: eLog } = await insforge.database.from('log_accion').insert([
    {
      tarea_id: input.tareaId,
      usuario_id: input.usuarioId,
      tipo_accion: 'eliminada',
      valor_anterior: null,
      valor_nuevo: null,
      justificacion: motivo,
    },
  ]);
  if (eLog) throw eLog;

  const { error: eDel } = await insforge.database.from('tarea').delete().eq('id', input.tareaId);
  if (eDel) throw eDel;
}

export async function bloquearTareaConLog(input: {
  tareaId: string;
  usuarioId: string;
  justificacion: string;
}): Promise<void> {
  const insforge = getInsforge();
  const just = input.justificacion.trim();
  if (just.length < 10) {
    throw new Error('La justificación debe tener al menos 10 caracteres.');
  }
  const { error: e1 } = await insforge.database
    .from('tarea')
    .update({ estado: 'bloqueada' })
    .eq('id', input.tareaId);
  if (e1) throw e1;
  const { error: e2 } = await insforge.database.from('log_accion').insert([
    {
      tarea_id: input.tareaId,
      usuario_id: input.usuarioId,
      tipo_accion: 'editada',
      valor_anterior: null,
      valor_nuevo: { estado: 'bloqueada' },
      justificacion: just,
      leido_por_jefe: false,
    },
  ]);
  if (e2) throw e2;
}

export async function reprogramarTareaConLog(input: {
  tareaId: string;
  usuarioId: string;
  nuevaFecha: string;
  justificacion: string;
  nuevoEstado?: Tarea['estado'];
}): Promise<void> {
  const insforge = getInsforge();
  const semana = semanaIsoDesdeFecha(new Date(`${input.nuevaFecha}T12:00:00`));
  const patch: Record<string, unknown> = {
    fecha_planificada: input.nuevaFecha,
    semana_planificada: semana,
  };
  if (input.nuevoEstado) patch.estado = input.nuevoEstado;

  const { error: e1 } = await insforge.database.from('tarea').update(patch).eq('id', input.tareaId);
  if (e1) {
    console.error('PATCH error:', JSON.stringify(e1));
    throw e1;
  }

  const { error: e2 } = await insforge.database.from('log_accion').insert([
    {
      tarea_id: input.tareaId,
      usuario_id: input.usuarioId,
      tipo_accion: 'reprogramada',
      valor_anterior: null,
      valor_nuevo: { fecha_planificada: input.nuevaFecha, estado: input.nuevoEstado ?? null },
      justificacion: input.justificacion,
    },
  ]);
  if (e2) throw e2;
}

export async function desbloquearTareaConLog(input: {
  tareaId: string;
  usuarioId: string;
  nuevaFecha: string;
  justificacion: string;
}): Promise<void> {
  const insforge = getInsforge();
  const semana = semanaIsoDesdeFecha(new Date(`${input.nuevaFecha}T12:00:00`));
  const just = input.justificacion.trim();
  if (just.length < 10) {
    throw new Error('La justificación debe tener al menos 10 caracteres.');
  }

  const { error: e1 } = await insforge.database
    .from('tarea')
    .update({
      estado: 'pendiente',
      fecha_planificada: input.nuevaFecha,
      semana_planificada: semana,
    })
    .eq('id', input.tareaId);
  if (e1) throw e1;

  const { error: e2 } = await insforge.database.from('log_accion').insert([
    {
      tarea_id: input.tareaId,
      usuario_id: input.usuarioId,
      tipo_accion: 'estado_cambiado',
      valor_anterior: { estado: 'bloqueada' },
      valor_nuevo: { estado: 'pendiente', fecha_planificada: input.nuevaFecha },
      justificacion: just,
      leido_por_jefe: false,
    },
  ]);
  if (e2) throw e2;
}
