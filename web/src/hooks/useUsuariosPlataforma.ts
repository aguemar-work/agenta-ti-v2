import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  eliminarUsuario,
  fetchUsuariosPlataforma,
} from '@/api/plataforma';
import {
  invitarAWorkspace,
  type InvitarAWorkspaceInput,
  type InvitarResult,
} from '@/api/invitacion';
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

/** Invita a un workspace (email nuevo o existente). Reemplaza asignación directa 049. */
export function useInvitarAWorkspace(onSuccess?: (result: InvitarResult) => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: InvitarAWorkspaceInput) => invitarAWorkspace(input),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: USUARIOS_PLATAFORMA_QUERY_KEY });
      onSuccess?.(result);
    },
  });
}

/** @deprecated Alias de useInvitarAWorkspace — misma mutación, contrato 057. */
export type AsignarUsuarioInput = InvitarAWorkspaceInput & { usuarioId?: string };

export function useAsignarUsuario(
  onSuccess?: (result: InvitarResult) => void,
) {
  return useInvitarAWorkspace(onSuccess as ((result: InvitarResult) => void) | undefined);
}

export function useInvitarUsuario(onSuccess?: (result: InvitarResult) => void) {
  return useInvitarAWorkspace(onSuccess);
}

export function useEliminarUsuario(onSuccess?: () => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (usuarioId: string) => eliminarUsuario(usuarioId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: USUARIOS_PLATAFORMA_QUERY_KEY });
      onSuccess?.();
    },
  });
}

// Re-export para compatibilidad de tipos en modales legacy
export type { InvitarResult as InvitarUsuarioResult, InvitarResult as AsignarUsuarioResult };
