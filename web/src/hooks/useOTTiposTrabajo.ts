import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { crearTipoTrabajoOT, toggleTipoTrabajoOT, type TipoTrabajoOT } from '@/api/ordenTrabajo';
import { getWorkspaceId } from '@/store/workspaceStore';
import { qkWsId } from '@/lib/queryKeys';
import { Q_TIPOS_OT } from '@/hooks/useOrdenesTrabajoQueries';

/**
 * Gestión de tipos de trabajo de OT: crear, activar/desactivar.
 * Recibe `tiposTrabajo` del orquestador (ya en caché por `useOrdenesTrabajoQueries`).
 */
export function useOTTiposTrabajo(tiposTrabajo: TipoTrabajoOT[]) {
  const qc = useQueryClient();
  const [nuevoTipoNombre, setNuevoTipoNombre] = useState('');

  const invalidarTipos = () =>
    qc.invalidateQueries({ refetchType: 'active', queryKey: qkWsId(getWorkspaceId(), Q_TIPOS_OT) });

  const mutCrearTipo = useMutation({
    mutationFn: () => crearTipoTrabajoOT(nuevoTipoNombre),
    onSuccess: async () => {
      await invalidarTipos();
      setNuevoTipoNombre('');
      toast.success('Tipo de trabajo agregado');
    },
    onError: (err) => {
      console.error('[mutCrearTipo]', err);
      toast.error('No se pudo agregar el tipo.');
    },
  });

  const mutToggleTipo = useMutation({
    mutationFn: ({ id, activo }: { id: TipoTrabajoOT['id']; activo: boolean }) => toggleTipoTrabajoOT(id, activo),
    onMutate: async ({ id, activo }) => {
      await qc.cancelQueries({ queryKey: qkWsId(getWorkspaceId(), Q_TIPOS_OT) });
      const prev = qc.getQueryData([Q_TIPOS_OT]);
      qc.setQueryData([Q_TIPOS_OT], (old: TipoTrabajoOT[]) =>
        old.map((t) => (t.id === id ? { ...t, activo } : t)),
      );
      return { prev };
    },
    onError: (err, _, ctx) => {
      if (ctx?.prev) qc.setQueryData([Q_TIPOS_OT], ctx.prev);
      console.error('[mutToggleTipo]', err);
      toast.error('No se pudo actualizar el tipo.');
    },
    onSettled: () => { void invalidarTipos(); },
  });

  return {
    tiposActivos:    tiposTrabajo.filter((t) => t.activo),
    tiposInactivos:  tiposTrabajo.filter((t) => !t.activo),
    nuevoTipoNombre, setNuevoTipoNombre,
    canCrearTipo:    nuevoTipoNombre.trim().length > 0 && !mutCrearTipo.isPending,
    mutCrearTipo,
    mutToggleTipo,
  };
}
