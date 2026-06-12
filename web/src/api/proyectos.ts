import { z } from 'zod';

import { getInsforge } from '@/lib/insforge';
import { getWorkspaceId } from '@/store/workspaceStore';

export const Q_PROYECTOS = 'proyectos';

export const ESTADOS_PROYECTO = ['activo', 'completado', 'archivado'] as const;
export type EstadoProyecto = (typeof ESTADOS_PROYECTO)[number];

const ProyectoSchema = z.object({
  id:           z.string().uuid(),
  workspace_id: z.string().uuid(),
  cliente_id:   z.string().uuid().nullable(),
  nombre:       z.string(),
  descripcion:  z.string().nullable(),
  estado:       z.enum(ESTADOS_PROYECTO),
  created_at:   z.string(),
});

export type Proyecto = z.infer<typeof ProyectoSchema>;

function parseProyecto(row: unknown): Proyecto | null {
  const parsed = ProyectoSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

function parseProyectos(rows: unknown): Proyecto[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    const parsed = parseProyecto(row);
    return parsed ? [parsed] : [];
  });
}

/** Lista proyectos no archivados del workspace actual. */
export async function getProyectos(): Promise<Proyecto[]> {
  const { data, error } = await getInsforge().database
    .from('proyecto')
    .select('id, workspace_id, cliente_id, nombre, descripcion, estado, created_at')
    .neq('estado', 'archivado')
    .order('nombre');
  if (error) throw error;
  return parseProyectos(data);
}

export async function crearProyecto(input: {
  nombre: string;
  descripcion?: string | null;
  cliente_id: string | null;
  estado?: EstadoProyecto;
}): Promise<Proyecto> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) throw new Error('Sin workspace activo');

  const { data, error } = await getInsforge().database
    .from('proyecto')
    .insert([{
      nombre:       input.nombre.trim(),
      descripcion:  input.descripcion?.trim() || null,
      cliente_id:   input.cliente_id,
      estado:       input.estado ?? 'activo',
      workspace_id: workspaceId,
    }])
    .select('id, workspace_id, cliente_id, nombre, descripcion, estado, created_at')
    .single();
  if (error) throw error;

  const parsed = parseProyecto(data);
  if (!parsed) throw new Error('Respuesta de proyecto inválida');
  return parsed;
}

export async function actualizarProyecto(input: {
  id: string;
  nombre: string;
  descripcion?: string | null;
  cliente_id: string | null;
  estado: EstadoProyecto;
}): Promise<Proyecto> {
  const { data, error } = await getInsforge().database
    .from('proyecto')
    .update({
      nombre:      input.nombre.trim(),
      descripcion: input.descripcion?.trim() || null,
      cliente_id:  input.cliente_id,
      estado:      input.estado,
    })
    .eq('id', input.id)
    .select('id, workspace_id, cliente_id, nombre, descripcion, estado, created_at')
    .single();
  if (error) throw error;

  const parsed = parseProyecto(data);
  if (!parsed) throw new Error('Respuesta de proyecto inválida');
  return parsed;
}

/** Archiva el proyecto (estado archivado — no DELETE). */
export async function archivarProyecto(id: string): Promise<void> {
  const { error } = await getInsforge().database
    .from('proyecto')
    .update({ estado: 'archivado' })
    .eq('id', id);
  if (error) throw error;
}
