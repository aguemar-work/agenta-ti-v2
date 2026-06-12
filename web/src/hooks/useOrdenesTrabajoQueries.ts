import { keepPreviousData, useQuery } from '@tanstack/react-query';

import {
  getBorradorOTUsuario,
  getOrdenesTrabajoMiembro,
  getOrdenesTrabajoTodas,
  getTareasVinculablesOT,
  getTiposTrabajoOT,
} from '@/api/ordenTrabajo';
import { useWorkspaceId } from '@/hooks/useWorkspaceId';
import { qkWsId } from '@/lib/queryKeys';
import type { Tarea } from '@/types';

export const Q_OT = 'ordenes-trabajo';
export const Q_TIPOS_OT = 'tipos-trabajo-ot';
export const Q_OT_BORRADOR = 'ot-borrador-usuario';

type UseOrdenesTrabajoQueriesInput = {
  usuarioId: string | undefined;
  esJefe: boolean;
  borradorModalAbierto: boolean;
  editandoOT: boolean;
};

export function useOrdenesTrabajoQueries({
  usuarioId,
  esJefe,
  borradorModalAbierto,
  editandoOT,
}: UseOrdenesTrabajoQueriesInput) {
  const workspaceId = useWorkspaceId();

  const { data: ordenes = [], isLoading, isError } = useQuery({
    queryKey: qkWsId(workspaceId, Q_OT, usuarioId, esJefe),
    enabled: Boolean(usuarioId) && Boolean(workspaceId),
    queryFn: () => (esJefe ? getOrdenesTrabajoTodas() : getOrdenesTrabajoMiembro(usuarioId!)),
  });

  const { data: tiposTrabajo = [] } = useQuery({
    queryKey: qkWsId(workspaceId, Q_TIPOS_OT),
    enabled: Boolean(workspaceId),
    queryFn: () => getTiposTrabajoOT(),
    placeholderData: keepPreviousData,
  });

  const { data: tareasVinculables = [] } = useQuery({
    queryKey: qkWsId(workspaceId, 'ot-tareas-vinculables', usuarioId),
    enabled: Boolean(usuarioId) && Boolean(workspaceId),
    queryFn: (): Promise<Pick<Tarea, 'id' | 'titulo' | 'estado'>[]> =>
      getTareasVinculablesOT(usuarioId!),
  });

  const { data: borradorServidor, isLoading: borradorCargando } = useQuery({
    queryKey: qkWsId(workspaceId, Q_OT_BORRADOR, usuarioId),
    enabled: Boolean(borradorModalAbierto && !editandoOT && usuarioId && workspaceId),
    queryFn: () => getBorradorOTUsuario(usuarioId!),
  });

  return {
    ordenes,
    isLoading,
    isError,
    tiposTrabajo,
    tareasVinculables,
    borradorServidor,
    borradorCargando,
  };
}
