import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { fetchOrgsDesactivadas, desactivarOrg, reactivarOrg } from '@/api/plataforma';
import { refrescarOrgs } from '@/api/organizacion';

export const ORGS_DESACTIVADAS_KEY = ['plataforma', 'orgsDesactivadas'] as const;

export function useOrgsDesactivadas(enabled = true) {
  return useQuery({
    queryKey: ORGS_DESACTIVADAS_KEY,
    queryFn: fetchOrgsDesactivadas,
    enabled,
    staleTime: 30_000,
    retry: false,
  });
}

export function useDesactivarOrg() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: desactivarOrg,
    onSuccess: async (result) => {
      toast.success(`"${result.nombre}" movida a la papelera.`);
      await Promise.all([
        refrescarOrgs(),
        qc.invalidateQueries({ queryKey: ORGS_DESACTIVADAS_KEY }),
      ]);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'No se pudo mover la organización a la papelera.';
      toast.error(msg);
    },
  });
}

export function useReactivarOrg() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: reactivarOrg,
    onSuccess: async (result) => {
      toast.success(`"${result.nombre}" reactivada.`);
      await Promise.all([
        refrescarOrgs(),
        qc.invalidateQueries({ queryKey: ORGS_DESACTIVADAS_KEY }),
      ]);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'No se pudo reactivar la organización.';
      toast.error(msg);
    },
  });
}
