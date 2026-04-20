import type { UserSchema } from '@insforge/sdk';

import { getInsforge } from '@/lib/insforge';
import type { Usuario } from '@/types';

function mapRow(row: Record<string, unknown>): Usuario {
  return {
    id: String(row.id),
    nombre: String(row.nombre),
    email: String(row.email),
    rol: row.rol as Usuario['rol'],
    activo: Boolean(row.activo),
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
 * Garantiza fila en `public.usuario` enlazada a `auth.users` (misma `id` que el JWT).
 */
export async function asegurarUsuario(authUser: UserSchema): Promise<Usuario> {
  const existente = await fetchUsuarioPorId(authUser.id);
  if (existente) return existente;

  const insforge = getInsforge();
  const nombre =
    authUser.profile && typeof authUser.profile.name === 'string'
      ? authUser.profile.name
      : authUser.email.split('@')[0] ?? 'Usuario';

  const { data, error } = await insforge.database
    .from('usuario')
    .insert([
      {
        id: authUser.id,
        nombre,
        email: authUser.email,
      },
    ])
    .select('*')
    .single();

  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}
