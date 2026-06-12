/**
 * api/hoyColumnas.ts
 * Capa de acceso a datos para la vista HOY.
 */

import { getInsforge } from '@/lib/insforge';
import { parseEvento, parseNota, parseTarea } from '@/lib/schemas';
import { TAREA_ACTIVA } from '@/lib/tareaTables';
import { semanaIsoDesdeFecha } from '@/lib/semanas';
import type { Evento, NotaBitacora, Tarea, TipoEvento, VisibilidadBitacora } from '@/types';

function toIsoLocal(fechaDia: string, hora: string): string {
  const [h, m] = hora.split(':').map(Number);
  const d = new Date(`${fechaDia}T00:00:00`);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toISOString();
}

function ordenarNotasBitacora(notas: NotaBitacora[]): NotaBitacora[] {
  return [...notas].sort((a, b) => {
    const aConv = a.convertida_en ? 1 : 0;
    const bConv = b.convertida_en ? 1 : 0;
    if (aConv !== bConv) return aConv - bConv;
    return b.created_at.localeCompare(a.created_at);
  });
}

const estadosActivos: Tarea['estado'][] = ['pendiente', 'en_progreso'];

/** Incidencias abiertas del usuario (columna Incidencias en HOY). */
export async function getIncidenciasAbiertas(usuarioId: string): Promise<Tarea[]> {
  const insforge = getInsforge();
  const { data, error } = await insforge.database
    .from(TAREA_ACTIVA)
    .select('*')
    .eq('asignado_a', usuarioId)
    .eq('es_imprevisto', true)
    .in('estado', estadosActivos)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => parseTarea(r as Record<string, unknown>));
}

/** Incidencias de un usuario en un rango de fechas planificadas (inclusive). */
export async function getIncidenciasRangoUsuario(
  usuarioId: string,
  desdeYmd: string,
  hastaYmd: string,
): Promise<Tarea[]> {
  const insforge = getInsforge();
  const { data, error } = await insforge.database
    .from(TAREA_ACTIVA)
    .select('*')
    .eq('asignado_a', usuarioId)
    .eq('es_imprevisto', true)
    .gte('fecha_planificada', desdeYmd)
    .lte('fecha_planificada', hastaYmd)
    .order('fecha_planificada', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => parseTarea(r as Record<string, unknown>));
}

/** Incidencias del equipo (miembros activos) por fecha planificada en la semana. */
export async function getIncidenciasEquipoPorFechaPlanificada(
  desdeYmd: string,
  hastaYmd: string,
): Promise<Tarea[]> {
  const insforge = getInsforge();
  const { data: usuarios, error: e1 } = await insforge.database
    .from('usuario')
    .select('id')
    .eq('activo', true)
    .eq('rol', 'miembro');
  if (e1) throw e1;
  const ids = (usuarios ?? []).map((u: { id: string }) => u.id);
  if (ids.length === 0) return [];

  const { data, error } = await insforge.database
    .from(TAREA_ACTIVA)
    .select('*')
    .eq('es_imprevisto', true)
    .in('asignado_a', ids)
    .gte('fecha_planificada', desdeYmd)
    .lte('fecha_planificada', hastaYmd)
    .order('fecha_planificada', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => parseTarea(r as Record<string, unknown>));
}

/** Todas las incidencias del día (abiertas + cerradas). */
export async function getIncidenciasDelDia(usuarioId: string, ymd: string): Promise<Tarea[]> {
  const insforge = getInsforge();
  const { data, error } = await insforge.database
    .from(TAREA_ACTIVA)
    .select('*')
    .eq('asignado_a', usuarioId)
    .eq('es_imprevisto', true)
    .eq('fecha_planificada', ymd)
    .order('created_at', { ascending: false });
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

/**
 * Notas recientes para el panel lateral de Mi Semana.
 * Miembro: propias + visibilidad `todos` (RLS 031). Jefe: todas (RLS FOR ALL).
 */
export async function getNotasBitacoraRecientes(
  usuarioId: string,
  limit = 8,
  esJefe = false,
): Promise<NotaBitacora[]> {
  const insforge = getInsforge();
  let query = insforge.database.from('nota_bitacora').select('*');
  if (!esJefe) {
    query = query.or(`usuario_id.eq.${usuarioId},visibilidad.eq.todos`);
  }
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ordenarNotasBitacora(
    (data ?? []).map((r) => parseNota(r as Record<string, unknown>)),
  );
}

export type CrearIncidenciaInput = {
  titulo:           string;
  prioridad:        Tarea['prioridad'];
  descripcion?:     string | null;
  /** null → se asigna al usuario autenticado */
  asignado_a?:      string | null;
  fecha_planificada: string;
  /** true = ya fue resuelta (completada) / false = pendiente de atender */
  ya_resuelta:      boolean;
  objetivo_id?:     string | null;
  cliente_id?:      string | null;
  proyecto_id?:     string | null;
  area_id?:         string | null;
};

/**
 * Crea una incidencia vía RPC sgtd_crear_incidencia.
 * El estado inicial depende de ya_resuelta:
 *   true  → completada (se resolvió en el momento)
 *   false → pendiente  (se atenderá después)
 */
export async function crearIncidencia(input: CrearIncidenciaInput): Promise<Tarea> {
  const insforge = getInsforge();
  const semana = semanaIsoDesdeFecha(new Date(`${input.fecha_planificada}T12:00:00`));

  const { data, error } = await insforge.database.rpc('sgtd_crear_incidencia', {
    p_titulo:      input.titulo.trim(),
    p_descripcion: input.descripcion?.trim() ?? null,
    p_prioridad:   input.prioridad,
    p_fecha:       input.fecha_planificada,
    p_semana:      semana,
    p_ya_resuelta: input.ya_resuelta,
    p_asignado_a:  input.asignado_a ?? null,
    p_objetivo_id: input.objetivo_id ?? null,
    p_cliente_id:  input.cliente_id ?? null,
    p_proyecto_id: input.proyecto_id ?? null,
    p_area_id:     input.area_id ?? null,
  });

  if (error) throw error;

  // La RPC devuelve el UUID; necesitamos leer la tarea completa
  const { data: tarea, error: errTarea } = await insforge.database
    .from(TAREA_ACTIVA)
    .select('*')
    .eq('id', data as string)
    .single();
  if (errTarea) throw errTarea;

  return parseTarea(tarea as Record<string, unknown>);
}

export async function insertarNotaBitacoraRapida(input: {
  usuario_id:   string;
  contenido:    string;
  visibilidad?: VisibilidadBitacora;
}): Promise<NotaBitacora> {
  const insforge = getInsforge();
  const { data: inserted, error } = await insforge.database
    .from('nota_bitacora')
    .insert([{
      usuario_id:  input.usuario_id,
      contenido:   input.contenido.trim(),
      objetivo_id: null,
      visibilidad: input.visibilidad ?? 'todos',
    }])
    .select('*')
    .single();
  if (error) throw error;
  return parseNota(inserted as Record<string, unknown>);
}

export type ConvertirNotaEnTareaInput = {
  notaId:            string;
  titulo:            string;
  descripcion?:      string | null;
  prioridad:         Tarea['prioridad'];
  fecha_planificada: string;
  asignado_a:        string;
  creado_por:        string;
};

/** Convierte nota en tarea planificada (RPC atómica + nota_origen_id). */
export async function convertirNotaEnTarea(input: ConvertirNotaEnTareaInput): Promise<string> {
  const insforge = getInsforge();
  const semana = semanaIsoDesdeFecha(new Date(`${input.fecha_planificada}T12:00:00`));
  const { data, error } = await insforge.database.rpc('sgtd_convertir_nota_en_tarea', {
    p_nota_id:           input.notaId,
    p_titulo:            input.titulo.trim(),
    p_descripcion:       input.descripcion?.trim() ?? '',
    p_prioridad:         input.prioridad,
    p_fecha_planificada: input.fecha_planificada,
    p_semana:            semana,
    p_asignado_a:        input.asignado_a,
    p_creado_por:        input.creado_por,
  });
  if (error) throw error;
  return data as string;
}

export type ConvertirNotaEnEventoInput = {
  notaId:      string;
  titulo:      string;
  tipo:        TipoEvento;
  fecha_dia:   string;
  hora_inicio: string;
  hora_fin:    string;
  usuario_id:  string;
};

/** Convierte nota en evento (RPC atómica). */
export async function convertirNotaEnEvento(input: ConvertirNotaEnEventoInput): Promise<string> {
  const insforge = getInsforge();
  const { data, error } = await insforge.database.rpc('sgtd_convertir_nota_en_evento', {
    p_nota_id:       input.notaId,
    p_titulo:        input.titulo.trim(),
    p_tipo:          input.tipo,
    p_fecha_inicio:  toIsoLocal(input.fecha_dia, input.hora_inicio),
    p_fecha_fin:     toIsoLocal(input.fecha_dia, input.hora_fin),
    p_usuario_id:    input.usuario_id,
    p_es_recurrente: false,
  });
  if (error) throw error;
  return data as string;
}