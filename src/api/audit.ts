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
