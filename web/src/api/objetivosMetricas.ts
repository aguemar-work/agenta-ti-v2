import { getInsforge } from '@/lib/insforge';
import { fechaLocalYmd } from '@/lib/fecha';
import { estadoEfectivoTablero, type TareaParaEstadoEfectivo } from '@/lib/tableroEstado';
import { TAREA_ACTIVA } from '@/lib/tareaTables';
import type { EstadoObjetivo, Objetivo, Tarea } from '@/types';

function parseObjetivo(row: Record<string, unknown>): Objetivo {
  return row as unknown as Objetivo;
}

function hoyYmdMetricas(): string {
  return fechaLocalYmd(new Date());
}

/** Campos mínimos para `claveVisualTarea` desde `tarea_activa`. */
const SELECT_METRICA_TAREA =
  'estado,tipo,fecha_planificada,situacion,reprogramaciones' as const;

function acumularEstadoEfectivo(
  t: TareaParaEstadoEfectivo,
  hoyYmd: string,
  buckets: {
    completadas: number;
    en_progreso: number;
    pendientes: number;
    atrasadas: number;
    reprogramadas: number;
  },
): void {
  const est = estadoEfectivoTablero(t, hoyYmd);
  if (est === 'completada') buckets.completadas += 1;
  else if (est === 'en_progreso') buckets.en_progreso += 1;
  else if (est === 'pendiente') buckets.pendientes += 1;
  else if (est === 'atrasada') buckets.atrasadas += 1;
  else if (est === 'reprogramada') buckets.reprogramadas += 1;
}

/** Solo contadores usados en la comparativa por miembro (sin pendientes / en progreso). */
function acumularEstadoEfectivoComparativa(
  t: TareaParaEstadoEfectivo,
  hoyYmd: string,
  buckets: Omit<KpisComparativaMiembro, 'usuarioId' | 'nombre'>,
): void {
  const est = estadoEfectivoTablero(t, hoyYmd);
  if (est === 'completada') buckets.completadas += 1;
  else if (est === 'atrasada') buckets.atrasadas += 1;
  else if (est === 'reprogramada') buckets.reprogramadas += 1;
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
  reprogramadas: number;
  incidencias: number;
};

export type KpisPorSemana = {
  semana: string;
  semanaISO: string;
  completadas: number;
  atrasadas: number;
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
  reprogramadas: number;
};

export async function getObjetivosConProgreso(): Promise<ObjetivoConProgreso[]> {
  const { data, error } = await getInsforge().database.rpc('sgtd_objetivos_con_progreso');
  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => {
    const r = row;
    const base = parseObjetivo(r);
    return {
      ...base,
      total_tareas: Number(r.total_tareas ?? 0),
      completadas: Number(r.completadas ?? 0),
      pct: Number(r.pct ?? 0),
    };
  });
}

export async function getKpisUsuario(usuarioId: string): Promise<KpisUsuario> {
  const insforge = getInsforge();
  const lim = new Date();
  lim.setDate(lim.getDate() - 7);
  const limIso = lim.toISOString();
  const hoyYmd = hoyYmdMetricas();

  const { data: tareas, error: e1 } = await insforge.database
    .from(TAREA_ACTIVA)
    .select(`${SELECT_METRICA_TAREA},fecha_completada`)
    .eq('asignado_a', usuarioId);
  if (e1) throw e1;
  const list = (tareas ?? []) as Pick<
    Tarea,
    'estado' | 'fecha_completada' | 'tipo' | 'fecha_planificada' | 'situacion' | 'reprogramaciones'
  >[];

  let activas = 0;
  let atrasadas = 0;
  let completadas7d = 0;
  for (const t of list) {
    const est = estadoEfectivoTablero(t, hoyYmd);
    if (est === 'atrasada') atrasadas += 1;
    if (est !== 'completada' && est !== 'cancelada') activas += 1;
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

export type KpisMetricasCompletas = {
  kpis: KpisRango;
  porSemana: KpisPorSemana[];
};

/**
 * Único fetch a `tarea_activa` para el rango de fechas — calcula KPIs y
 * agrupación semanal en la misma pasada (antes eran 2 queries paralelas).
 */
export async function getKpisRangoYSemana(
  desde: string,
  hasta: string,
  usuarioId?: string,
): Promise<KpisMetricasCompletas> {
  const insforge = getInsforge();
  const hoyYmd = hoyYmdMetricas();
  let q = insforge.database
    .from(TAREA_ACTIVA)
    .select(`${SELECT_METRICA_TAREA},semana_planificada,es_imprevisto`)
    .gte('fecha_planificada', desde)
    .lte('fecha_planificada', hasta)
    .neq('estado', 'cancelada');
  if (usuarioId) q = q.eq('asignado_a', usuarioId);
  const { data, error } = await q;
  if (error) throw error;

  const list = (data ?? []) as Pick<
    Tarea,
    'estado' | 'semana_planificada' | 'es_imprevisto' | 'fecha_planificada' | 'tipo' | 'situacion' | 'reprogramaciones'
  >[];

  const buckets = { completadas: 0, en_progreso: 0, pendientes: 0, atrasadas: 0, reprogramadas: 0 };
  let total = 0;
  let incidencias = 0;
  const semMap = new Map<string, KpisPorSemana>();

  for (const t of list) {
    if (t.es_imprevisto) { incidencias++; continue; }
    total++;
    acumularEstadoEfectivo(t, hoyYmd, buckets);
    if (!t.semana_planificada) continue;
    const sem = t.semana_planificada;
    if (!semMap.has(sem)) {
      semMap.set(sem, {
        semana: `Sem ${sem.slice(4)}`,
        semanaISO: sem,
        completadas: 0, atrasadas: 0, reprogramadas: 0, en_progreso: 0, pendientes: 0, total: 0,
      });
    }
    const row = semMap.get(sem)!;
    row.total++;
    acumularEstadoEfectivo(t, hoyYmd, row);
  }

  return {
    kpis: { total, incidencias, ...buckets },
    porSemana: Array.from(semMap.values()).sort((a, b) => a.semanaISO.localeCompare(b.semanaISO)),
  };
}

export async function getKpisComparativa(
  desde: string,
  hasta: string,
): Promise<KpisComparativaMiembro[]> {
  const insforge = getInsforge();
  const hoyYmd = hoyYmdMetricas();
  const { data: usuarios, error: e1 } = await insforge.database
    .from('usuario')
    .select('id,nombre')
    .eq('activo', true)
    .eq('rol', 'miembro')
    .order('nombre');
  if (e1) throw e1;

  const { data, error: e2 } = await insforge.database
    .from(TAREA_ACTIVA)
    .select(`asignado_a,${SELECT_METRICA_TAREA},es_imprevisto`)
    .gte('fecha_planificada', desde)
    .lte('fecha_planificada', hasta)
    .neq('estado', 'cancelada')
    .eq('es_imprevisto', false);
  if (e2) throw e2;

  const list = (data ?? []) as Pick<
    Tarea,
    'asignado_a' | 'estado' | 'fecha_planificada' | 'tipo' | 'situacion' | 'reprogramaciones'
  >[];
  const byUser = new Map<string, Omit<KpisComparativaMiembro, 'usuarioId' | 'nombre'>>();

  for (const u of (usuarios ?? []) as { id: string; nombre: string }[]) {
    byUser.set(u.id, { completadas: 0, atrasadas: 0, reprogramadas: 0 });
  }
  for (const t of list) {
    const row = byUser.get(t.asignado_a);
    if (!row) continue;
    acumularEstadoEfectivoComparativa(t, hoyYmd, row);
  }

  return (usuarios ?? []).map((u: { id: string; nombre: string }) => ({
    usuarioId: u.id,
    nombre: u.nombre,
    ...byUser.get(u.id)!,
  }));
}
