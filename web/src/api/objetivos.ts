import { getInsforge } from '@/lib/insforge';
import type { Objetivo, EstadoObjetivo, Tarea } from '@/types';

function parseObjetivo(row: Record<string, unknown>): Objetivo {
  return row as unknown as Objetivo;
}

function parseTarea(row: Record<string, unknown>): Tarea {
  return row as unknown as Tarea;
}

export async function getObjetivosActivos(): Promise<Pick<Objetivo, 'id' | 'titulo'>[]> {
  const insforge = getInsforge();
  const { data, error } = await insforge.database
    .from('objetivo')
    .select('id,titulo')
    .eq('estado', 'activo')
    .order('titulo');
  if (error) throw error;
  return (data ?? []) as Pick<Objetivo, 'id' | 'titulo'>[];
}

export async function getTareasPorObjetivo(objetivoId: string): Promise<Tarea[]> {
  const insforge = getInsforge();
  const { data, error } = await insforge.database
    .from('tarea')
    .select('*')
    .eq('objetivo_id', objetivoId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => parseTarea(r as Record<string, unknown>));
}

export type CrearObjetivoInput = {
  titulo: string;
  descripcion?: string | null;
  fecha_limite?: string | null;
  creado_por: string;
  /** Responsable obligatorio en UI; si falta se puede igualar a creado_por en el cliente. */
  responsable_id: string;
  estado?: EstadoObjetivo;
};

export async function crearObjetivo(input: CrearObjetivoInput): Promise<Objetivo> {
  const insforge = getInsforge();
  const row = {
    titulo: input.titulo.trim(),
    descripcion: input.descripcion?.trim() ?? null,
    fecha_limite: input.fecha_limite ?? null,
    estado: input.estado ?? ('activo' as const),
    creado_por: input.creado_por,
    responsable_id: input.responsable_id,
  };
  const { data: inserted, error } = await insforge.database.from('objetivo').insert([row]).select('*').single();
  if (error) throw error;
  return parseObjetivo(inserted as Record<string, unknown>);
}

export async function eliminarObjetivo(input: {
  objetivoId: string;
  usuarioId: string;
  motivo: string;
}): Promise<void> {
  const insforge = getInsforge();
  const motivo = input.motivo.trim();
  if (motivo.length < 10) throw new Error('Motivo mínimo 10 caracteres.');

  const { error: eLog } = await insforge.database.from('log_accion').insert([
    {
      tarea_id: null,
      usuario_id: input.usuarioId,
      tipo_accion: 'eliminada',
      valor_anterior: { objetivo_id: input.objetivoId },
      valor_nuevo: null,
      justificacion: motivo,
      leido_por_jefe: false,
    },
  ]);
  if (eLog) throw eLog;

  const { error } = await insforge.database.from('objetivo').delete().eq('id', input.objetivoId);
  if (error) throw error;
}
