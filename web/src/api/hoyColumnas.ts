/**
 * api/hoyColumnas.ts
 * Capa de acceso a datos para la vista HOY.
 */

import { getInsforge } from '@/lib/insforge';
import { parseEvento, parseNota, parseTarea } from '@/lib/schemas';
import { semanaIsoDesdeFecha } from '@/lib/semanas';
import type { Evento, NotaBitacora, Tarea, VisibilidadBitacora } from '@/types';

const estadosActivos: Tarea['estado'][] = ['pendiente', 'en_progreso', 'bloqueada', 'atrasada'];

/** Incidencias abiertas del usuario (columna Incidencias en HOY). */
export async function getIncidenciasAbiertas(usuarioId: string): Promise<Tarea[]> {
  const insforge = getInsforge();
  const { data, error } = await insforge.database
    .from('tarea')
    .select('*')
    .eq('asignado_a', usuarioId)
    .eq('es_imprevisto', true)
    .in('estado', estadosActivos)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => parseTarea(r as Record<string, unknown>));
}

/** Todas las incidencias del día (abiertas + cerradas). */
export async function getIncidenciasDelDia(usuarioId: string, ymd: string): Promise<Tarea[]> {
  const insforge = getInsforge();
  const { data, error } = await insforge.database
    .from('tarea')
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
  titulo:           string;
  prioridad:        Tarea['prioridad'];
  descripcion?:     string | null;
  /** null → se asigna al usuario autenticado */
  asignado_a?:      string | null;
  fecha_planificada: string;
  /** true = ya fue resuelta (completada) / false = pendiente de atender */
  ya_resuelta:      boolean;
  objetivo_id?:     string | null;
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
  });

  if (error) throw error;

  // La RPC devuelve el UUID; necesitamos leer la tarea completa
  const { data: tarea, error: errTarea } = await insforge.database
    .from('tarea')
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