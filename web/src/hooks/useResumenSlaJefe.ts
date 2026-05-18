import { useQuery } from '@tanstack/react-query';

import { contarAlertasSla, getResumenSlaJefe, type ResumenSlaJefe } from '@/api/sla';
import { selectEsJefe, useAuthStore } from '@/store/authStore';

export const Q_SLA_RESUMEN = ['sla', 'resumen-jefe'] as const;

export function useResumenSlaJefe(options?: { enabled?: boolean }) {
  const esJefe = useAuthStore(selectEsJefe);
  const enabled = (options?.enabled ?? true) && esJefe;

  return useQuery({
    queryKey: Q_SLA_RESUMEN,
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
