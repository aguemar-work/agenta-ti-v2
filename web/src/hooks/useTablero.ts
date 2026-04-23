import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getObjetivosActivos } from '@/api/objetivos';
import { getTareasTablero, moverTareaColumna, type FiltrosTablero } from '@/api/tablero';
import { Q_KPIS, Q_OBJ_PROG } from '@/hooks/useObjetivosMetricas';
import { getInsforge } from '@/lib/insforge';
import type { EstadoTarea } from '@/types';

const Q_TAB = 'tablero';

export function useUsuariosNombreTablero() {
  return useQuery({
    queryKey: ['usuarios-tablero'],
    queryFn: async () => {
      const insforge = getInsforge();
      const { data, error } = await insforge.database.from('usuario').select('id,nombre').eq('activo', true).order('nombre');
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((r: { id: string; nombre: string }) => [r.id, r.nombre])) as Record<
        string,
        string
      >;
    },
  });
}

export function useObjetivosTablero() {
  return useQuery({
    queryKey: ['objetivos-activos-tablero'],
    queryFn: () => getObjetivosActivos(),
  });
}

export function useTareasTableroQuery(filtros: FiltrosTablero, enabled = true) {
  return useQuery({
    queryKey: [Q_TAB, filtros],
    enabled: enabled && Boolean(filtros.usuarioId && filtros.usuarioId !== ''),
    queryFn: () => getTareasTablero(filtros),
  });
}

export { agruparTareasTablero } from '@/api/tablero';

export function useMoverColumnaMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { tareaId: string; nuevoEstado: EstadoTarea; usuarioActorId: string; justificacion?: string }) =>
      moverTareaColumna(p.tareaId, p.nuevoEstado, p.usuarioActorId, p.justificacion),
    onSuccess: async () => {
      await qc.invalidateQueries({ refetchType: 'active', queryKey: [Q_TAB] });
      await qc.invalidateQueries({ refetchType: 'active', queryKey: ['tareas-hoy'] });
      await qc.invalidateQueries({ refetchType: 'active', queryKey: ['semana'] });
      await qc.invalidateQueries({ refetchType: 'active', queryKey: ['planificacion'] });
      await qc.invalidateQueries({ refetchType: 'active', queryKey: [Q_OBJ_PROG] });
      await qc.invalidateQueries({ refetchType: 'active', queryKey: [Q_KPIS] });
    },
  });
}
