import { useQuery } from '@tanstack/react-query';

import { getOtEstadoCounts, type OtEstadoCount } from '@/api/metricas';
import { useWorkspaceId } from '@/hooks/useWorkspaceId';
import { qkWsId } from '@/lib/queryKeys';

export type { OtEstadoCount };

export function useMetricasOT(desde: string, hasta: string, enabled = true) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: qkWsId(workspaceId, 'metricas-ot', desde, hasta),
    enabled: enabled && Boolean(desde && hasta) && Boolean(workspaceId),
    queryFn: () => getOtEstadoCounts(desde, hasta),
    staleTime: 2 * 60 * 1000,
  });
}
