/**
 * hooks/useMiSemanaPage.ts
 * Centraliza toda la lógica de negocio, estado y handlers de la vista MiSemana.
 * MiSemana.tsx solo consume este hook y renderiza JSX.
 */

import { type DragEndEvent, type DragOverEvent } from '@dnd-kit/core';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { getObjetivosActivos } from '@/api/objetivos';
import { getUsuariosActivosParaAsignacion } from '@/api/usuarios';
import { useMiSemanaData, useMiSemanaMutations } from '@/hooks/useMiSemana';
import { bloquearTarea, reprogramarTareaConLog, useMarcarAtrasadasAlMontar, useUsuariosParaSelector } from '@/hooks/useTareas';
import { fechaLocalYmd } from '@/lib/fecha';
import { resolverEstadoReprogramacion } from '@/lib/tareaEstado';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import { agregarDias, inicioSemanaIso, semanaIsoDesdeFecha } from '@/lib/semanas';
import { useAuthStore } from '@/store/authStore';
import type { Tarea, TipoEvento } from '@/types';

export function useMiSemanaPage() {
  const usuario = useAuthStore((s) => s.usuario);
  const esJefe  = usuario?.rol === 'jefe';

  // ── Navegación de semana ──────────────────────────────────────────────────
  const [lunes,        setLunes]        = useState(() => inicioSemanaIso(new Date()));
  const [seleccionId,  setSeleccionId]  = useState<string | undefined>();

  // ── Estado de modales ─────────────────────────────────────────────────────
  const [modal,             setModal]             = useState<{ modo: 'libre' | 'dia'; fecha?: string } | null>(null);
  const [detalleTareaId,    setDetalleTareaId]    = useState<string | null>(null);
  const [completarTareaId,  setCompletarTareaId]  = useState<string | null>(null);
  const [bloquearTareaState,setBloquearTareaState]= useState<Tarea | null>(null);
  const [reprDetalleTarea,  setReprDetalleTarea]  = useState<Tarea | null>(null);
  const [reprDragTarea,     setReprDragTarea]     = useState<{ tarea: Tarea; fecha: string; semana: string } | null>(null);

  // ── Estado de DnD ─────────────────────────────────────────────────────────
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [overId,       setOverId]       = useState<string | null>(null);

  useEffect(() => {
    if (usuario?.id && seleccionId === undefined) setSeleccionId(usuario.id);
  }, [usuario?.id, seleccionId]);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: usuariosJefe } = useUsuariosParaSelector(Boolean(esJefe));
  const { data: objetivosActivos   = [] } = useQuery({
    queryKey: ['objetivos-activos-mi-semana'],
    queryFn:  () => getObjetivosActivos(),
  });
  const { data: usuariosAsignables = [] } = useQuery({
    queryKey: ['usuarios-asignacion-mi-semana'],
    queryFn:  () => getUsuariosActivosParaAsignacion(),
  });

  const uid       = seleccionId ?? usuario?.id;
  const semanaISO = semanaIsoDesdeFecha(lunes);

  useMarcarAtrasadasAlMontar(uid);
  const { tareasPlan, eventos, isError } = useMiSemanaData(uid, semanaISO, lunes);
  const mut = useMiSemanaMutations(uid, semanaISO);

  // ── Datos derivados ───────────────────────────────────────────────────────
  const diasSemana = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < 6; i++) out.push(agregarDias(lunes, i));
    return out;
  }, [lunes]);

  const sabado = useMemo(() => agregarDias(lunes, 5), [lunes]);

  const tareaPorId = useMemo(() => {
    const m = new Map<string, Tarea>();
    for (const t of tareasPlan) m.set(t.id, t);
    return m;
  }, [tareasPlan]);

  const hoyYmd        = fechaLocalYmd(new Date());
  const tareaDetalle  = detalleTareaId   ? (tareaPorId.get(detalleTareaId)  ?? null) : null;
  const tareaCompletar= completarTareaId ? (tareaPorId.get(completarTareaId) ?? null) : null;

  const activeTareaDrag = useMemo(() => {
    if (!activeDragId) return null;
    const tid = String(activeDragId).replace('tarea-', '');
    return tareaPorId.get(tid) ?? null;
  }, [activeDragId, tareaPorId]);

  const conteos = useMemo(() => {
    const c = { pendiente: 0, en_progreso: 0, atrasada: 0, reprogramada: 0, completada: 0 };
    for (const t of tareasPlan) {
      const est = estadoEfectivoTablero(t, hoyYmd);
      if (est in c) c[est as keyof typeof c]++;
    }
    return c;
  }, [tareasPlan, hoyYmd]);

  // ── Permisos ──────────────────────────────────────────────────────────────
  function puedeGestionar(t: Tarea) {
    return esJefe || t.asignado_a === usuario?.id;
  }

  // ── Handlers DnD ─────────────────────────────────────────────────────────
  function onDragOver(ev: DragOverEvent) {
    setOverId(ev.over ? String(ev.over.id) : null);
  }

  async function onDragEnd(ev: DragEndEvent) {
    const { active, over } = ev;
    setActiveDragId(null);
    setOverId(null);
    if (!over || !active.id) return;
    const tid = String(active.id).replace('tarea-', '');
    const t   = tareaPorId.get(tid);
    if (!t) return;
    const oid = String(over.id);
    try {
      if (oid.startsWith('day-')) {
        const fecha = oid.slice(4);
        const sem   = semanaIsoDesdeFecha(new Date(`${fecha}T12:00:00`));
        if (t.tipo === 'planificada' && t.fecha_planificada && t.fecha_planificada !== fecha) {
          setReprDragTarea({ tarea: t, fecha, semana: sem });
          return;
        }
        await mut.moverDia({ tareaId: tid, fecha, semana: sem, tipo: t.tipo });
      }
    } catch (err) {
      console.error('[onDragEnd]', err);
      toast.error('No se pudo mover la tarea.');
    }
  }

  // ── Handlers de acciones ─────────────────────────────────────────────────
  async function confirmarReprDrag(input: { tareaId: string; nuevaFecha: string; justificacion: string }) {
    if (!reprDragTarea || !usuario) return;
    const { tarea: t, semana } = reprDragTarea;
    try {
      const nuevoEstado = resolverEstadoReprogramacion(t, hoyYmd);
      await reprogramarTareaConLog({ tareaId: input.tareaId, usuarioId: usuario.id, nuevaFecha: input.nuevaFecha, justificacion: input.justificacion, nuevoEstado });
      setReprDragTarea(null);
      toast.success('Tarea reprogramada');
      await mut.moverDia({ tareaId: input.tareaId, fecha: input.nuevaFecha, semana, tipo: t.tipo });
    } catch (err) {
      console.error('[confirmarReprDrag]', err);
      toast.error('No se pudo reprogramar la tarea.');
    }
  }

  async function confirmarReprDetalle(input: { tareaId: string; nuevaFecha: string; justificacion: string }) {
    if (!reprDetalleTarea || !usuario) return;
    const nuevoEstado = resolverEstadoReprogramacion(reprDetalleTarea, hoyYmd);
    try {
      await reprogramarTareaConLog({ ...input, usuarioId: usuario.id, nuevoEstado });
      setReprDetalleTarea(null);
      toast.success('Tarea reprogramada');
    } catch (err) {
      console.error('[confirmarReprDetalle]', err);
      toast.error('No se pudo reprogramar la tarea.');
    }
  }

  async function confirmarBloqueo(input: { tareaId: string; justificacion: string }) {
    if (!usuario) return;
    try {
      await bloquearTarea({ ...input, usuarioId: usuario.id });
      setBloquearTareaState(null);
      toast.success('Tarea bloqueada');
    } catch (err) {
      console.error('[confirmarBloqueo]', err);
      toast.error('No se pudo bloquear la tarea.');
    }
  }

  async function confirmarCompletar(input: { tareaId: string; resumen: string }) {
    if (!usuario) return;
    try {
      await mut.completarTareaConResumen({ tareaId: input.tareaId, usuarioId: usuario.id, resumen: input.resumen });
      setCompletarTareaId(null);
      toast.success('Tarea finalizada');
    } catch (err) {
      console.error('[confirmarCompletar]', err);
      toast.error('No se pudo completar la tarea.');
    }
  }

  async function crearTareaDesdeModal(input: {
    titulo: string;
    prioridad: Tarea['prioridad'];
    descripcion: string;
    objetivo_id?: string | null;
    asignado_a?: string | null;
  }) {
    if (!modal || !usuario || !uid) return;
    const asignado = input.asignado_a?.trim() || usuario.id;
    if (modal.modo === 'libre') {
      await mut.crearLibre({ titulo: input.titulo, prioridad: input.prioridad, descripcion: input.descripcion, asignado_a: asignado, creado_por: usuario.id, objetivo_id: input.objetivo_id ?? null });
      toast.success('Tarea libre creada');
    } else if (modal.fecha) {
      await mut.crearPlan({ titulo: input.titulo, prioridad: input.prioridad, descripcion: input.descripcion, fecha_planificada: modal.fecha, asignado_a: asignado, creado_por: usuario.id, objetivo_id: input.objetivo_id ?? null });
      toast.success('Tarea planificada');
    }
  }

  async function crearEventoDesdeModal(input: {
    titulo: string;
    tipo: TipoEvento;
    hora_inicio: string;
    hora_fin: string;
    es_recurrente: boolean;
  }) {
    if (!modal?.fecha || !uid) return;
    await mut.crearEvento({ titulo: input.titulo, tipo: input.tipo, fecha_dia: modal.fecha, hora_inicio: input.hora_inicio, hora_fin: input.hora_fin, usuario_id: uid, es_recurrente: input.es_recurrente });
    toast.success('Evento creado');
  }

  async function guardarDetalle(input: {
    tareaId: string;
    titulo: string;
    prioridad: Tarea['prioridad'];
    descripcion: string;
    objetivo_id?: string | null;
    asignado_a?: string | null;
  }) {
    try {
      await mut.editarTarea(input);
      toast.success('Tarea actualizada');
    } catch (err) {
      console.error('[guardarDetalle]', err);
      toast.error('No se pudo actualizar la tarea.');
    }
  }

  async function eliminarDesdeDetalle(input: { tareaId: string; motivo: string }) {
    if (!usuario) return;
    try {
      await mut.eliminarTarea({ tareaId: input.tareaId, usuarioId: usuario.id, motivo: input.motivo });
      setDetalleTareaId(null);
      toast.success('Tarea eliminada');
    } catch (err) {
      console.error('[eliminarDesdeDetalle]', err);
      toast.error('No se pudo eliminar la tarea.');
    }
  }

  async function iniciarDesdeDetalle(t: Tarea) {
    if (!usuario) return;
    await mut.iniciarTarea({ tareaId: t.id, usuarioId: usuario.id });
    toast.success('Tarea en progreso');
    setDetalleTareaId(null);
  }

  async function planificarDesdeDetalle(t: Tarea, fecha: string) {
    const sem = semanaIsoDesdeFecha(new Date(`${fecha}T12:00:00`));
    await mut.moverDia({ tareaId: t.id, fecha, semana: sem, tipo: t.tipo });
    toast.success('Tarea planificada');
    setDetalleTareaId(null);
  }

  return {
    // Auth
    usuario, esJefe,

    // Semana
    lunes, setLunes, sabado, diasSemana, semanaISO,
    uid, seleccionId, setSeleccionId,
    usuariosJefe,

    // Datos
    tareasPlan, eventos, isError, hoyYmd, conteos,
    objetivosActivos, usuariosAsignables,
    tareaDetalle, tareaCompletar, activeTareaDrag,

    // DnD
    activeDragId, setActiveDragId,
    overId,
    onDragOver,
    onDragEnd,

    // Modales
    modal,             setModal,
    detalleTareaId,    setDetalleTareaId,
    completarTareaId,  setCompletarTareaId,
    bloquearTareaState,setBloquearTareaState,
    reprDetalleTarea,  setReprDetalleTarea,
    reprDragTarea,     setReprDragTarea,

    // Permisos
    puedeGestionar,

    // Handlers
    confirmarReprDrag,
    confirmarReprDetalle,
    confirmarBloqueo,
    confirmarCompletar,
    crearTareaDesdeModal,
    crearEventoDesdeModal,
    guardarDetalle,
    eliminarDesdeDetalle,
    iniciarDesdeDetalle,
    planificarDesdeDetalle,
  };
}