import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  getBorradorOTUsuario,
  getOrdenesTrabajoMiembro,
  getOrdenesTrabajoTodas,
  getResumenOTs,
  getTareasVinculablesOT,
  getTiposTrabajoOT,
  OT_PAGE_SIZE,
  type FiltroOTLista,
  type OrdenTrabajo,
  type ResumenOTs,
} from '@/api/ordenTrabajo';
import { useWorkspaceId } from '@/hooks/useWorkspaceId';
import { qkWsId } from '@/lib/queryKeys';
import type { Tarea } from '@/types';

export const Q_OT = 'ordenes-trabajo';
export const Q_TIPOS_OT = 'tipos-trabajo-ot';
export const Q_OT_BORRADOR = 'ot-borrador-usuario';

const RESUMEN_VACIO: ResumenOTs = { activas: 0, pendientes: 0, urgentes: 0, vencidas: 0 };

type UseOrdenesTrabajoQueriesInput = {
  usuarioId: string | undefined;
  esJefe: boolean;
  borradorModalAbierto: boolean;
  editandoOT: boolean;
  /** Filtro resuelto en servidor (auditoría 2026-07-17, P2). */
  filtro?: FiltroOTLista;
};

export function useOrdenesTrabajoQueries({
  usuarioId,
  esJefe,
  borradorModalAbierto,
  editandoOT,
  filtro = 'todos',
}: UseOrdenesTrabajoQueriesInput) {
  const workspaceId = useWorkspaceId();

  // Lista paginada por servidor (antes: fetch completo sin límite + filtro en JS)
  const {
    data: paginas,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: qkWsId(workspaceId, Q_OT, usuarioId, esJefe, filtro),
    enabled: Boolean(usuarioId) && Boolean(workspaceId),
    initialPageParam: 0,
    queryFn: ({ pageParam }): Promise<OrdenTrabajo[]> =>
      esJefe
        ? getOrdenesTrabajoTodas(filtro, pageParam)
        : getOrdenesTrabajoMiembro(usuarioId!, filtro, pageParam),
    getNextPageParam: (ultimaPagina, todas) =>
      ultimaPagina.length === OT_PAGE_SIZE
        ? todas.reduce((n, p) => n + p.length, 0)
        : undefined,
    placeholderData: keepPreviousData,
  });

  const ordenes = useMemo(() => paginas?.pages.flat() ?? [], [paginas]);

  // Contadores exactos en servidor (count head:true), independientes de la página
  const { data: resumen = RESUMEN_VACIO } = useQuery({
    queryKey: qkWsId(workspaceId, Q_OT, 'resumen', esJefe ? 'equipo' : usuarioId),
    enabled: Boolean(usuarioId) && Boolean(workspaceId),
    queryFn: () => getResumenOTs(esJefe ? undefined : usuarioId),
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
    resumen,
    hayMas: hasNextPage ?? false,
    cargarMas: fetchNextPage,
    cargandoMas: isFetchingNextPage,
    tiposTrabajo,
    tareasVinculables,
    borradorServidor,
    borradorCargando,
  };
}
