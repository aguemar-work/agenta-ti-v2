import { crearEventoUsuario, crearTareaPlanificada } from '@/api/semana';
import { getInsforge } from '@/lib/insforge';
import { parseNota } from '@/lib/schemas';
import type { NotaBitacora, Tarea, TipoEvento, VisibilidadBitacora } from '@/types';

/** Todas las notas del usuario en orden cronologico inverso. */
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

/** Todas las notas de todos los usuarios - solo para jefe. */
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
  usuario_id: string;
  contenido: string;
  visibilidad: VisibilidadBitacora;
}): Promise<NotaBitacora> {
  const insforge = getInsforge();
  const { data: inserted, error } = await insforge.database
    .from('nota_bitacora')
    .insert([
      {
        usuario_id: input.usuario_id,
        contenido: input.contenido.trim(),
        objetivo_id: null,
        visibilidad: input.visibilidad,
        convertida_en: null,
      },
    ])
    .select('*')
    .single();
  if (error) throw error;
  return parseNota(inserted as Record<string, unknown>);
}

/** Marca la nota como convertida y crea la tarea planificada. */
export async function convertirNotaEnTarea(input: {
  notaId: string;
  titulo: string;
  descripcion: string;
  prioridad: Tarea['prioridad'];
  fecha_planificada: string;
  asignado_a: string;
  creado_por: string;
}): Promise<void> {
  await crearTareaPlanificada({
    titulo: input.titulo,
    descripcion: input.descripcion,
    prioridad: input.prioridad,
    fecha_planificada: input.fecha_planificada,
    asignado_a: input.asignado_a,
    creado_por: input.creado_por,
  });

  const insforge = getInsforge();
  const { error } = await insforge.database.from('nota_bitacora').update({ convertida_en: 'tarea' }).eq('id', input.notaId);
  if (error) throw error;
}

/** Marca la nota como convertida y crea el evento. */
export async function convertirNotaEnEvento(input: {
  notaId: string;
  titulo: string;
  tipo: TipoEvento;
  fecha_dia: string;
  hora_inicio: string;
  hora_fin: string;
  usuario_id: string;
  es_recurrente: boolean;
}): Promise<void> {
  await crearEventoUsuario({
    titulo: input.titulo,
    tipo: input.tipo,
    fecha_dia: input.fecha_dia,
    hora_inicio: input.hora_inicio,
    hora_fin: input.hora_fin,
    usuario_id: input.usuario_id,
    es_recurrente: input.es_recurrente,
  });

  const insforge = getInsforge();
  const { error } = await insforge.database.from('nota_bitacora').update({ convertida_en: 'evento' }).eq('id', input.notaId);
  if (error) throw error;
}
