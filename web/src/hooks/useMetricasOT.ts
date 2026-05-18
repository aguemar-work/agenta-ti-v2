import { useQuery } from '@tanstack/react-query';
import { getInsforge } from '@/lib/insforge';
import type { EstadoOT } from '@/api/ordenTrabajo';

export type OtEstadoCount = Partial<Record<EstadoOT, number>>;

export function useMetricasOT(desde: string, hasta: string, enabled = true) {
  return useQuery({
    queryKey: ['metricas-ot', desde, hasta],
    enabled: enabled && Boolean(desde && hasta),
    queryFn: async (): Promise<OtEstadoCount> => {
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
    },
    staleTime: 2 * 60 * 1000,
  });
}
