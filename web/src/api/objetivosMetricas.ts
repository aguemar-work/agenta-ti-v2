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

export type KpisRango = {
  total: number;
  completadas: number;
  en_progreso: number;
  pendientes: number;
  atrasadas: number;
  bloqueadas: number;
  reprogramadas: number;
  incidencias: number;
};

export type KpisPorSemana = {
  semana: string;
  semanaISO: string;
  completadas: number;
  atrasadas: number;
  bloqueadas: number;
  reprogramadas: number;
  en_progreso: number;
  pendientes: number;
  total: number;
};

export type KpisComparativaMiembro = {
  usuarioId: string;
  nombre: string;
  completadas: number;
  atrasadas: number;
  bloqueadas: number;
  reprogramadas: number;
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

export async function getKpisRango(
  desde: string,
  hasta: string,
  usuarioId?: string,
): Promise<KpisRango> {
  const insforge = getInsforge();
  let q = insforge.database
    .from('tarea')
    .select('estado,es_imprevisto,fecha_planificada')
    .gte('fecha_planificada', desde)
    .lte('fecha_planificada', hasta)
    .neq('estado', 'cancelada');
  if (usuarioId) q = q.eq('asignado_a', usuarioId);
  const { data, error } = await q;
  if (error) throw error;
  const list = (data ?? []) as Pick<Tarea, 'estado' | 'es_imprevisto' | 'fecha_planificada'>[];

  let total = 0;
  let completadas = 0;
  let en_progreso = 0;
  let pendientes = 0;
  let atrasadas = 0;
  let bloqueadas = 0;
  let reprogramadas = 0;
  let incidencias = 0;

  for (const t of list) {
    if (t.es_imprevisto) {
      incidencias++;
      continue;
    }
    total++;
    if (t.estado === 'completada') completadas++;
    else if (t.estado === 'en_progreso') en_progreso++;
    else if (t.estado === 'pendiente') pendientes++;
    else if (t.estado === 'atrasada') atrasadas++;
    else if (t.estado === 'bloqueada') bloqueadas++;
    else if (t.estado === 'reprogramada') reprogramadas++;
  }

  return { total, completadas, en_progreso, pendientes, atrasadas, bloqueadas, reprogramadas, incidencias };
}

export async function getKpisPorSemana(
  desde: string,
  hasta: string,
  usuarioId?: string,
): Promise<KpisPorSemana[]> {
  const insforge = getInsforge();
  let q = insforge.database
    .from('tarea')
    .select('estado,semana_planificada,es_imprevisto')
    .gte('fecha_planificada', desde)
    .lte('fecha_planificada', hasta)
    .neq('estado', 'cancelada')
    .not('semana_planificada', 'is', null);
  if (usuarioId) q = q.eq('asignado_a', usuarioId);
  const { data, error } = await q;
  if (error) throw error;
  const list = (data ?? []) as Pick<Tarea, 'estado' | 'semana_planificada' | 'es_imprevisto'>[];

  const semMap = new Map<string, KpisPorSemana>();
  for (const t of list) {
    if (t.es_imprevisto || !t.semana_planificada) continue;
    const sem = t.semana_planificada;
    if (!semMap.has(sem)) {
      semMap.set(sem, {
        semana: `Sem ${sem.slice(4)}`,
        semanaISO: sem,
        completadas: 0,
        atrasadas: 0,
        bloqueadas: 0,
        reprogramadas: 0,
        en_progreso: 0,
        pendientes: 0,
        total: 0,
      });
    }
    const row = semMap.get(sem)!;
    row.total++;
    if (t.estado === 'completada') row.completadas++;
    else if (t.estado === 'atrasada') row.atrasadas++;
    else if (t.estado === 'bloqueada') row.bloqueadas++;
    else if (t.estado === 'reprogramada') row.reprogramadas++;
    else if (t.estado === 'en_progreso') row.en_progreso++;
    else if (t.estado === 'pendiente') row.pendientes++;
  }

  return Array.from(semMap.values()).sort((a, b) => a.semanaISO.localeCompare(b.semanaISO));
}

export async function getKpisComparativa(
  desde: string,
  hasta: string,
): Promise<KpisComparativaMiembro[]> {
  const insforge = getInsforge();
  const { data: usuarios, error: e1 } = await insforge.database
    .from('usuario')
    .select('id,nombre')
    .eq('activo', true)
    .eq('rol', 'miembro')
    .order('nombre');
  if (e1) throw e1;

  const { data, error: e2 } = await insforge.database
    .from('tarea')
    .select('asignado_a,estado,es_imprevisto')
    .gte('fecha_planificada', desde)
    .lte('fecha_planificada', hasta)
    .neq('estado', 'cancelada')
    .eq('es_imprevisto', false);
  if (e2) throw e2;

  const list = (data ?? []) as Pick<Tarea, 'asignado_a' | 'estado'>[];
  const byUser = new Map<string, Omit<KpisComparativaMiembro, 'usuarioId' | 'nombre'>>();

  for (const u of (usuarios ?? []) as { id: string; nombre: string }[]) {
    byUser.set(u.id, { completadas: 0, atrasadas: 0, bloqueadas: 0, reprogramadas: 0 });
  }
  for (const t of list) {
    const row = byUser.get(t.asignado_a);
    if (!row) continue;
    if (t.estado === 'completada') row.completadas++;
    else if (t.estado === 'atrasada') row.atrasadas++;
    else if (t.estado === 'bloqueada') row.bloqueadas++;
    else if (t.estado === 'reprogramada') row.reprogramadas++;
  }

  return (usuarios ?? []).map((u: { id: string; nombre: string }) => ({
    usuarioId: u.id,
    nombre: u.nombre,
    ...byUser.get(u.id)!,
  }));
}
