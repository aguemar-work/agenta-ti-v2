import { getInsforge } from '@/lib/insforge';
import { fechaLocalYmd } from '@/lib/fecha';
import { parseTarea } from '@/lib/schemas';
import { inicioSemanaIso, semanaIsoDesdeFecha } from '@/lib/semanas';
import type { ConfiguracionSemana, Tarea, Usuario } from '@/types';

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
    .from('tarea')
    .select('*')
    .eq('tipo', 'planificada')
    .eq('semana_planificada', semanaISO)
    .in('asignado_a', ids);
  if (error) throw error;
  return (data ?? []).map((r) => parseTarea(r as Record<string, unknown>));
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
    .from('tarea')
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

export async function getNotaSemana(semanaISO: string): Promise<ConfiguracionSemana | null> {
  const insforge = getInsforge();
  const lunesStr = fechaLunesDesdeSemanaIso(semanaISO);
  const { data, error } = await insforge.database
    .from('configuracion_semana')
    .select('*')
    .eq('fecha_inicio_semana', lunesStr)
    .maybeSingle();
  if (error) throw error;
  return data ? (data as unknown as ConfiguracionSemana) : null;
}

export async function upsertNotaSemana(semanaISO: string, nota: string): Promise<void> {
  const insforge = getInsforge();
  const fechaInicio = fechaLunesDesdeSemanaIso(semanaISO);
  const { data: existente } = await insforge.database
    .from('configuracion_semana')
    .select('id')
    .eq('fecha_inicio_semana', fechaInicio)
    .maybeSingle();

  if (existente?.id) {
    const { error } = await insforge.database
      .from('configuracion_semana')
      .update({ notas_semana: nota })
      .eq('id', (existente as { id: string }).id);
    if (error) throw error;
  } else {
    const { error } = await insforge.database.from('configuracion_semana').insert([
      {
        fecha_inicio_semana: fechaInicio,
        notas_semana: nota,
      },
    ]);
    if (error) throw error;
  }
}
