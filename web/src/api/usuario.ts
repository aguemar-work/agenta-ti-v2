import type { UserSchema } from '@insforge/sdk';

import { getInsforge } from '@/lib/insforge';
import type { Usuario } from '@/types';


function mapRow(row: Record<string, unknown>): Usuario {
  return {
    id: String(row.id),
    nombre: String(row.nombre),
    email: String(row.email),
    rol: row.rol as Usuario['rol'],
    activo: row.activo !== false,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function fetchUsuarioPorId(id: string): Promise<Usuario | null> {
  const insforge = getInsforge();
  const { data, error } = await insforge.database
    .from('usuario')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

/**
 * Verifica que el usuario autenticado tenga fila en `public.usuario`.
 * Solo se permite entrar a usuarios invitados explícitamente por el dueño de plataforma.
 * Si no existe la fila, se bloquea el acceso.
 */
export async function asegurarUsuario(authUser: UserSchema): Promise<Usuario> {
  const existente = await fetchUsuarioPorId(authUser.id);
  if (existente) return existente;
  throw new Error('No tienes acceso a esta plataforma. Solicita una invitación al administrador.');
}