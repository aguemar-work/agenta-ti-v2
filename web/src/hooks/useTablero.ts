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

  async function invalidarTodo() {
    // IMPORTANTE: exact: false para que coincida con queryKey: [Q_TAB, filtros]
    await Promise.all([
      qc.invalidateQueries({ queryKey: [Q_TAB], exact: false }),
      qc.invalidateQueries({ queryKey: ['tareas-hoy'], exact: false }),
      qc.invalidateQueries({ queryKey: ['semana'], exact: false }),
      qc.invalidateQueries({ queryKey: ['planificacion'], exact: false }),
      qc.invalidateQueries({ queryKey: [Q_OBJ_PROG], exact: false }),
      qc.invalidateQueries({ queryKey: [Q_KPIS], exact: false }),
    ]);
  }

  return useMutation({
    mutationFn: (p: { tareaId: string; nuevoEstado: EstadoTarea; usuarioActorId: string; justificacion?: string }) =>
      moverTareaColumna(p.tareaId, p.nuevoEstado, p.usuarioActorId, p.justificacion),
    onSuccess: invalidarTodo,
    // Forzar refetch aunque falle — para mostrar el estado real desde BD
    onError: async (_err, _vars) => {
      await invalidarTodo();
    },
  });
}