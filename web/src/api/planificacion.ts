import { getInsforge } from '@/lib/insforge';
import { fechaLocalYmd } from '@/lib/fecha';
import { parseTarea } from '@/lib/schemas';
import { TAREA_ACTIVA } from '@/lib/tareaTables';
import { inicioSemanaIso, semanaIsoDesdeFecha } from '@/lib/semanas';
import type { Tarea, Usuario } from '@/types';

/** Tareas planificadas de miembros activos en la semana ISO. */
export async function getCargaEquipoSemana(semanaISO: string): Promise<Tarea[]> {
  const insforge = getInsforge();
  const { data: usuarios, error: e1 } = await insforge.database
    .from('usuario')
    .select('id')
    .eq('activo', true)
    .eq('rol', 'miembro');
  if (e1) throw e1;
  const ids = (usuarios ?? []).map((u: { id: string }) => u.id);
  if (ids.length === 0) return [];

  const { data, error } = await insforge.database
    .from(TAREA_ACTIVA)
    .select('*')
    .eq('tipo', 'planificada')
    .eq('semana_planificada', semanaISO)
    .in('asignado_a', ids);
  if (error) throw error;
  return (data ?? []).map((r) => parseTarea(r as Record<string, unknown>));
}

export async function getOTsPendientesIds(): Promise<{ id: string }[]> {
  const { data, error } = await getInsforge().database
    .from('orden_trabajo')
    .select('id')
    .eq('estado', 'pendiente');
  if (error) throw error;
  return (data ?? []) as { id: string }[];
}

export async function getMiembrosActivos(): Promise<Pick<Usuario, 'id' | 'nombre' | 'email'>[]> {
  const insforge = getInsforge();
  const { data, error } = await insforge.database
    .from('usuario')
    .select('id,nombre,email')
    .eq('activo', true)
    .eq('rol', 'miembro')
    .order('nombre');
  if (error) throw error;
  return (data ?? []) as Pick<Usuario, 'id' | 'nombre' | 'email'>[];
}

export async function getTareasUsuarioDia(usuarioId: string, fecha: string): Promise<Tarea[]> {
  const insforge = getInsforge();
  const { data, error } = await insforge.database
    .from(TAREA_ACTIVA)
    .select('*')
    .eq('asignado_a', usuarioId)
    .eq('tipo', 'planificada')
    .eq('fecha_planificada', fecha)
    .order('prioridad', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => parseTarea(r as Record<string, unknown>));
}

/** Fecha `YYYY-MM-DD` del lunes de la semana ISO `YYYYWW`. */
export function fechaLunesDesdeSemanaIso(semanaISO: string): string {
  const isoYear = parseInt(semanaISO.slice(0, 4), 10);
  const guess0 = new Date(isoYear, 0, 1);
  for (let i = 0; i < 400; i++) {
    const guess = new Date(guess0.getTime() + i * 86400000);
    const mon = inicioSemanaIso(guess);
    if (semanaIsoDesdeFecha(mon) === semanaISO) {
      return fechaLocalYmd(mon);
    }
  }
  return fechaLocalYmd(inicioSemanaIso(new Date(isoYear, 5, 15)));
}

/** Incidencias (tareas imprevistas) registradas por miembros en el rango de la semana. */
export async function getIncidenciasEquipoSemana(lunes: Date, sabado: Date): Promise<Tarea[]> {
  const insforge = getInsforge();
  const { data: usuarios, error: e1 } = await insforge.database
    .from('usuario')
    .select('id')
    .eq('activo', true)
    .eq('rol', 'miembro');
  if (e1) throw e1;
  const ids = (usuarios ?? []).map((u: { id: string }) => u.id);
  if (ids.length === 0) return [];

  const desde = new Date(lunes);
  desde.setHours(0, 0, 0, 0);
  const hasta = new Date(sabado);
  hasta.setHours(23, 59, 59, 999);

  const { data, error } = await insforge.database
    .from(TAREA_ACTIVA)
    .select('*')
    .eq('es_imprevisto', true)
    .in('asignado_a', ids)
    .gte('created_at', desde.toISOString())
    .lte('created_at', hasta.toISOString())
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => parseTarea(r as Record<string, unknown>));
}