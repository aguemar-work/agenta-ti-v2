/**
 * hooks/useInvitacionesPendientesPage.ts
 * Pantalla B2: aceptar o rechazar invitaciones pendientes antes del bootstrap operativo.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  aceptarInvitacion,
  fetchInvitacionesPendientes,
  rechazarInvitacion,
  type InvitacionPendiente,
} from '@/api/invitacion';

export const INVITACIONES_PENDIENTES_QUERY_KEY = ['invitaciones', 'pendientes'] as const;

export function useInvitacionesPendientesPage(onAceptada: () => void) {
  const queryClient = useQueryClient();

  const { data: invitaciones, isLoading, isError, refetch } = useQuery({
    queryKey: INVITACIONES_PENDIENTES_QUERY_KEY,
    queryFn: fetchInvitacionesPendientes,
    staleTime: 0,
  });

  const [accionEnCurso, setAccionEnCurso] = useState<string | null>(null);

  const { mutate: aceptar, isPending: aceptando } = useMutation({
    mutationFn: (workspaceId: string) => aceptarInvitacion(workspaceId),
    onMutate: (workspaceId) => { setAccionEnCurso(workspaceId); },
    onSettled: () => { setAccionEnCurso(null); },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: INVITACIONES_PENDIENTES_QUERY_KEY });
      toast.success('Invitación aceptada.');
      onAceptada();
    },
    onError: (err) => {
      console.error('[useInvitacionesPendientesPage.aceptar]', err);
      const msg = (err as { message?: string })?.message ?? 'No se pudo aceptar la invitación.';
      toast.error(msg);
    },
  });

  const { mutate: rechazar, isPending: rechazando } = useMutation({
    mutationFn: (workspaceId: string) => rechazarInvitacion(workspaceId),
    onMutate: (workspaceId) => { setAccionEnCurso(workspaceId); },
    onSettled: () => { setAccionEnCurso(null); },
    onSuccess: async () => {
      const restantes = await refetch();
      toast.success('Invitación rechazada.');
      if (!restantes.data?.length) {
        toast.error('No tienes más invitaciones ni acceso a ningún espacio de trabajo.');
      }
    },
    onError: (err) => {
      console.error('[useInvitacionesPendientesPage.rechazar]', err);
      const msg = (err as { message?: string })?.message ?? 'No se pudo rechazar la invitación.';
      toast.error(msg);
    },
  });

  function estaProcesando(inv: InvitacionPendiente): boolean {
    return accionEnCurso === inv.workspace_id;
  }

  return {
    invitaciones: invitaciones ?? [],
    isLoading,
    isError,
    aceptar,
    rechazar,
    estaProcesando,
    procesando: aceptando || rechazando,
  };
}
