import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  convertirNotaEnEvento,
  convertirNotaEnTarea,
  getNotasBitacora,
  getNotasBitacoraEquipo,
  insertarNota,
} from '@/api/bitacora';
import type { Tarea, TipoEvento, VisibilidadBitacora } from '@/types';

export const Q_BITACORA = 'bitacora-notas';

export function useNotasBitacora(usuarioId: string | undefined, esJefe: boolean) {
  return useQuery({
    queryKey: [Q_BITACORA, usuarioId, esJefe],
    enabled: Boolean(usuarioId),
    queryFn: () => (esJefe ? getNotasBitacoraEquipo() : getNotasBitacora(usuarioId!)),
  });
}

export function useBitacoraMutations(usuarioId: string | undefined, esJefe: boolean) {
  const qc = useQueryClient();

  const invalidate = async () => {
    await qc.invalidateQueries({ refetchType: 'active', queryKey: [Q_BITACORA, usuarioId, esJefe] });
    await qc.invalidateQueries({ refetchType: 'active', queryKey: ['hoy-notas-bitacora', usuarioId] });
    await qc.invalidateQueries({ refetchType: 'active', queryKey: ['semana'] });
    await qc.invalidateQueries({ refetchType: 'active', queryKey: ['tareas-hoy', usuarioId] });
  };

  const mInsertar = useMutation({
    mutationFn: (input: { usuario_id: string; contenido: string; visibilidad: VisibilidadBitacora }) => insertarNota(input),
    onSuccess: invalidate,
  });

  const mConvertirTarea = useMutation({
    mutationFn: (input: {
      notaId: string;
      titulo: string;
      descripcion: string;
      prioridad: Tarea['prioridad'];
      fecha_planificada: string;
      asignado_a: string;
      creado_por: string;
    }) => convertirNotaEnTarea(input),
    onSuccess: invalidate,
  });

  const mConvertirEvento = useMutation({
    mutationFn: (input: {
      notaId: string;
      titulo: string;
      tipo: TipoEvento;
      fecha_dia: string;
      hora_inicio: string;
      hora_fin: string;
      usuario_id: string;
      es_recurrente: boolean;
    }) => convertirNotaEnEvento(input),
    onSuccess: invalidate,
  });

  return {
    insertarNota: mInsertar.mutateAsync,
    convertirEnTarea: mConvertirTarea.mutateAsync,
    convertirEnEvento: mConvertirEvento.mutateAsync,
    isPending: mInsertar.isPending || mConvertirTarea.isPending || mConvertirEvento.isPending,
  };
}
