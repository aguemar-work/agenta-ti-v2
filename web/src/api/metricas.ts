import { getInsforge } from '@/lib/insforge';
import type { EstadoOT } from '@/api/ordenTrabajo';

export type OtEstadoCount = Partial<Record<EstadoOT, number>>;

export async function getOtEstadoCounts(desde: string, hasta: string): Promise<OtEstadoCount> {
  const { data, error } = await getInsforge().database
    .from('orden_trabajo')
    .select('estado')
    .gte('created_at', `${desde}T00:00:00.000Z`)
    .lte('created_at', `${hasta}T23:59:59.999Z`);
  if (error) throw error;

  const counts: OtEstadoCount = {};
  for (const row of data ?? []) {
    const e = (row as { estado: EstadoOT }).estado;
    counts[e] = (counts[e] ?? 0) + 1;
  }
  return counts;
}
