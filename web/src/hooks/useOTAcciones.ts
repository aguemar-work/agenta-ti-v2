import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  aprobarOT, cancelarOrdenTrabajo, completarOT, rechazarOT,
  type OrdenTrabajo,
} from '@/api/ordenTrabajo';
import { getWorkspaceId } from '@/store/workspaceStore';
import { invalidateRelatedQueries } from '@/lib/queryHelpers';
import { qkWsId } from '@/lib/queryKeys';
import { publicarEventoUsuario } from '@/lib/realtimePublish';
import { puedeCompletarOTReceptor } from '@/lib/otComplecion';
import { mensajeErrorInsforge } from '@/lib/insforgeError';
import { labelNumeroOT } from '@/lib/otNumero';
import type { Id, Usuario } from '@/types';

type Params = {
  ordenes: OrdenTrabajo[];
  usuario: Usuario | null | undefined;
};

/**
 * Acciones de estado de OT: aprobar, rechazar, completar, cancelar.
 * Incluye el estado de los modales de confirmación asociados.
 */
export function useOTAcciones({ ordenes, usuario }: Params) {
  const qc = useQueryClient();

  const [modalCompletar, setModalCompletar] = useState<OrdenTrabajo | null>(null);
  const [modalRechazar,  setModalRechazar]  = useState<OrdenTrabajo | null>(null);
  const [motivoRechazo,  setMotivoRechazo]  = useState('');
  const [receptorNombre, setReceptorNombre] = useState('');
  const [receptorDni,    setReceptorDni]    = useState('');
  const [receptorCargo,  setReceptorCargo]  = useState('');
  const [obsCierre,      setObsCierre]      = useState('');

  const invalidarOTs = () => invalidateRelatedQueries(qc, ['ot']);
  const invalidarPlanOts = () =>
    qc.invalidateQueries({ queryKey: qkWsId(getWorkspaceId(), 'planificacion', 'ots-pendientes') });

  const mutAprobar = useMutation({
    mutationFn: (otId: Id) => aprobarOT(otId, usuario!.id),
    onSuccess: async (_data, otId) => {
      await invalidarOTs();
      void invalidarPlanOts();
      toast.success('OT aprobada');
      const ot = ordenes.find((o) => o.id === otId);
      if (ot) {
        void publicarEventoUsuario({
          tipo:      'ot_aprobada',
          usuarioId: ot.creado_por,
          otId:      ot.id,
          numero:    labelNumeroOT(ot.numero),
        });
      }
    },
    onError: (err) => { console.error('[mutAprobarOT]', err); toast.error('No se pudo aprobar la OT.'); },
  });

  const mutRechazar = useMutation({
    mutationFn: ({ otId, motivo }: { otId: Id; motivo: string }) =>
      rechazarOT(otId, usuario!.id, motivo),
    onSuccess: async (_data, { otId, motivo }) => {
      await invalidarOTs();
      void invalidarPlanOts();
      setModalRechazar(null);
      setMotivoRechazo('');
      toast.success('OT rechazada');
      const ot = ordenes.find((o) => o.id === otId);
      if (ot) {
        void publicarEventoUsuario({
          tipo:      'ot_rechazada',
          usuarioId: ot.creado_por,
          otId:      ot.id,
          numero:    labelNumeroOT(ot.numero),
          motivo,
        });
      }
    },
    onError: (err) => { console.error('[mutRechazarOT]', err); toast.error('No se pudo rechazar la OT.'); },
  });

  const mutCompletar = useMutation({
    mutationFn: () =>
      completarOT({
        otId:          modalCompletar!.id,
        usuarioId:     usuario!.id,
        receptorNombre,
        receptorDni,
        receptorCargo,
        ...(obsCierre.trim() ? { observacionesCierre: obsCierre.trim() } : {}),
      }),
    onSuccess: async () => {
      await invalidarOTs();
      setModalCompletar(null);
      setReceptorNombre('');
      setReceptorDni('');
      setReceptorCargo('');
      setObsCierre('');
      toast.success('OT completada');
    },
    onError: (err) => {
      console.error('[mutCompletarOT]', err);
      toast.error(mensajeErrorInsforge(err, 'No se pudo completar la OT.'));
    },
  });

  const mutCancelar = useMutation({
    mutationFn: (otId: Id) => cancelarOrdenTrabajo(otId, usuario!.id),
    onSuccess: async () => { await invalidarOTs(); toast.success('OT cancelada'); },
    onError: (err) => { console.error('[mutCancelarOT]', err); toast.error('No se pudo cancelar la OT.'); },
  });

  return {
    modalCompletar, setModalCompletar,
    modalRechazar,  setModalRechazar,
    motivoRechazo,  setMotivoRechazo,
    receptorNombre, setReceptorNombre,
    receptorDni,    setReceptorDni,
    receptorCargo,  setReceptorCargo,
    obsCierre,      setObsCierre,
    canCompletar: puedeCompletarOTReceptor(receptorNombre, receptorDni),
    mutAprobar,
    mutRechazar,
    mutCompletar,
    mutCancelar,
  };
}
