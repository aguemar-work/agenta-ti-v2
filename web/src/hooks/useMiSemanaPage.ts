/**
 * hooks/useMiSemanaPage.ts
 * Centraliza toda la lógica de negocio, estado y handlers de la vista MiSemana.
 * MiSemana.tsx solo consume este hook y renderiza JSX.
 */

import { type DragEndEvent, type DragOverEvent } from '@dnd-kit/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { getObjetivosActivos } from '@/api/objetivos';
import { insertarNotaBitacoraRapida, crearIncidenciaHoy } from '@/api/hoyColumnas';
import {
  useIncidenciasDelDia,
  useNotasBitacoraHoy,
  useEventosHoy,
  Q_INC_HOY,
} from '@/hooks/useHoyColumnas';
import { useJefesNotificacion, useUsuariosActivos } from '@/hooks/useUsuarios';
import { useMiSemanaData, useMiSemanaMutations } from '@/hooks/useMiSemana';
import { bloquearTarea, reprogramarTareaConLog, useMarcarAtrasadasAlMontar, useUsuariosParaSelector } from '@/hooks/useTareas';
import { fechaLocalYmd } from '@/lib/fecha';
import { resolverEstadoReprogramacion } from '@/lib/tareaEstado';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import { agregarDias, inicioSemanaIso, semanaIsoDesdeFecha } from '@/lib/semanas';
import { useAuthStore } from '@/store/authStore';
import { publicarEventoEquipo } from '@/lib/realtimePublish';
import { useVistaStore } from '@/store/vistaStore';
import type { Tarea, TipoEvento } from '@/types';

export function useMiSemanaPage() {
  const usuario = useAuthStore((s) => s.usuario);
  const esJefe  = usuario?.rol === 'jefe';
  const qc      = useQueryClient();

  // ── Modo: Hoy vs Semana ──────────────────────────────────────────────────
  // Regla: se usa la preferencia guardada del usuario si existe.
  // Si no hay preferencia (primera visita del día o sesión nueva), se aplica
  // el modo automático: lun–jue = Hoy, vie–dom = Semana.
  // La preferencia sobrevive navegaciones dentro de la misma sesión y
  // se persiste en localStorage para la próxima visita.
  const LS_KEY = 'mc-modo-semana';
  function modoInicial(): 'hoy' | 'semana' {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved === 'hoy' || saved === 'semana') return saved;
    } catch { /* localStorage no disponible */ }
    const dow = new Date().getDay(); // 0=dom, 1=lun, ..., 5=vie, 6=sab
    return dow >= 1 && dow <= 4 ? 'hoy' : 'semana';
  }
  const [modo, setModoState] = useState<'hoy' | 'semana'>(modoInicial);
  function setModo(m: 'hoy' | 'semana') {
    try { localStorage.setItem(LS_KEY, m); } catch { /* ignorar */ }
    setModoState(m);
  }
  const esModoHoy = modo === 'hoy';
  const esBannerViernes = new Date().getDay() === 5;

  // ── Navegación de semana ──────────────────────────────────────────────────
  const [lunes,        setLunes]        = useState(() => inicioSemanaIso(new Date()));
  const seleccionIdStore   = useVistaStore((s) => s.seleccionId);
  const setSeleccionIdStore = useVistaStore((s) => s.setSeleccionId);

  // ── Estado de modales ─────────────────────────────────────────────────────
  const [modal,             setModal]             = useState<{ fecha: string } | null>(null);
  const [modalInc,          setModalInc]          = useState(false);
  const [notaRapida,        setNotaRapida]        = useState('');
  const [detalleTareaId,    setDetalleTareaId]    = useState<string | null>(null);
  const [completarTareaId,  setCompletarTareaId]  = useState<string | null>(null);
  const [bloquearTareaState,setBloquearTareaState]= useState<Tarea | null>(null);
  const [reprDetalleTarea,  setReprDetalleTarea]  = useState<Tarea | null>(null);
  const [reprDragTarea,     setReprDragTarea]     = useState<{ tarea: Tarea; fecha: string; semana: string } | null>(null);

  // ── Estado de DnD ─────────────────────────────────────────────────────────
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [overId,       setOverId]       = useState<string | null>(null);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: usuariosJefe } = useUsuariosParaSelector(Boolean(esJefe));
  const { data: objetivosActivos   = [] } = useQuery({
    queryKey: ['objetivos-activos-mi-semana'],
    queryFn:  () => getObjetivosActivos(),
  });
  const { data: usuariosAsignables = [] } = useUsuariosActivos();
  const { data: jefesNotificacion = [] } = useJefesNotificacion({
    enabled: Boolean(usuario && !esJefe),
  });

  const seleccionId = seleccionIdStore ?? usuario?.id;
  const setSeleccionId = (id: string) => { setSeleccionIdStore(id); };
  const uid = seleccionId;
  const semanaISO = semanaIsoDesdeFecha(lunes);

  useMarcarAtrasadasAlMontar(uid);
  const { tareasPlan, eventos, isError } = useMiSemanaData(uid, semanaISO, lunes);
  const mut = useMiSemanaMutations(uid, semanaISO);

  // ── Queries modo Hoy (lazy: solo cuando esModoHoy) ───────────────────────
  const hoyYmd = fechaLocalYmd(new Date());
  const { data: incidenciasHoy = [] } = useIncidenciasDelDia(esModoHoy ? uid : undefined, hoyYmd);
  const { data: notasHoy       = [] } = useNotasBitacoraHoy(esModoHoy ? uid : undefined);
  const { data: eventosHoy     = [] } = useEventosHoy(esModoHoy ? uid : undefined, hoyYmd);

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
        await mut.moverDia({ tareaId: tid, fecha, semana: sem });
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
      await mut.moverDia({ tareaId: input.tareaId, fecha: input.nuevaFecha, semana });
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
      // Invalidar semana para reflejar nueva fecha
      await qc.invalidateQueries({ queryKey: ['semana'], exact: false });
      await qc.invalidateQueries({ queryKey: ['tareas-hoy'] });
      await qc.invalidateQueries({ queryKey: ['planificacion'] });
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
      // Invalidar para reflejar cambio de estado
      await qc.invalidateQueries({ queryKey: ['semana'], exact: false });
      await qc.invalidateQueries({ queryKey: ['tablero'], exact: false });
      await qc.invalidateQueries({ queryKey: ['tareas-hoy'] });
    } catch (err) {
      console.error('[confirmarBloqueo]', err);
      toast.error('No se pudo bloquear la tarea.');
    }
  }

  async function confirmarCompletar(input: { tareaId: string; resumen: string }) {
    if (!usuario) return;
    try {
      await mut.completarTareaConResumen({
        tareaId: input.tareaId,
        usuarioId: usuario.id,
        usuarioNombre: usuario.nombre,
        tareaTitulo: tareaCompletar?.titulo,
        jefeIds: esJefe ? undefined : jefesNotificacion.map((jefe) => jefe.id),
        resumen: input.resumen,
      });
      setCompletarTareaId(null);
      toast.success('Tarea finalizada');
      // Invalidar todo para reflejar cambio
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['semana'], exact: false }),
        qc.invalidateQueries({ queryKey: ['tablero'], exact: false }),
        qc.invalidateQueries({ queryKey: ['tareas-hoy'] }),
        qc.invalidateQueries({ queryKey: ['planificacion'] }),
      ]);
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
    if (modal.fecha) {
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
    if (!usuario) return;
    try {
      await mut.editarTarea({ ...input, usuarioActorId: usuario.id });
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
    try {
      await mut.iniciarTarea({ tareaId: t.id, usuarioId: usuario.id });
      toast.success('Tarea en progreso');
      setDetalleTareaId(null);
    } catch (err) {
      console.error('[iniciarDesdeDetalle]', err);
      toast.error('No se pudo iniciar la tarea.');
    }
  }

  // ── Handlers modo Hoy ────────────────────────────────────────────────────
  async function crearIncidencia(input: {
    titulo: string;
    prioridad: Tarea['prioridad'];
    descripcion?: string | null;
    asignado_a?: string | null;
  }) {
    if (!usuario || !uid) return;
    const incidencia = await crearIncidenciaHoy({
      titulo:           input.titulo,
      prioridad:        input.prioridad,
      descripcion:      input.descripcion ?? null,
      asignado_a:       input.asignado_a ?? uid,
      creado_por:       usuario.id,
      fecha_planificada: hoyYmd,
    });
    if (incidencia.asignado_a === uid && incidencia.fecha_planificada === hoyYmd) {
      qc.setQueryData<Tarea[]>([Q_INC_HOY, uid, hoyYmd], (prev = []) => [incidencia, ...prev]);
    }
    if (!esJefe) {
      void Promise.all(jefesNotificacion.map((jefe) =>
        publicarEventoEquipo({
          tipo: 'incidencia_registrada',
          jefeId: jefe.id,
          titulo: incidencia.titulo,
          usuarioNombre: usuario.nombre,
        }),
      ));
    }
    // Invalidar queries de incidencias para que aparezcan sin F5
    await Promise.all([
      qc.invalidateQueries({ queryKey: [Q_INC_HOY], exact: false }),
      qc.invalidateQueries({ queryKey: ['tablero'], exact: false }),
      qc.invalidateQueries({ queryKey: ['planificacion'], exact: false }),
    ]);
    toast.success('Incidencia registrada');
    setModalInc(false);
  }

  async function guardarNotaRapida() {
    if (!notaRapida.trim() || !uid) return;
    try {
      await insertarNotaBitacoraRapida({
        usuario_id: uid,
        contenido:  notaRapida.trim(),
      });
      setNotaRapida('');
      toast.success('Nota guardada');
    } catch (err) {
      console.error('[guardarNotaRapida]', err);
      toast.error('No se pudo guardar la nota.');
    }
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
    // Modo
    modo, setModo, esModoHoy, esBannerViernes,
    // Datos modo Hoy
    incidenciasHoy, notasHoy, eventosHoy,
    modalInc, setModalInc,
    notaRapida, setNotaRapida,
    crearIncidencia, guardarNotaRapida,
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
  };
}