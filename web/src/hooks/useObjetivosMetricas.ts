import { useQuery } from '@tanstack/react-query';

import { getKpisComparativa, getKpisRangoYSemana, getKpisUsuario, getObjetivosConProgreso } from '@/api/objetivosMetricas';
import { useWorkspaceId } from '@/hooks/useWorkspaceId';
import { qkWsId } from '@/lib/queryKeys';

export const Q_OBJ_PROG = 'objetivos-progreso';
export const Q_KPIS = 'sgtd-kpis';

const METRICAS_STALE = 5 * 60 * 1000;

export function useObjetivosProgreso() {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: qkWsId(workspaceId, Q_OBJ_PROG),
    enabled: Boolean(workspaceId),
    queryFn: () => getObjetivosConProgreso(),
    staleTime: METRICAS_STALE,
  });
}

export function useKpisUsuario(usuarioId: string | undefined) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: qkWsId(workspaceId, Q_KPIS, usuarioId),
    enabled: Boolean(usuarioId) && Boolean(workspaceId),
    queryFn: () => getKpisUsuario(usuarioId!),
    staleTime: METRICAS_STALE,
  });
}

/** Fetch único a `tarea_activa` que computa KPIs y agrupación semanal en la misma pasada. */
export function useKpisRangoYSemana(desde: string, hasta: string, usuarioId?: string) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: qkWsId(workspaceId, 'metricas-rango-semana', desde, hasta, usuarioId),
    enabled: Boolean(desde && hasta) && Boolean(workspaceId),
    queryFn: () => getKpisRangoYSemana(desde, hasta, usuarioId),
    staleTime: METRICAS_STALE,
  });
}

export function useKpisComparativa(desde: string, hasta: string, enabled: boolean) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: qkWsId(workspaceId, 'metricas-comparativa', desde, hasta),
    enabled: enabled && Boolean(desde && hasta) && Boolean(workspaceId),
    queryFn: () => getKpisComparativa(desde, hasta),
    staleTime: METRICAS_STALE,
  });
}
