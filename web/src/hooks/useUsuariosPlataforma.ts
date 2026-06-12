import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  asignarUsuarioAOrg,
  fetchUsuariosPlataforma,
  type AsignarUsuarioResult,
} from '@/api/plataforma';
import { useEsPlataformaOwner } from '@/hooks/useEsPlataformaOwner';
import { useAuthStore } from '@/store/authStore';

export const USUARIOS_PLATAFORMA_QUERY_KEY = ['plataforma', 'usuarios'] as const;

export function useUsuariosPlataforma() {
  const usuarioId = useAuthStore((s) => s.usuario?.id);
  const { data: esOwner } = useEsPlataformaOwner();

  return useQuery({
    queryKey: USUARIOS_PLATAFORMA_QUERY_KEY,
    queryFn: fetchUsuariosPlataforma,
    enabled: !!usuarioId && esOwner === true,
    staleTime: 60_000,
  });
}

export type AsignarUsuarioInput = {
  usuarioId: string;
  orgId: string;
  rol: 'jefe' | 'miembro';
};

export function useAsignarUsuario(
  onSuccess?: (result: AsignarUsuarioResult) => void,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ usuarioId, orgId, rol }: AsignarUsuarioInput) =>
      asignarUsuarioAOrg(usuarioId, orgId, rol),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: USUARIOS_PLATAFORMA_QUERY_KEY });
      onSuccess?.(result);
    },
  });
}
