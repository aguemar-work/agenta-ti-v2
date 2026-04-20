import { getInsforge } from '@/lib/insforge';
import type { EstadoObjetivo, Objetivo, Tarea } from '@/types';

function parseObjetivo(row: Record<string, unknown>): Objetivo {
  return row as unknown as Objetivo;
}

export type ObjetivoConProgreso = Objetivo & {
  total_tareas: number;
  completadas: number;
  /** 0–100 */
  pct: number;
};

export type KpisUsuario = {
  activas: number;
  completadas7d: number;
  objetivosActivos: number;
  atrasadas: number;
};

export async function getObjetivosConProgreso(): Promise<ObjetivoConProgreso[]> {
  const insforge = getInsforge();
  const { data: objs, error: e1 } = await insforge.database.from('objetivo').select('*').order('fecha_limite', { ascending: true });
  if (e1) throw e1;
  const objetivos = (objs ?? []).map((r) => parseObjetivo(r as Record<string, unknown>));

  const { data: trows, error: e2 } = await insforge.database
    .from('tarea')
    .select('id,objetivo_id,estado')
    .not('objetivo_id', 'is', null);
  if (e2) throw e2;
  const tareas = (trows ?? []) as Pick<Tarea, 'id' | 'objetivo_id' | 'estado'>[];

  const byObj = new Map<string, { total: number; done: number }>();
  for (const t of tareas) {
    if (!t.objetivo_id) continue;
    if (t.estado === 'cancelada') continue;
    const cur = byObj.get(t.objetivo_id) ?? { total: 0, done: 0 };
    cur.total += 1;
    if (t.estado === 'completada') cur.done += 1;
    byObj.set(t.objetivo_id, cur);
  }

  return objetivos.map((o) => {
    const { total, done } = byObj.get(o.id) ?? { total: 0, done: 0 };
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    return { ...o, total_tareas: total, completadas: done, pct };
  });
}

export async function getKpisUsuario(usuarioId: string): Promise<KpisUsuario> {
  const insforge = getInsforge();
  const lim = new Date();
  lim.setDate(lim.getDate() - 7);
  const limIso = lim.toISOString();

  const { data: tareas, error: e1 } = await insforge.database.from('tarea').select('estado,fecha_completada').eq('asignado_a', usuarioId);
  if (e1) throw e1;
  const list = (tareas ?? []) as Pick<Tarea, 'estado' | 'fecha_completada'>[];

  let activas = 0;
  let atrasadas = 0;
  let completadas7d = 0;
  const abiertas: Tarea['estado'][] = ['pendiente', 'en_progreso', 'bloqueada', 'atrasada'];
  for (const t of list) {
    if (t.estado === 'atrasada') atrasadas += 1;
    if (abiertas.includes(t.estado)) activas += 1;
    if (t.estado === 'completada' && t.fecha_completada && t.fecha_completada >= limIso) completadas7d += 1;
  }

  const { count, error: e2 } = await insforge.database
    .from('objetivo')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'activo' satisfies EstadoObjetivo);
  if (e2) throw e2;

  return {
    activas,
    completadas7d,
    objetivosActivos: count ?? 0,
    atrasadas,
  };
}
