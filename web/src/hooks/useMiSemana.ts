import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { moverTareaColumna } from '@/api/tablero';
import {
  actualizarTarea,
  crearEventoUsuario,
  crearTareaLibre,
  crearTareaPlanificada,
  eliminarTareaConMotivo,
  getEventosSemana,
  getTareasLibres,
  getTareasSemana,
  moverTareaABacklog,
  moverTareaADia,
  moverTareaEntreDias,
} from '@/api/semana';
import { Q_KPIS, Q_OBJ_PROG } from '@/hooks/useObjetivosMetricas';
import { completarTareaConResumen } from '@/hooks/useTareas';
import type { CrearEventoUsuarioInput, CrearTareaLibreInput, CrearTareaPlanificadaInput } from '@/api/semana';
import type { Tarea } from '@/types';

const Q = {
  plan: (uid: string, sem: string) => ['semana', 'plan', uid, sem] as const,
  lib: (uid: string) => ['semana', 'libres', uid] as const,
  ev: (uid: string, sem: string) => ['semana', 'eventos', uid, sem] as const,
};

export function useMiSemanaData(usuarioId: string | undefined, semanaISO: string, lunes: Date) {
  const qPlan = useQuery({
    queryKey: usuarioId ? Q.plan(usuarioId, semanaISO) : ['semana', 'plan', 'noop'],
    enabled: Boolean(usuarioId),
    queryFn: () => getTareasSemana(usuarioId!, semanaISO),
  });
  const qLib = useQuery({
    queryKey: usuarioId ? Q.lib(usuarioId) : ['semana', 'libres', 'noop'],
    enabled: Boolean(usuarioId),
    queryFn: () => getTareasLibres(usuarioId!),
  });
  const qEv = useQuery({
    queryKey: usuarioId ? Q.ev(usuarioId, semanaISO) : ['semana', 'eventos', 'noop'],
    enabled: Boolean(usuarioId),
    queryFn: () => getEventosSemana(usuarioId!, lunes),
  });

  return {
    tareasPlan: qPlan.data ?? [],
    libres: qLib.data ?? [],
    eventos: qEv.data ?? [],
    isLoading: qPlan.isLoading || qLib.isLoading || qEv.isLoading,
    isError: qPlan.isError || qLib.isError || qEv.isError,
  };
}

export function useMiSemanaMutations(usuarioId: string | undefined, semanaISO: string) {
  const qc = useQueryClient();

  const invalidate = async () => {
    if (!usuarioId) return;
    await Promise.all([
      qc.invalidateQueries({ queryKey: Q.plan(usuarioId, semanaISO) }),
      qc.invalidateQueries({ queryKey: Q.lib(usuarioId) }),
      qc.invalidateQueries({ queryKey: Q.ev(usuarioId, semanaISO) }),
      qc.invalidateQueries({ queryKey: ['tareas-hoy', usuarioId] }),
      qc.invalidateQueries({ queryKey: ['tablero'] }),
      qc.invalidateQueries({ queryKey: ['planificacion'] }),
      qc.invalidateQueries({ queryKey: [Q_OBJ_PROG] }),
      qc.invalidateQueries({ queryKey: [Q_KPIS] }),
    ]);
  };

  const mCrearLibre = useMutation({
    mutationFn: (input: CrearTareaLibreInput) => crearTareaLibre(input),
    onSuccess: invalidate,
  });

  const mCrearPlan = useMutation({
    mutationFn: (input: CrearTareaPlanificadaInput) => crearTareaPlanificada(input),
    onSuccess: invalidate,
  });

  const mMoverDia = useMutation({
    mutationFn: (p: { tareaId: string; fecha: string; semana: string; tipo: Tarea['tipo'] }) =>
      moverTareaADia(p.tareaId, p.fecha, p.semana, p.tipo),
    onSuccess: invalidate,
  });

  const mMoverEntre = useMutation({
    mutationFn: (p: { tareaId: string; nuevaFecha: string }) => moverTareaEntreDias(p.tareaId, p.nuevaFecha),
    onSuccess: invalidate,
  });

  const mBacklog = useMutation({
    mutationFn: (tareaId: string) => moverTareaABacklog(tareaId),
    onSuccess: invalidate,
  });

  const mEditar = useMutation({
    mutationFn: (input: {
      tareaId: string;
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
    mutationFn: (input: { tareaId: string; usuarioId: string; resumen: string }) =>
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
    crearLibre: mCrearLibre.mutateAsync,
    crearPlan: mCrearPlan.mutateAsync,
    moverDia: mMoverDia.mutateAsync,
    moverEntre: mMoverEntre.mutateAsync,
    moverBacklog: mBacklog.mutateAsync,
    editarTarea: mEditar.mutateAsync,
    eliminarTarea: mEliminar.mutateAsync,
    completarTareaConResumen: mCompletar.mutateAsync,
    iniciarTarea: mIniciar.mutateAsync,
    crearEvento: mCrearEvento.mutateAsync,
    isPending:
      mCrearLibre.isPending ||
      mCrearPlan.isPending ||
      mMoverDia.isPending ||
      mMoverEntre.isPending ||
      mBacklog.isPending ||
      mEditar.isPending ||
      mEliminar.isPending ||
      mCompletar.isPending ||
      mIniciar.isPending ||
      mCrearEvento.isPending,
  };
}
