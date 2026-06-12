import { useQuery } from '@tanstack/react-query';

import { contarAlertasSla, getResumenSlaJefe, type ResumenSlaJefe } from '@/api/sla';
import { useWorkspaceId } from '@/hooks/useWorkspaceId';
import { qkWsId } from '@/lib/queryKeys';
import { useWorkspaceStore } from '@/store/workspaceStore';

export const Q_SLA_RESUMEN_ROOT = 'sla';

export function useResumenSlaJefe(options?: { enabled?: boolean }) {
  const esJefe = useWorkspaceStore((s) => s.esJefe());
  const workspaceId = useWorkspaceId();
  const enabled = (options?.enabled ?? true) && esJefe && Boolean(workspaceId);

  return useQuery({
    queryKey: qkWsId(workspaceId, Q_SLA_RESUMEN_ROOT, 'resumen-jefe'),
    queryFn:  () => getResumenSlaJefe(),
    enabled,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useSlaAlertCount(): number {
  const { data } = useResumenSlaJefe();
  if (!data) return 0;
  return contarAlertasSla(data);
}

export type { ResumenSlaJefe };
