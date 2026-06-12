import { useQuery } from '@tanstack/react-query';

import {
  fetchEsPlataformaOwner,
  plataformaEsOwnerQueryKey,
} from '@/api/plataforma';
import { useAuthStore } from '@/store/authStore';

const ES_OWNER_STALE_MS = 5 * 60_000;

export function useEsPlataformaOwner() {
  const usuarioId = useAuthStore((s) => s.usuario?.id);
  return useQuery({
    queryKey: plataformaEsOwnerQueryKey(usuarioId),
    queryFn: fetchEsPlataformaOwner,
    enabled: !!usuarioId,
    staleTime: ES_OWNER_STALE_MS,
    placeholderData: (prev) => prev,
  });
}
