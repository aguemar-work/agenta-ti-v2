import { getInsforge } from '@/lib/insforge';
import type { LogAccion } from '@/types';

function parseLog(row: Record<string, unknown>): LogAccion {
  return row as unknown as LogAccion;
}

/** Entradas de log con justificación pendiente de revisión por el jefe. */
export async function getJustificacionesPendientesJefe(): Promise<LogAccion[]> {
  const insforge = getInsforge();
  const { data, error } = await insforge.database
    .from('log_accion')
    .select('*')
    .eq('leido_por_jefe', false)
    .order('created_at', { ascending: false })
    .limit(80);
  if (error) throw error;
  return (data ?? []).map((r) => parseLog(r as Record<string, unknown>));
}

export async function marcarLogLeidoPorJefe(logId: string): Promise<void> {
  const insforge = getInsforge();
  const { error } = await insforge.database.from('log_accion').update({ leido_por_jefe: true }).eq('id', logId);
  if (error) throw error;
}

export type FiltrosHistorialLog = {
  usuarioId: string | 'todos';
  tipoAccion: import('../types').TipoAccionLog | 'todos';
  pagina: number;
  porPagina: number;
};

export type HistorialLogResult = {
  logs: LogAccion[];
  total: number;
};

/** Historial completo de logs con filtros y paginación. */
export async function getHistorialLogs(filtros: FiltrosHistorialLog): Promise<HistorialLogResult> {
  const insforge = getInsforge();
  let q = insforge.database
    .from('log_accion')
    .select('*', { count: 'exact' });

  if (filtros.usuarioId !== 'todos') {
    q = q.eq('usuario_id', filtros.usuarioId);
  }
  if (filtros.tipoAccion !== 'todos') {
    q = q.eq('tipo_accion', filtros.tipoAccion);
  }

  const desde = filtros.pagina * filtros.porPagina;
  const hasta  = desde + filtros.porPagina - 1;

  const { data, error, count } = await q
    .order('created_at', { ascending: false })
    .range(desde, hasta);

  if (error) throw error;
  return {
    logs: (data ?? []).map((r) => parseLog(r as Record<string, unknown>)),
    total: count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Feed de actividad del equipo
// ---------------------------------------------------------------------------

export type LogActividadItem = {
  id: string;
  tarea_id: string | null;
  tarea_titulo: string | null;
  usuario_id: string;
  usuario_nombre: string;
  tipo_accion: import('../types').TipoAccionLog;
  justificacion: string | null;
  created_at: string;
};

/**
 * Logs de actividad relevantes de la semana para el feed del Jefe.
 * Solo incluye acciones con contenido narrativo: completadas, reprogramadas, bloqueadas.
 */
export async function getActividadEquipoSemana(
  desde: Date,
  hasta: Date,
): Promise<LogActividadItem[]> {
  const insforge = getInsforge();
  const desdeIso = new Date(desde); desdeIso.setHours(0, 0, 0, 0);
  const hastaIso = new Date(hasta); hastaIso.setHours(23, 59, 59, 999);

  const { data, error } = await insforge.database
    .from('log_accion')
    .select(`
      id,
      tarea_id,
      tarea:tarea_id ( titulo ),
      usuario_id,
      usuario:usuario_id ( nombre ),
      tipo_accion,
      justificacion,
      created_at
    `)
    .in('tipo_accion', ['editada', 'reprogramada', 'estado_cambiado', 'cancelada'])
    .gte('created_at', desdeIso.toISOString())
    .lte('created_at', hastaIso.toISOString())
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;

  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    const tarea  = row.tarea  as { titulo: string } | null;
    const usuario = row.usuario as { nombre: string } | null;
    return {
      id:             row.id as string,
      tarea_id:       row.tarea_id as string | null,
      tarea_titulo:   tarea?.titulo ?? null,
      usuario_id:     row.usuario_id as string,
      usuario_nombre: usuario?.nombre ?? '—',
      tipo_accion:    row.tipo_accion as import('../types').TipoAccionLog,
      justificacion:  row.justificacion as string | null,
      created_at:     row.created_at as string,
    };
  });
}