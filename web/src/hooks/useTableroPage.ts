/**
 * hooks/useTableroPage.ts
 * Centraliza toda la lógica de negocio, estado y mutaciones de la vista Tablero.
 */

import { type DragEndEvent, type DragOverEvent } from '@dnd-kit/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { desbloquearTareaConLog, eliminarTareaConMotivo, actualizarTarea } from '@/api/semana';
import { snapTareaFechaAlPorHacer, type ColumnaTableroId, type FiltrosTablero } from '@/api/tablero';
import { useJefesNotificacion, useUsuariosActivos } from '@/hooks/useUsuarios';
import {
  agruparTareasTablero,
  useMoverColumnaMutation,
  useObjetivosTablero,
  useTareasTableroQuery,
  useUsuariosNombreTablero,
} from '@/hooks/useTablero';
import { completarTareaConResumen } from '@/hooks/useTareas';
import { fechaLocalYmd } from '@/lib/fecha';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import { useAuthStore } from '@/store/authStore';
import type { EstadoTarea, Tarea } from '@/types';

export function useTableroPage() {
  const qc = useQueryClient();
  const usuario = useAuthStore((s) => s.usuario);
  const esJefe = usuario?.rol === 'jefe';
  const hoy = fechaLocalYmd(new Date());

  // ── Filtros ───────────────────────────────────────────────────────────────
  const [usuarioFiltro, setUsuarioFiltro] = useState<string | 'todos'>('todos');
  const [objetivoFiltro, setObjetivoFiltro] = useState<string | 'todos'>('todos');
  const [mostrarCompletadas, setMostrarCompletadas] = useState(false);

  const filtros: FiltrosTablero = useMemo(() => ({
    usuarioId: esJefe ? usuarioFiltro : (usuario?.id ?? ''),
    objetivoId: objetivoFiltro,
    mostrarCompletadas,
  }), [esJefe, usuarioFiltro, objetivoFiltro, mostrarCompletadas, usuario?.id]);

  // ── Estado de modales ─────────────────────────────────────────────────────
  const [modalJust, setModalJust] = useState<{ tareaId: string; nuevo: EstadoTarea } | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [overColId, setOverColId] = useState<string | null>(null);
  const [detalleTareaId, setDetalleTareaId] = useState<string | null>(null);
  const [completarTarea, setCompletarTarea] = useState<Tarea | null>(null);
  const [desbloquearTarea, setDesbloquearTarea] = useState<Tarea | null>(null);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: tareas = [], isLoading, isError } = useTareasTableroQuery(filtros, Boolean(usuario?.id));
  const { data: objetivos = [] } = useObjetivosTablero();
  const { data: nombres = {} } = useUsuariosNombreTablero();
  const { data: usuariosAsignables = [] } = useUsuariosActivos();
  const { data: jefesNotificacion = [] } = useJefesNotificacion({
    enabled: Boolean(usuario && !esJefe),
  });

  const mover = useMoverColumnaMutation();

  // ── Mutaciones ────────────────────────────────────────────────────────────
  const mutGuardarDetalle = useMutation({
    mutationFn: (input: {
      tareaId: string;
      usuarioActorId: string;
      titulo: string;
      prioridad: Tarea['prioridad'];
      descripcion: string;
      objetivo_id?: string | null;
      asignado_a?: string | null;
    }) => actualizarTarea(input),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ refetchType: 'active', queryKey: ['tablero'], exact: false }),
        qc.invalidateQueries({ refetchType: 'active', queryKey: ['semana'], exact: false }),
        qc.invalidateQueries({ refetchType: 'active', queryKey: ['tareas-hoy'] }),
      ]);
    },
  });

  const mutEliminar = useMutation({
    mutationFn: (input: { tareaId: string; usuarioId: string; motivo: string }) =>
      eliminarTareaConMotivo(input),
    onSuccess: async () => {
      await qc.invalidateQueries({ refetchType: 'active', queryKey: ['tablero'], exact: false });
      setDetalleTareaId(null);
    },
  });

  // ── Datos derivados ───────────────────────────────────────────────────────
  const columnas = useMemo(() => agruparTareasTablero(tareas, hoy), [tareas, hoy]);

  const tareaDragOverlay = useMemo(() => {
    if (!activeDragId) return null;
    const tid = String(activeDragId).replace('kanban-', '');
    return tareas.find((x) => x.id === tid) ?? null;
  }, [activeDragId, tareas]);

  const tareaDetalle = useMemo(
    () => (detalleTareaId ? (tareas.find((x) => x.id === detalleTareaId) ?? null) : null),
    [detalleTareaId, tareas],
  );

  // ── Permisos ──────────────────────────────────────────────────────────────
  function puedeGestionar(t: Tarea): boolean {
    return usuario?.rol === 'jefe' || t.asignado_a === usuario?.id;
  }

  // ── Handlers DnD ─────────────────────────────────────────────────────────
  function onDragOver(ev: DragOverEvent) {
    const o = ev.over?.id;
    setOverColId(o && String(o).startsWith('col:') ? String(o) : null);
  }

  async function onDragEnd(ev: DragEndEvent) {
    const { active, over } = ev;
    setActiveDragId(null);
    setOverColId(null);
    if (!over || !active.id || !usuario) return;

    const tid = String(active.id).replace('kanban-', '');
    const t = tareas.find((x) => x.id === tid);
    if (!t) return;

    const m = /^col:(.+)$/.exec(String(over.id));
    if (!m) return;

    const nuevo = m[1] as ColumnaTableroId;
    const actual = estadoEfectivoTablero(t, hoy);
    if (!puedeGestionar(t) || nuevo === actual) return;

    if (nuevo === 'completada') {
      setCompletarTarea(t);
      return;
    }

    if (actual === 'completada' && esJefe) {
      setModalJust({ tareaId: tid, nuevo: nuevo as EstadoTarea });
      return;
    }

    if (nuevo === 'pendiente' && actual === 'atrasada') {
      try {
        await snapTareaFechaAlPorHacer(tid, hoy);
        await Promise.all([
          qc.invalidateQueries({ refetchType: 'active', queryKey: ['tablero'], exact: false }),
          qc.invalidateQueries({ refetchType: 'active', queryKey: ['semana'], exact: false }),
          qc.invalidateQueries({ refetchType: 'active', queryKey: ['tareas-hoy'] }),
        ]);
        toast.success('Tarea reubicada en el día actual');
      } catch (err) {
        console.error('[onDragEnd:atrasada->pendiente]', err);
        toast.error('No se pudo actualizar la tarea.');
      }
      return;
    }

    if (nuevo === 'bloqueada') {
      setModalJust({ tareaId: tid, nuevo: 'bloqueada' });
      return;
    }

    try {
      await mover.mutateAsync({ tareaId: tid, nuevoEstado: nuevo as EstadoTarea, usuarioActorId: usuario.id });
    } catch (err) {
      console.error('[onDragEnd:mover]', err);
      toast.error('No se pudo actualizar el estado.');
    }
  }

  // ── Handlers de acciones ─────────────────────────────────────────────────
  async function confirmarJustificacion(justificacion: string) {
    if (!modalJust || !usuario) return;
    try {
      await mover.mutateAsync({
        tareaId: modalJust.tareaId,
        nuevoEstado: modalJust.nuevo,
        usuarioActorId: usuario.id,
        justificacion,
      });
      setModalJust(null);
    } catch (err) {
      console.error('[confirmarJustificacion]', err);
      toast.error('No se pudo guardar.');
    }
  }

  async function confirmarDesbloqueo(input: { tareaId: string; nuevaFecha: string; justificacion: string }) {
    if (!usuario) return;
    try {
      await desbloquearTareaConLog({ ...input, usuarioId: usuario.id });
      setDesbloquearTarea(null);
      toast.success('Tarea desbloqueada');
      await Promise.all([
        qc.invalidateQueries({ refetchType: 'active', queryKey: ['tablero'], exact: false }),
        qc.invalidateQueries({ refetchType: 'active', queryKey: ['semana'], exact: false }),
        qc.invalidateQueries({ refetchType: 'active', queryKey: ['tareas-hoy'] }),
      ]);
    } catch (err) {
      console.error('[confirmarDesbloqueo]', err);
      toast.error('No se pudo desbloquear la tarea.');
    }
  }

  async function confirmarCompletar(input: { tareaId: string; resumen: string }) {
    if (!usuario) return;
    try {
      await completarTareaConResumen({
        tareaId: input.tareaId,
        usuarioId: usuario.id,
        usuarioNombre: usuario.nombre,
        tareaTitulo: completarTarea?.titulo,
        jefeIds: esJefe ? undefined : jefesNotificacion.map((jefe) => jefe.id),
        resumen: input.resumen,
      });
      setCompletarTarea(null);
      toast.success('Tarea completada');
      await Promise.all([
        qc.invalidateQueries({ refetchType: 'active', queryKey: ['tablero'], exact: false }),
        qc.invalidateQueries({ refetchType: 'active', queryKey: ['semana'], exact: false }),
        qc.invalidateQueries({ refetchType: 'active', queryKey: ['tareas-hoy'] }),
      ]);
    } catch (err) {
      console.error('[confirmarCompletar]', err);
      toast.error('No se pudo completar la tarea.');
    }
  }

  async function iniciarDesdeTablero(t: Tarea) {
    if (!usuario) return;
    try {
      await mover.mutateAsync({ tareaId: t.id, nuevoEstado: 'en_progreso', usuarioActorId: usuario.id });
      toast.success('Tarea en progreso');
    } catch (err) {
      console.error('[iniciarDesdeTablero]', err);
      toast.error('No se pudo iniciar la tarea.');
    }
  }

  async function guardarDetalle(input: {
    tareaId: string;
    titulo: string;
    prioridad: Tarea['prioridad'];
    descripcion: string;
    objetivo_id?: string | null;
    asignado_a?: string | null;
  }) {
    if (!usuario) return;
    await mutGuardarDetalle.mutateAsync({ ...input, usuarioActorId: usuario.id });
    toast.success('Tarea actualizada');
  }

  async function eliminarDetalle(input: { tareaId: string; motivo: string }) {
    if (!usuario) return;
    await mutEliminar.mutateAsync({ ...input, usuarioId: usuario.id });
    toast.success('Tarea eliminada');
  }

  return {
    // Auth
    usuario,
    esJefe,
    hoy,

    // Filtros
    usuarioFiltro,
    setUsuarioFiltro,
    objetivoFiltro,
    setObjetivoFiltro,
    mostrarCompletadas,
    setMostrarCompletadas,

    // Datos
    tareas,
    columnas,
    isLoading,
    isError,
    objetivos,
    nombres,
    usuariosAsignables,
    tareaDragOverlay,
    tareaDetalle,

    // DnD
    activeDragId,
    setActiveDragId,
    overColId,
    onDragOver,
    onDragEnd,

    // Modales
    modalJust,
    setModalJust,
    detalleTareaId,
    setDetalleTareaId,
    completarTarea,
    setCompletarTarea,
    desbloquearTarea,
    setDesbloquearTarea,

    // Permisos
    puedeGestionar,

    // Handlers
    confirmarJustificacion,
    confirmarDesbloqueo,
    confirmarCompletar,
    iniciarDesdeTablero,
    guardarDetalle,
    eliminarDetalle,
  };
}