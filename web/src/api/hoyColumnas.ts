import { getInsforge } from '@/lib/insforge';
import { resolveAsignadoA } from '@/lib/tareaAsignacion';
import { semanaIsoDesdeFecha } from '@/lib/semanas';
import type { Evento, NotaBitacora, Tarea, VisibilidadBitacora } from '@/types';

function parseTarea(row: Record<string, unknown>): Tarea {
  return row as unknown as Tarea;
}

function parseEvento(row: Record<string, unknown>): Evento {
  return row as unknown as Evento;
}

function parseNota(row: Record<string, unknown>): NotaBitacora {
  return row as unknown as NotaBitacora;
}

const estadosActivos: Tarea['estado'][] = ['pendiente', 'en_progreso', 'bloqueada', 'atrasada'];

/** Imprevistos / no planificadas abiertas del usuario (columna Incidencias). */
export async function getIncidenciasAbiertas(usuarioId: string): Promise<Tarea[]> {
  const insforge = getInsforge();
  const { data, error } = await insforge.database
    .from('tarea')
    .select('*')
    .eq('asignado_a', usuarioId)
    .in('estado', estadosActivos)
    .or('es_imprevisto.eq.true,tipo.eq.no_planificada')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => parseTarea(r as Record<string, unknown>));
}

/** Incidencias / imprevistos ya cerrados (histórico en columna Hoy). */
export async function getIncidenciasHistoricas(usuarioId: string, limit = 40): Promise<Tarea[]> {
  const insforge = getInsforge();
  const { data, error } = await insforge.database
    .from('tarea')
    .select('*')
    .eq('asignado_a', usuarioId)
    .eq('estado', 'completada')
    .eq('es_imprevisto', true)
    .order('fecha_completada', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => parseTarea(r as Record<string, unknown>));
}

export async function getEventosDelDia(usuarioId: string, ymd: string): Promise<Evento[]> {
  const insforge = getInsforge();
  const desde = new Date(`${ymd}T00:00:00`);
  const hasta = new Date(`${ymd}T23:59:59.999`);
  const { data, error } = await insforge.database
    .from('evento')
    .select('*')
    .eq('usuario_id', usuarioId)
    .gte('fecha_inicio', desde.toISOString())
    .lte('fecha_inicio', hasta.toISOString())
    .order('fecha_inicio', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => parseEvento(r as Record<string, unknown>));
}

export async function getNotasBitacoraRecientes(usuarioId: string, limit = 8): Promise<NotaBitacora[]> {
  const insforge = getInsforge();
  const { data, error } = await insforge.database
    .from('nota_bitacora')
    .select('*')
    .eq('usuario_id', usuarioId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => parseNota(r as Record<string, unknown>));
}

export type CrearIncidenciaInput = {
  titulo: string;
  prioridad: Tarea['prioridad'];
  descripcion?: string | null;
  asignado_a?: string | null;
  creado_por: string;
  fecha_planificada: string;
};

/** Registra incidencia del día: no planificada + imprevisto. */
export async function crearIncidenciaHoy(input: CrearIncidenciaInput): Promise<Tarea> {
  const insforge = getInsforge();
  const semana = semanaIsoDesdeFecha(new Date(`${input.fecha_planificada}T12:00:00`));
  const asignado = resolveAsignadoA(input.asignado_a, input.creado_por);
  const row = {
    titulo: input.titulo,
    descripcion: input.descripcion?.trim() || null,
    prioridad: input.prioridad,
    estado: 'pendiente' as const,
    tipo: 'no_planificada' as const,
    fecha_planificada: input.fecha_planificada,
    semana_planificada: semana,
    asignado_a: asignado,
    creado_por: input.creado_por,
    objetivo_id: null,
    es_imprevisto: true,
  };
  const { data: inserted, error } = await insforge.database.from('tarea').insert([row]).select('*').single();
  if (error) throw error;
  return parseTarea(inserted as Record<string, unknown>);
}

export type CrearTareaNoPlanificadaDesdeNotaInput = {
  titulo: string;
  descripcion: string | null;
  asignado_a?: string | null;
  creado_por: string;
  fecha_planificada: string;
};

/** Tarea no planificada (sin imprevisto) a partir de una nota de bitácora — p. ej. acción del jefe. */
export async function insertarNotaBitacoraRapida(input: {
  usuario_id: string;
  contenido: string;
  visibilidad?: VisibilidadBitacora;
}): Promise<NotaBitacora> {
  const insforge = getInsforge();
  const row = {
    usuario_id: input.usuario_id,
    contenido: input.contenido.trim(),
    objetivo_id: null,
    visibilidad: input.visibilidad ?? ('todos' as const),
  };
  const { data: inserted, error } = await insforge.database.from('nota_bitacora').insert([row]).select('*').single();
  if (error) throw error;
  return parseNota(inserted as Record<string, unknown>);
}

export async function crearTareaNoPlanificadaDesdeNota(input: CrearTareaNoPlanificadaDesdeNotaInput): Promise<Tarea> {
  const insforge = getInsforge();
  const semana = semanaIsoDesdeFecha(new Date(`${input.fecha_planificada}T12:00:00`));
  const asignado = resolveAsignadoA(input.asignado_a, input.creado_por);
  const row = {
    titulo: input.titulo.trim().slice(0, 500),
    descripcion: input.descripcion?.trim() || null,
    prioridad: 'media' as const,
    estado: 'pendiente' as const,
    tipo: 'no_planificada' as const,
    fecha_planificada: input.fecha_planificada,
    semana_planificada: semana,
    asignado_a: asignado,
    creado_por: input.creado_por,
    objetivo_id: null,
    es_imprevisto: false,
  };
  const { data: inserted, error } = await insforge.database.from('tarea').insert([row]).select('*').single();
  if (error) throw error;
  return parseTarea(inserted as Record<string, unknown>);
}
