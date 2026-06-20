import { useQuery } from '@tanstack/react-query';

import {
  crearIncidencia,
  getIncidenciasAbiertas,
  getIncidenciasDelDia,
  getNotasBitacoraRecientes,
} from '@/api/hoyColumnas';
import { useWorkspaceId } from '@/hooks/useWorkspaceId';
import { qkWsId } from '@/lib/queryKeys';

export const Q_INC_HOY   = 'hoy-incidencias';
export const Q_NOTAS_HOY = 'hoy-notas-bitacora';

export function useIncidenciasHoy(usuarioId: string | undefined) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: qkWsId(workspaceId, Q_INC_HOY, usuarioId),
    enabled:  Boolean(usuarioId) && Boolean(workspaceId),
    queryFn:  () => getIncidenciasAbiertas(usuarioId!),
  });
}

export function useIncidenciasDelDia(usuarioId: string | undefined, ymd: string) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: qkWsId(workspaceId, Q_INC_HOY, usuarioId, ymd),
    enabled:  Boolean(usuarioId) && Boolean(workspaceId),
    queryFn:  () => getIncidenciasDelDia(usuarioId!, ymd),
  });
}

export function useNotasBitacoraHoy(usuarioId: string | undefined) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: qkWsId(workspaceId, Q_NOTAS_HOY, usuarioId),
    enabled:  Boolean(usuarioId) && Boolean(workspaceId),
    queryFn:  () => getNotasBitacoraRecientes(usuarioId!, 8),
  });
}

export { crearIncidencia };
