import { useQuery } from '@tanstack/react-query';

import { getKpisComparativa, getKpisPorSemana, getKpisRango, getKpisUsuario, getObjetivosConProgreso } from '@/api/objetivosMetricas';

export const Q_OBJ_PROG = 'objetivos-progreso';
export const Q_KPIS = 'sgtd-kpis';

export function useObjetivosProgreso() {
  return useQuery({
    queryKey: [Q_OBJ_PROG],
    queryFn: () => getObjetivosConProgreso(),
  });
}

export function useKpisUsuario(usuarioId: string | undefined) {
  return useQuery({
    queryKey: [Q_KPIS, usuarioId],
    enabled: Boolean(usuarioId),
    queryFn: () => getKpisUsuario(usuarioId!),
  });
}

export function useKpisRango(desde: string, hasta: string, usuarioId?: string) {
  return useQuery({
    queryKey: ['metricas-rango', desde, hasta, usuarioId],
    enabled: Boolean(desde && hasta),
    queryFn: () => getKpisRango(desde, hasta, usuarioId),
  });
}

export function useKpisPorSemana(desde: string, hasta: string, usuarioId?: string) {
  return useQuery({
    queryKey: ['metricas-semanas', desde, hasta, usuarioId],
    enabled: Boolean(desde && hasta),
    queryFn: () => getKpisPorSemana(desde, hasta, usuarioId),
  });
}

export function useKpisComparativa(desde: string, hasta: string, enabled: boolean) {
  return useQuery({
    queryKey: ['metricas-comparativa', desde, hasta],
    enabled: enabled && Boolean(desde && hasta),
    queryFn: () => getKpisComparativa(desde, hasta),
  });
}
