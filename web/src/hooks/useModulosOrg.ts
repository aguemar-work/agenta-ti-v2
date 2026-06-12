import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchModulosOrg,
  setModuloOrg,
  type SetModuloResult,
} from '@/api/plataforma';
import { useEsPlataformaOwner } from '@/hooks/useEsPlataformaOwner';
import { useAuthStore } from '@/store/authStore';

export function modulosOrgQueryKey(orgId: string) {
  return ['plataforma', 'modulos', orgId] as const;
}

export function useModulosOrg(orgId: string | null | undefined, queryEnabled = true) {
  const usuarioId = useAuthStore((s) => s.usuario?.id);
  const { data: esOwner } = useEsPlataformaOwner();

  return useQuery({
    queryKey: orgId ? modulosOrgQueryKey(orgId) : ['plataforma', 'modulos', null],
    queryFn: () => fetchModulosOrg(orgId!),
    enabled: !!orgId && !!usuarioId && esOwner === true && queryEnabled,
    staleTime: 30_000,
    retry: false,
  });
}

export type SetModuloOrgInput = {
  modulo: string;
  activo: boolean;
};

export function useSetModuloOrg(
  orgId: string,
  onSuccess?: (result: SetModuloResult) => void,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ modulo, activo }: SetModuloOrgInput) =>
      setModuloOrg(orgId, modulo, activo),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: modulosOrgQueryKey(orgId) });
      onSuccess?.(result);
    },
  });
}
