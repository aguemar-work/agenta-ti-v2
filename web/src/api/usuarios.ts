import { getInsforge } from '@/lib/insforge';
import type { Usuario } from '@/types';

/** Usuarios activos para dropdowns de responsable / asignado. */
export async function getUsuariosActivosParaAsignacion(): Promise<Pick<Usuario, 'id' | 'nombre' | 'email'>[]> {
  const insforge = getInsforge();
  const { data, error } = await insforge.database
    .from('usuario')
    .select('id,nombre,email')
    .eq('activo', true)
    .order('nombre');
  if (error) throw error;
  return (data ?? []) as Pick<Usuario, 'id' | 'nombre' | 'email'>[];
}

/** Usuarios activos para selectores de jefe (incluye rol). */
export async function getUsuariosParaSelector(): Promise<Pick<Usuario, 'id' | 'nombre' | 'email' | 'rol'>[]> {
  const { data, error } = await getInsforge().database
    .from('usuario')
    .select('id,nombre,email,rol')
    .eq('activo', true)
    .order('nombre');
  if (error) throw error;
  return (data ?? []) as Pick<Usuario, 'id' | 'nombre' | 'email' | 'rol'>[];
}

/** Jefes activos que pueden recibir notificaciones del equipo. */
export async function getJefesActivosParaNotificacion(): Promise<Pick<Usuario, 'id' | 'nombre'>[]> {
  const insforge = getInsforge();
  const { data, error } = await insforge.database
    .from('usuario')
    .select('id,nombre')
    .eq('activo', true)
    .eq('rol', 'jefe')
    .order('nombre');
  if (error) throw error;
  return (data ?? []) as Pick<Usuario, 'id' | 'nombre'>[];
}