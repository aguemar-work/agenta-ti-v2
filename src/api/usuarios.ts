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
