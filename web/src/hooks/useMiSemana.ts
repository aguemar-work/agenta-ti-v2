import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { moverTareaColumna } from '@/api/tablero';
import {
  actualizarTarea,
  crearEventoUsuario,
  crearTareaPlanificada,
  eliminarTareaConMotivo,
  getEventosSemana,
  getTareasSemana,
  moverTareaADia,
  moverTareaEntreDias,
} from '@/api/semana';
import { Q_KPIS, Q_OBJ_PROG } from '@/hooks/useObjetivosMetricas';
import { completarTareaConResumen } from '@/hooks/useTareas';
import type { CrearEventoUsuarioInput, CrearTareaPlanificadaInput } from '@/api/semana';
import type { Tarea } from '@/types';

const Q = {
  plan: (uid: string, sem: string) => ['semana', 'plan', uid, sem] as const,
ev: (uid: string, sem: string) => ['semana', 'eventos', uid, sem] as const,
};

export function useMiSemanaData(usuarioId: string | undefined, semanaISO: string, lunes: Date) {
  const qPlan = useQuery({
    queryKey: usuarioId ? Q.plan(usuarioId, semanaISO) : ['semana', 'plan', 'noop'],
    enabled: Boolean(usuarioId),
    queryFn: () => getTareasSemana(usuarioId!, semanaISO),
  });
  const qEv = useQuery({
    queryKey: usuarioId ? Q.ev(usuarioId, semanaISO) : ['semana', 'eventos', 'noop'],
    enabled: Boolean(usuarioId),
    queryFn: () => getEventosSemana(usuarioId!, lunes),
  });

  return {
    tareasPlan: qPlan.data ?? [],
eventos: qEv.data ?? [],
    isLoading: qPlan.isLoading || qEv.isLoading,
    isError: qPlan.isError || qEv.isError,
  };
}

export function useMiSemanaMutations(usuarioId: string | undefined, semanaISO: string) {
  const qc = useQueryClient();

  const invalidate = async () => {
    if (!usuarioId) return;
    await Promise.all([
      qc.invalidateQueries({ refetchType: 'active', queryKey: Q.plan(usuarioId, semanaISO) }),
qc.invalidateQueries({ refetchType: 'active', queryKey: Q.ev(usuarioId, semanaISO) }),
      qc.invalidateQueries({ refetchType: 'active', queryKey: ['tareas-hoy', usuarioId], exact: false }),
      qc.invalidateQueries({ refetchType: 'active', queryKey: ['tablero'], exact: false }),
      qc.invalidateQueries({ refetchType: 'active', queryKey: ['planificacion'], exact: false }),
      qc.invalidateQueries({ refetchType: 'active', queryKey: [Q_OBJ_PROG], exact: false }),
      qc.invalidateQueries({ refetchType: 'active', queryKey: [Q_KPIS], exact: false }),
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
    completarTareaConResumen: mCompletar.mutateAsync,
    iniciarTarea: mIniciar.mutateAsync,
    crearEvento: mCrearEvento.mutateAsync,
    isPending:
      mCrearPlan.isPending ||
      mMoverDia.isPending ||
      mMoverEntre.isPending ||
      mEditar.isPending ||
      mEliminar.isPending ||
      mCompletar.isPending ||
      mIniciar.isPending ||
      mCrearEvento.isPending,
  };
}