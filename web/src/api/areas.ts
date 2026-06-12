import { z } from 'zod';

import { getInsforge } from '@/lib/insforge';
import { getWorkspaceId } from '@/store/workspaceStore';

export const Q_AREAS = 'areas';

const AreaSchema = z.object({
  id:           z.string().uuid(),
  workspace_id: z.string().uuid(),
  nombre:       z.string(),
  activo:       z.boolean(),
  created_at:   z.string(),
});

export type Area = z.infer<typeof AreaSchema>;

function parseArea(row: unknown): Area | null {
  const parsed = AreaSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

function parseAreas(rows: unknown): Area[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    const parsed = parseArea(row);
    return parsed ? [parsed] : [];
  });
}

/** Lista áreas activas del workspace actual. */
export async function getAreas(): Promise<Area[]> {
  const { data, error } = await getInsforge().database
    .from('area')
    .select('id, workspace_id, nombre, activo, created_at')
    .eq('activo', true)
    .order('nombre');
  if (error) throw error;
  return parseAreas(data);
}

export async function crearArea(input: { nombre: string }): Promise<Area> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) throw new Error('Sin workspace activo');

  const { data, error } = await getInsforge().database
    .from('area')
    .insert([{ nombre: input.nombre.trim(), workspace_id: workspaceId }])
    .select('id, workspace_id, nombre, activo, created_at')
    .single();
  if (error) throw error;

  const parsed = parseArea(data);
  if (!parsed) throw new Error('Respuesta de área inválida');
  return parsed;
}

export async function actualizarArea(input: { id: string; nombre: string }): Promise<Area> {
  const { data, error } = await getInsforge().database
    .from('area')
    .update({ nombre: input.nombre.trim() })
    .eq('id', input.id)
    .select('id, workspace_id, nombre, activo, created_at')
    .single();
  if (error) throw error;

  const parsed = parseArea(data);
  if (!parsed) throw new Error('Respuesta de área inválida');
  return parsed;
}

/** Soft-delete: desactiva el área (no DELETE). */
export async function desactivarArea(id: string): Promise<void> {
  const { error } = await getInsforge().database
    .from('area')
    .update({ activo: false })
    .eq('id', id);
  if (error) throw error;
}
