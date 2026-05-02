/**
 * api/bitacora.ts
 * Capa de acceso a datos para la Bitácora.
 */

import { crearEventoUsuario } from '@/api/semana';
import { getInsforge } from '@/lib/insforge';
import { parseNota, parseTarea } from '@/lib/schemas';
import { semanaIsoDesdeFecha } from '@/lib/semanas';
import type { NotaBitacora, Tarea, TipoEvento, VisibilidadBitacora } from '@/types';

/** Todas las notas del usuario en orden cronológico inverso. */
export async function getNotasBitacora(usuarioId: string): Promise<NotaBitacora[]> {
  const insforge = getInsforge();
  const { data, error } = await insforge.database
    .from('nota_bitacora')
    .select('*, usuario:usuario_id(nombre)')
    .eq('usuario_id', usuarioId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => parseNota(r as Record<string, unknown>));
}

/** Todas las notas de todo el equipo — solo jefe. */
export async function getNotasBitacoraEquipo(): Promise<NotaBitacora[]> {
  const insforge = getInsforge();
  const { data, error } = await insforge.database
    .from('nota_bitacora')
    .select('*, usuario:usuario_id(nombre)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => parseNota(r as Record<string, unknown>));
}

export async function insertarNota(input: {
  usuario_id:   string;
  contenido:    string;
  visibilidad:  VisibilidadBitacora;
  objetivo_id?: string | null;
}): Promise<NotaBitacora> {
  const insforge = getInsforge();
  const { data: inserted, error } = await insforge.database
    .from('nota_bitacora')
    .insert([{
      usuario_id:    input.usuario_id,
      contenido:     input.contenido.trim(),
      objetivo_id:   input.objetivo_id ?? null,
      visibilidad:   input.visibilidad,
      convertida_en: null,
    }])
    .select('*')
    .single();
  if (error) throw error;
  return parseNota(inserted as Record<string, unknown>);
}

/**
 * Convierte una nota en tarea planificada.
 * Usa la RPC sgtd_convertir_nota_en_tarea (atómica):
 *   - Crea la tarea con nota_origen_id apuntando a la nota
 *   - Marca la nota como convertida_en='tarea'
 *   - Todo en la misma transacción
 */
export async function convertirNotaEnTarea(input: {
  notaId:            string;
  titulo:            string;
  descripcion:       string;
  prioridad:         Tarea['prioridad'];
  fecha_planificada: string;
  asignado_a:        string;
  creado_por:        string;
}): Promise<string> {
  const semana = semanaIsoDesdeFecha(new Date(`${input.fecha_planificada}T12:00:00`));

  const { data: tareaId, error } = await getInsforge().database.rpc(
    'sgtd_convertir_nota_en_tarea',
    {
      p_nota_id:           input.notaId,
      p_titulo:            input.titulo.trim(),
      p_descripcion:       input.descripcion.trim(),
      p_prioridad:         input.prioridad,
      p_fecha_planificada: input.fecha_planificada,
      p_semana:            semana,
      p_asignado_a:        input.asignado_a,
      p_creado_por:        input.creado_por,
    },
  );
  if (error) throw error;
  return tareaId as string;
}

/**
 * Convierte una nota en evento.
 * Usa la RPC sgtd_convertir_nota_en_evento (atómica).
 */
export async function convertirNotaEnEvento(input: {
  notaId:        string;
  titulo:        string;
  tipo:          TipoEvento;
  fecha_dia:     string;
  hora_inicio:   string;
  hora_fin:      string;
  usuario_id:    string;
  es_recurrente: boolean;
}): Promise<string> {
  function toIsoLocal(fechaDia: string, hora: string): string {
    const [h, m] = hora.split(':').map(Number);
    const d = new Date(`${fechaDia}T00:00:00`);
    d.setHours(h || 0, m || 0, 0, 0);
    return d.toISOString();
  }

  const { data: eventoId, error } = await getInsforge().database.rpc(
    'sgtd_convertir_nota_en_evento',
    {
      p_nota_id:       input.notaId,
      p_titulo:        input.titulo.trim(),
      p_tipo:          input.tipo,
      p_fecha_inicio:  toIsoLocal(input.fecha_dia, input.hora_inicio),
      p_fecha_fin:     toIsoLocal(input.fecha_dia, input.hora_fin),
      p_usuario_id:    input.usuario_id,
      p_es_recurrente: input.es_recurrente,
    },
  );
  if (error) throw error;
  return eventoId as string;
}