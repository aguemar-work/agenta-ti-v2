import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { moverTareaColumna } from '@/api/tablero';
import {
  actualizarTarea,
  cambiarEstadoTarea,
  completarTareaConResumen,
  crearEventoUsuario,
  crearTareaPlanificada,
  eliminarTareaConMotivo,
  getEventosSemana,
  getTareasSemana,
  moverTareaADia,
  moverTareaEntreDias,
} from '@/api/semana';
import { Q_KPIS, Q_OBJ_PROG } from '@/hooks/useObjetivosMetricas';
import { useWorkspaceId } from '@/hooks/useWorkspaceId';
import type { CrearEventoUsuarioInput, CrearTareaPlanificadaInput } from '@/api/semana';
import { qkWsId } from '@/lib/queryKeys';
import { getWorkspaceId } from '@/store/workspaceStore';
import type { Tarea } from '@/types';

const Q = {
  plan: (wsId: string | null, uid: string, sem: string) =>
    qkWsId(wsId, 'semana', 'plan', uid, sem),
  ev: (wsId: string | null, uid: string, sem: string) =>
    qkWsId(wsId, 'semana', 'eventos', uid, sem),
};

export function useMiSemanaData(usuarioId: string | undefined, semanaISO: string, lunes: Date) {
  const workspaceId = useWorkspaceId();
  const qPlan = useQuery({
    queryKey: usuarioId ? Q.plan(workspaceId, usuarioId, semanaISO) : ['semana', 'plan', 'noop'],
    enabled: Boolean(usuarioId) && Boolean(workspaceId),
    queryFn: () => getTareasSemana(usuarioId!, semanaISO),
  });
  const qEv = useQuery({
    queryKey: usuarioId ? Q.ev(workspaceId, usuarioId, semanaISO) : ['semana', 'eventos', 'noop'],
    enabled: Boolean(usuarioId) && Boolean(workspaceId),
    queryFn: () => getEventosSemana(usuarioId!, lunes),
  });

  return {
    tareasPlan: qPlan.data ?? [],
    eventos: qEv.data ?? [],
    isLoading: qPlan.isLoading || qEv.isLoading,
    isError: qPlan.isError || qEv.isError,
  };
}

export function useMiSemanaMutations(usuarioId: string | undefined) {
  const qc = useQueryClient();

  const invalidate = async () => {
    const wsId = getWorkspaceId();
    if (!usuarioId || !wsId) return;
    await Promise.all([
      qc.invalidateQueries({ queryKey: qkWsId(wsId, 'semana', 'plan', usuarioId), exact: false }),
      qc.invalidateQueries({ queryKey: qkWsId(wsId, 'semana', 'eventos', usuarioId), exact: false }),
      qc.invalidateQueries({ queryKey: qkWsId(wsId, 'tareas-hoy', usuarioId), exact: false }),
      qc.invalidateQueries({ queryKey: qkWsId(wsId, 'tablero'), exact: false }),
      qc.invalidateQueries({ queryKey: qkWsId(wsId, 'planificacion'), exact: false }),
      qc.invalidateQueries({ queryKey: qkWsId(wsId, Q_OBJ_PROG), exact: false }),
      qc.invalidateQueries({ queryKey: qkWsId(wsId, Q_KPIS), exact: false }),
      qc.invalidateQueries({ queryKey: qkWsId(wsId, 'ordenes-trabajo'), exact: false }),
      qc.invalidateQueries({ queryKey: qkWsId(wsId, 'semana', 'ot-por-tarea'), exact: false }),
    ]);
  };

  const mCrearPlan = useMutation({
    mutationFn: (input: CrearTareaPlanificadaInput) => crearTareaPlanificada(input),
    onSuccess: invalidate,
  });

  const mMoverDia = useMutation({
    mutationFn: (p: { tareaId: string; fecha: string; semana: string }) =>
      moverTareaADia(p.tareaId, p.fecha, p.semana),
    onSuccess: invalidate,
  });

  const mMoverEntre = useMutation({
    mutationFn: (p: { tareaId: string; nuevaFecha: string }) => moverTareaEntreDias(p.tareaId, p.nuevaFecha),
    onSuccess: invalidate,
  });

  const mEditar = useMutation({
    mutationFn: (input: {
      tareaId: string;
      usuarioActorId: string;
      titulo: string;
      prioridad: Tarea['prioridad'];
      descripcion?: string;
      objetivo_id?: string | null;
      asignado_a?: string | null;
    }) => actualizarTarea(input),
    onSuccess: invalidate,
  });

  const mEliminar = useMutation({
    mutationFn: (input: { tareaId: string; usuarioId: string; motivo: string }) => eliminarTareaConMotivo(input),
    onSuccess: invalidate,
  });

  const mCancelar = useMutation({
    mutationFn: (input: { tareaId: string; motivo: string }) =>
      cambiarEstadoTarea({ tareaId: input.tareaId, nuevoEstado: 'cancelada', justificacion: input.motivo }),
    onSuccess: invalidate,
  });

  const mCompletar = useMutation({
    mutationFn: (input: {
      tareaId: string;
      usuarioId: string;
      resumen: string;
      usuarioNombre?: string;
      tareaTitulo?: string;
      jefeIds?: string[];
    }) =>
      completarTareaConResumen(input),
    onSuccess: invalidate,
  });

  const mIniciar = useMutation({
    mutationFn: (input: { tareaId: string; usuarioId: string }) => moverTareaColumna(input.tareaId, 'en_progreso', input.usuarioId),
    onSuccess: invalidate,
  });

  const mCrearEvento = useMutation({
    mutationFn: (input: CrearEventoUsuarioInput) => crearEventoUsuario(input),
    onSuccess: invalidate,
  });

  return {
    crearPlan: mCrearPlan.mutateAsync,
    moverDia: mMoverDia.mutateAsync,
    moverEntre: mMoverEntre.mutateAsync,
    editarTarea: mEditar.mutateAsync,
    eliminarTarea: mEliminar.mutateAsync,
    cancelarTarea: mCancelar.mutateAsync,
    completarTareaConResumen: mCompletar.mutateAsync,
    iniciarTarea: mIniciar.mutateAsync,
    crearEvento: mCrearEvento.mutateAsync,
    isPending:
      mCrearPlan.isPending ||
      mMoverDia.isPending ||
      mMoverEntre.isPending ||
      mEditar.isPending ||
      mEliminar.isPending ||
      mCancelar.isPending ||
      mCompletar.isPending ||
      mIniciar.isPending ||
      mCrearEvento.isPending,
    completarPendingId: mCompletar.isPending ? (mCompletar.variables?.tareaId ?? null) : null,
    iniciarPendingId:   mIniciar.isPending   ? (mIniciar.variables?.tareaId   ?? null) : null,
    eliminarPendingId:  mEliminar.isPending  ? (mEliminar.variables?.tareaId  ?? null) : null,
    cancelarPendingId:  mCancelar.isPending  ? (mCancelar.variables?.tareaId  ?? null) : null,
  };
}
