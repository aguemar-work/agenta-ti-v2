import { useQuery } from '@tanstack/react-query';

import { getKpisUsuario, getObjetivosConProgreso } from '@/api/objetivosMetricas';

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
