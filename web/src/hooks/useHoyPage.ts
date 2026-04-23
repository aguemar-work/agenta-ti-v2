/**
 * hooks/useHoyPage.ts
 * Centraliza toda la lógica de negocio, estado y mutaciones de la vista Hoy.
 * El componente Hoy.tsx solo consume este hook y renderiza JSX.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { insertarNotaBitacoraRapida } from '@/api/hoyColumnas';
import { eliminarTareaConMotivo, actualizarTarea } from '@/api/semana';
import { getObjetivosActivos } from '@/api/objetivos';
import { getUsuariosActivosParaAsignacion } from '@/api/usuarios';
import {
  crearIncidenciaHoy,
  Q_INC_HOY,
  Q_NOTAS_HOY,
  useEventosHoy,
  useIncidenciasDelDia,
  useNotasBitacoraHoy,
} from '@/hooks/useHoyColumnas';
import { Q_KPIS, Q_OBJ_PROG } from '@/hooks/useObjetivosMetricas';
import { useMoverColumnaMutation } from '@/hooks/useTablero';
import {
  bloquearTarea,
  completarTareaConResumen,
  reprogramarTareaConLog,
  useMarcarAtrasadasAlMontar,
  useTareasHoy,
  useUsuariosParaSelector,
} from '@/hooks/useTareas';
import { fechaLocalYmd } from '@/lib/fecha';
import { useAuthStore } from '@/store/authStore';
import type { Tarea } from '@/types';

export function useHoyPage() {
  const qc = useQueryClient();
  const usuario = useAuthStore((s) => s.usuario);
  const esJefe = usuario?.rol === 'jefe';

  // ── Estado de UI ──────────────────────────────────────────────────────────
  const [seleccionId, setSeleccionId] = useState<string | undefined>();
  const [reprTarea, setReprTarea] = useState<Tarea | null>(null);
  const [modalInc, setModalInc] = useState(false);
  const [completarTarea, setCompletarTarea] = useState<Tarea | null>(null);
  const [bloquearTareaState, setBloquearTareaState] = useState<Tarea | null>(null);
  const [detalleTareaId, setDetalleTareaId] = useState<string | null>(null);
  const [notaRapida, setNotaRapida] = useState('');

  useEffect(() => {
    if (usuario?.id && seleccionId === undefined) setSeleccionId(usuario.id);
  }, [usuario?.id, seleccionId]);

  const { data: usuariosJefe } = useUsuariosParaSelector(Boolean(esJefe));

  const asignado = seleccionId ?? usuario?.id;
  const hoyYmd = fechaLocalYmd(new Date());

  // ── Queries ───────────────────────────────────────────────────────────────
  useMarcarAtrasadasAlMontar(asignado);
  const { data: tareas = [], isLoading, isError } = useTareasHoy(asignado);
  const { data: incidenciasHist = [], isLoading: loadInc } = useIncidenciasDelDia(asignado, hoyYmd);
  const { data: eventos = [], isLoading: loadEv } = useEventosHoy(asignado, hoyYmd);
  const { data: notas = [], isLoading: loadNotas } = useNotasBitacoraHoy(asignado);

  const { data: objetivosActivos = [] } = useQuery({
    queryKey: ['objetivos-activos-hoy'],
    queryFn: () => getObjetivosActivos(),
  });
  const { data: usuariosAsignables = [] } = useQuery({
    queryKey: ['usuarios-asignacion-hoy'],
    queryFn: () => getUsuariosActivosParaAsignacion(),
  });

  // ── Mutaciones ────────────────────────────────────────────────────────────
  const moverCol = useMoverColumnaMutation();

  const mutGuardarDetalle = useMutation({
    mutationFn: (input: {
      tareaId: string;
      titulo: string;
      prioridad: Tarea['prioridad'];
      descripcion: string;
      objetivo_id?: string | null;
      asignado_a?: string | null;
    }) => actualizarTarea(input),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ refetchType: 'active', queryKey: ['tareas-hoy', asignado] }),
        qc.invalidateQueries({ refetchType: 'active', queryKey: ['tablero'] }),
        qc.invalidateQueries({ refetchType: 'active', queryKey: ['semana'] }),
      ]);
    },
  });

  const mutEliminarDetalle = useMutation({
    mutationFn: (input: { tareaId: string; usuarioId: string; motivo: string }) =>
      eliminarTareaConMotivo(input),
    onSuccess: async () => {
      setDetalleTareaId(null);
      await Promise.all([
        qc.invalidateQueries({ refetchType: 'active', queryKey: ['tareas-hoy', asignado] }),
        qc.invalidateQueries({ refetchType: 'active', queryKey: ['tablero'] }),
      ]);
    },
  });

  const crearInc = useMutation({
    mutationFn: crearIncidenciaHoy,
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ refetchType: 'active', queryKey: [Q_INC_HOY, asignado, hoyYmd] }),
        qc.invalidateQueries({ refetchType: 'active', queryKey: ['tareas-hoy', asignado, hoyYmd] }),
        qc.invalidateQueries({ refetchType: 'active', queryKey: [Q_KPIS] }),
        qc.invalidateQueries({ refetchType: 'active', queryKey: [Q_OBJ_PROG] }),
      ]);
    },
  });

  const mutNotaRapida = useMutation({
    mutationFn: insertarNotaBitacoraRapida,
    onSuccess: async () => {
      setNotaRapida('');
      await qc.invalidateQueries({ refetchType: 'active', queryKey: [Q_NOTAS_HOY, asignado] });
      toast.success('Nota guardada');
    },
    onError: () => toast.error('No se pudo guardar la nota.'),
  });

  // ── Datos derivados ───────────────────────────────────────────────────────
  const { atrasadas, delDia } = useMemo(() => {
    const a: Tarea[] = [];
    const d: Tarea[] = [];
    for (const t of tareas) {
      if (t.estado === 'atrasada') a.push(t);
      else if (t.fecha_planificada === hoyYmd) d.push(t);
    }
    return { atrasadas: a, delDia: d };
  }, [tareas, hoyYmd]);

  const tareaDetalle = detalleTareaId
    ? (tareas.find((x) => x.id === detalleTareaId) ?? null)
    : null;

  // ── Permisos ──────────────────────────────────────────────────────────────
  const puedeEditar = (t: Tarea) =>
    usuario?.rol === 'jefe' || t.asignado_a === usuario?.id;

  // ── Handlers ─────────────────────────────────────────────────────────────
  async function iniciarTarea(t: Tarea) {
    if (!usuario) return;
    try {
      await moverCol.mutateAsync({ tareaId: t.id, nuevoEstado: 'en_progreso', usuarioActorId: usuario.id });
      toast.success('Tarea en progreso');
    } catch (err) {
      console.error('[iniciarTarea]', err);
      toast.error('No se pudo iniciar la tarea.');
    }
  }

  async function confirmarCompletar(input: { tareaId: string; resumen: string }) {
    if (!usuario) return;
    try {
      await completarTareaConResumen({ tareaId: input.tareaId, usuarioId: usuario.id, resumen: input.resumen });
      setCompletarTarea(null);
      toast.success('Tarea completada');
      await Promise.all([
        qc.invalidateQueries({ refetchType: 'active', queryKey: ['tareas-hoy', asignado] }),
        qc.invalidateQueries({ refetchType: 'active', queryKey: [Q_INC_HOY, asignado, hoyYmd] }),
        qc.invalidateQueries({ refetchType: 'active', queryKey: [Q_KPIS] }),
        qc.invalidateQueries({ refetchType: 'active', queryKey: [Q_OBJ_PROG] }),
      ]);
    } catch (err) {
      console.error('[confirmarCompletar]', err);
      toast.error('No se pudo completar la tarea.');
    }
  }

  async function confirmarReprogramacion(input: {
    tareaId: string;
    nuevaFecha: string;
    justificacion: string;
  }) {
    if (!usuario) return;
    try {
      await reprogramarTareaConLog({ ...input, usuarioId: usuario.id });
      setReprTarea(null);
      toast.success('Tarea reprogramada');
      await qc.invalidateQueries({ refetchType: 'active', queryKey: ['tareas-hoy', asignado] });
    } catch (err) {
      console.error('[confirmarReprogramacion]', err);
      toast.error('No se pudo reprogramar. Revisa permisos o datos.');
    }
  }

  async function confirmarBloqueo(input: { tareaId: string; justificacion: string }) {
    if (!usuario) return;
    try {
      await bloquearTarea({ ...input, usuarioId: usuario.id });
      setBloquearTareaState(null);
      toast.success('Tarea bloqueada');
      await Promise.all([
        qc.invalidateQueries({ refetchType: 'active', queryKey: ['tareas-hoy', asignado] }),
        qc.invalidateQueries({ refetchType: 'active', queryKey: ['tablero'] }),
        qc.invalidateQueries({ refetchType: 'active', queryKey: ['semana'] }),
      ]);
    } catch (err) {
      console.error('[confirmarBloqueo]', err);
      toast.error('No se pudo bloquear la tarea.');
    }
  }

  async function crearIncidencia(input: {
    titulo: string;
    prioridad: Tarea['prioridad'];
    descripcion: string;
    objetivo_id?: string | null;
    asignado_a: string;
  }) {
    if (!asignado || !usuario) return;
    try {
      await crearInc.mutateAsync({
        titulo: input.titulo,
        prioridad: input.prioridad,
        descripcion: input.descripcion,
        asignado_a: input.asignado_a.trim() || asignado,
        creado_por: usuario.id,
        fecha_planificada: hoyYmd,
      });
      toast.success('Incidencia registrada');
    } catch (err) {
      console.error('[crearIncidencia]', err);
      toast.error('No se pudo crear la incidencia.');
    }
  }

  function guardarNotaRapida() {
    if (!asignado || !notaRapida.trim()) return;
    mutNotaRapida.mutate({ usuario_id: asignado, contenido: notaRapida.trim(), visibilidad: 'todos' });
  }

  async function guardarDetalle(input: {
    tareaId: string;
    titulo: string;
    prioridad: Tarea['prioridad'];
    descripcion: string;
    objetivo_id?: string | null;
    asignado_a?: string | null;
  }) {
    await mutGuardarDetalle.mutateAsync(input);
    toast.success('Tarea actualizada');
  }

  async function eliminarDetalle(input: { tareaId: string; motivo: string }) {
    if (!usuario) return;
    await mutEliminarDetalle.mutateAsync({ ...input, usuarioId: usuario.id });
    toast.success('Tarea eliminada');
  }

  return {
    // Estado de autenticación
    usuario,
    esJefe,

    // Datos
    tareas,
    atrasadas,
    delDia,
    incidenciasHist,
    eventos,
    notas,
    objetivosActivos,
    usuariosAsignables,
    usuariosJefe,
    tareaDetalle,
    hoyYmd,

    // Loadings
    colLoading: isLoading || loadInc || loadEv || loadNotas,
    isError,
    mutNotaPending: mutNotaRapida.isPending,

    // Selector de miembro (jefe)
    asignado,
    seleccionId,
    setSeleccionId,

    // Estado de modales
    reprTarea, setReprTarea,
    modalInc, setModalInc,
    completarTarea, setCompletarTarea,
    bloquearTareaState, setBloquearTareaState,
    detalleTareaId, setDetalleTareaId,
    notaRapida, setNotaRapida,

    // Permisos
    puedeEditar,

    // Handlers
    iniciarTarea,
    confirmarCompletar,
    confirmarReprogramacion,
    confirmarBloqueo,
    crearIncidencia,
    guardarNotaRapida,
    guardarDetalle,
    eliminarDetalle,
  };
}