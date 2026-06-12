import { z } from 'zod';

import { getInsforge } from '@/lib/insforge';
import { getWorkspaceId } from '@/store/workspaceStore';

export const Q_CLIENTES = 'clientes';

const ClienteSchema = z.object({
  id:           z.string().uuid(),
  workspace_id: z.string().uuid(),
  nombre:       z.string(),
  activo:       z.boolean(),
  created_at:   z.string(),
});

export type Cliente = z.infer<typeof ClienteSchema>;

function parseCliente(row: unknown): Cliente | null {
  const parsed = ClienteSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

function parseClientes(rows: unknown): Cliente[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    const parsed = parseCliente(row);
    return parsed ? [parsed] : [];
  });
}

/** Lista clientes activos del workspace actual. */
export async function getClientes(): Promise<Cliente[]> {
  const { data, error } = await getInsforge().database
    .from('cliente')
    .select('id, workspace_id, nombre, activo, created_at')
    .eq('activo', true)
    .order('nombre');
  if (error) throw error;
  return parseClientes(data);
}

export async function crearCliente(input: { nombre: string }): Promise<Cliente> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) throw new Error('Sin workspace activo');

  const { data, error } = await getInsforge().database
    .from('cliente')
    .insert([{ nombre: input.nombre.trim(), workspace_id: workspaceId }])
    .select('id, workspace_id, nombre, activo, created_at')
    .single();
  if (error) throw error;

  const parsed = parseCliente(data);
  if (!parsed) throw new Error('Respuesta de cliente inválida');
  return parsed;
}

export async function actualizarCliente(input: { id: string; nombre: string }): Promise<Cliente> {
  const { data, error } = await getInsforge().database
    .from('cliente')
    .update({ nombre: input.nombre.trim() })
    .eq('id', input.id)
    .select('id, workspace_id, nombre, activo, created_at')
    .single();
  if (error) throw error;

  const parsed = parseCliente(data);
  if (!parsed) throw new Error('Respuesta de cliente inválida');
  return parsed;
}

/** Soft-delete: desactiva el cliente (no DELETE). */
export async function desactivarCliente(id: string): Promise<void> {
  const { error } = await getInsforge().database
    .from('cliente')
    .update({ activo: false })
    .eq('id', id);
  if (error) throw error;
}
