import { useQuery } from '@tanstack/react-query';

import { getKpisComparativa, getKpisPorSemana, getKpisRango, getKpisUsuario, getObjetivosConProgreso } from '@/api/objetivosMetricas';
import { useWorkspaceId } from '@/hooks/useWorkspaceId';
import { qkWsId } from '@/lib/queryKeys';

export const Q_OBJ_PROG = 'objetivos-progreso';
export const Q_KPIS = 'sgtd-kpis';

export function useObjetivosProgreso() {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: qkWsId(workspaceId, Q_OBJ_PROG),
    enabled: Boolean(workspaceId),
    queryFn: () => getObjetivosConProgreso(),
  });
}

export function useKpisUsuario(usuarioId: string | undefined) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: qkWsId(workspaceId, Q_KPIS, usuarioId),
    enabled: Boolean(usuarioId) && Boolean(workspaceId),
    queryFn: () => getKpisUsuario(usuarioId!),
  });
}

export function useKpisRango(desde: string, hasta: string, usuarioId?: string) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: qkWsId(workspaceId, 'metricas-rango', desde, hasta, usuarioId),
    enabled: Boolean(desde && hasta) && Boolean(workspaceId),
    queryFn: () => getKpisRango(desde, hasta, usuarioId),
  });
}

export function useKpisPorSemana(desde: string, hasta: string, usuarioId?: string) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: qkWsId(workspaceId, 'metricas-semanas', desde, hasta, usuarioId),
    enabled: Boolean(desde && hasta) && Boolean(workspaceId),
    queryFn: () => getKpisPorSemana(desde, hasta, usuarioId),
  });
}

export function useKpisComparativa(desde: string, hasta: string, enabled: boolean) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: qkWsId(workspaceId, 'metricas-comparativa', desde, hasta),
    enabled: enabled && Boolean(desde && hasta) && Boolean(workspaceId),
    queryFn: () => getKpisComparativa(desde, hasta),
  });
}
