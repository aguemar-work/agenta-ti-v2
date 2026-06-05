/**
 * hooks/useMiSemanaPage.ts
 *
 * Orquestador de la vista Mi Semana V4.
 * Siempre muestra la semana completa (6 días).
 * Las incidencias se registran por día — solo el día actual permite crear nuevas.
 * Las notas viven en el panel lateral derecho.
 */

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useMiSemanaData, useMiSemanaMutations } from '@/hooks/useMiSemana';
import { useIncidenciasDelDia, useNotasBitacoraHoy, Q_INC_HOY, Q_NOTAS_HOY } from '@/hooks/useHoyColumnas';
import { useJefesNotificacion } from '@/hooks/useUsuarios';
import { useSemanaDnD } from '@/hooks/useSemanaDnD';
import { useSemanaModales } from '@/hooks/useSemanaModales';
import { useSemanaNavegacion } from '@/hooks/useSemanaNavegacion';
import { useMarcarAtrasadasAlMontar } from '@/hooks/useTareas';
import {
  convertirNotaEnEvento as convertirNotaEnEventoApi,
  convertirNotaEnTarea as convertirNotaEnTareaApi,
  crearIncidencia,
  getIncidenciasRangoUsuario,
  insertarNotaBitacoraRapida,
} from '@/api/hoyColumnas';
import { getOrdenesPorTareaIds, crearOtDesdeTarea, type OrdenTrabajo } from '@/api/ordenTrabajo';
import { fechaLocalYmd } from '@/lib/fecha';
import { publicarEventoEquipo } from '@/lib/realtimePublish';
import { invalidateRelatedQueries } from '@/lib/queryHelpers';
import { puedeGestionarTarea } from '@/lib/permisos';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import type { NotaBitacora, Tarea, TipoEvento } from '@/types';

export function useMiSemanaPage() {
  const navigate = useNavigate();
  const nav = useSemanaNavegacion();
  const {
    usuario, esJefe,
    lunes, setLunes, sabado, diasSemana, semanaISO, hoyYmd,
    uid, seleccionId, setSeleccionId,
    usuariosJefe, usuariosAsignables, objetivosActivos,
    esBannerViernes,
  } = nav;

  const qc = useQueryClient();

  useMarcarAtrasadasAlMontar(uid);
  const { tareasPlan, eventos, isError } = useMiSemanaData(uid, semanaISO, lunes);
  const mut = useMiSemanaMutations(uid);

  const conteos = useMemo(() => {
    const c = { pendiente: 0, en_progreso: 0, atrasada: 0, reprogramada: 0, completada: 0 };
    for (const t of tareasPlan) {
      const est = estadoEfectivoTablero(t, hoyYmd);
      if (est in c) c[est as keyof typeof c]++;
    }
    return c;
  }, [tareasPlan, hoyYmd]);

  const desdeYmd = fechaLocalYmd(lunes);
  const hastaYmd = fechaLocalYmd(sabado);
  /** Siempre incidencias del usuario de la vista activa (el jefe ve las suyas; otras vías selector). */
  const { data: incidenciasSemana = [] } = useQuery({
    queryKey: ['semana', 'incidencias', semanaISO, uid],
    enabled: Boolean(uid),
    queryFn: () => getIncidenciasRangoUsuario(uid!, desdeYmd, hastaYmd),
  });

  const tareaIds = useMemo(() => tareasPlan.map((t) => t.id), [tareasPlan]);
  const { data: ordenesPorTarea = new Map<string, OrdenTrabajo>() } = useQuery({
    queryKey: ['semana', 'ot-por-tarea', tareaIds],
    enabled: tareaIds.length > 0,
    queryFn: () => getOrdenesPorTareaIds(tareaIds),
  });

  const nombresPorId = useMemo(() => {
    const m = new Map<string, string>();
    if (usuario) m.set(usuario.id, usuario.nombre);
    for (const u of usuariosAsignables) m.set(u.id, u.nombre);
    for (const u of usuariosJefe ?? []) m.set(u.id, u.nombre);
    return m;
  }, [usuario, usuariosAsignables, usuariosJefe]);

  const resumenDia = useMemo(() => {
    let pendientesHoy = 0;
    let atrasadas = 0;
    for (const t of tareasPlan) {
      const est = estadoEfectivoTablero(t, hoyYmd);
      if (t.fecha_planificada === hoyYmd && est === 'pendiente') pendientesHoy++;
      if (est === 'atrasada') atrasadas++;
    }
    return { pendientesHoy, atrasadas };
  }, [tareasPlan, hoyYmd]);

  const [ocultarCompletadas, setOcultarCompletadas] = useState(() => {
    try {
      const v = localStorage.getItem('mc-misemana-hide-completed');
      if (v !== null) return v === '1';
      return localStorage.getItem('mc-misemana-compact') === '1';
    } catch { return false; }
  });

  function toggleOcultarCompletadas() {
    setOcultarCompletadas((v) => {
      const next = !v;
      try {
        localStorage.setItem('mc-misemana-hide-completed', next ? '1' : '0');
        localStorage.removeItem('mc-misemana-compact');
      } catch { /* ignore */ }
      return next;
    });
  }

  // ── Incidencias de hoy (registro rápido) y notas ─────────────────────────
  const { data: incidenciasHoy = [] } = useIncidenciasDelDia(uid, hoyYmd);
  const { data: notasHoy       = [] } = useNotasBitacoraHoy(uid, esJefe);

  const { data: jefesNotificacion = [] } = useJefesNotificacion({
    enabled: Boolean(usuario && !esJefe),
  });

  const [modalInc,   setModalInc]   = useState(false);
  const [notaRapida, setNotaRapida] = useState('');
  const [notaConvertir, setNotaConvertir] = useState<NotaBitacora | null>(null);

  async function invalidarNotasYSemana() {
    await invalidateRelatedQueries(qc, ['semana', 'bitacora']);
    await qc.invalidateQueries({ queryKey: [Q_NOTAS_HOY], exact: false });
  }

  async function crearIncidenciaHoy(input: {
    titulo:       string;
    prioridad:    Tarea['prioridad'];
    descripcion?: string | null;
    asignado_a?:  string | null;
    fecha_planificada?: string;
    ya_resuelta:  boolean;
  }) {
    if (!usuario || !uid) return;
    const fecha = input.fecha_planificada ?? hoyYmd;
    const incidencia = await crearIncidencia({
      titulo:            input.titulo,
      prioridad:         input.prioridad,
      descripcion:       input.descripcion ?? null,
      asignado_a:        input.asignado_a ?? uid,
      fecha_planificada: fecha,
      ya_resuelta:       input.ya_resuelta,
    });

    if (!esJefe) {
      void Promise.all(
        jefesNotificacion.map((jefe) =>
          publicarEventoEquipo({
            tipo:          'incidencia_registrada',
            jefeId:        jefe.id,
            titulo:        incidencia.titulo,
            usuarioNombre: usuario.nombre,
          }),
        ),
      );
    }

    await invalidateRelatedQueries(qc, ['planificacion', 'semana']);
    await qc.invalidateQueries({ queryKey: [Q_INC_HOY], exact: false });
    toast.success(input.ya_resuelta ? 'Incidencia registrada' : 'Incidencia agendada');
    setModalInc(false);
  }

  async function guardarNotaRapida() {
    if (!notaRapida.trim() || !uid) return;
    try {
      await insertarNotaBitacoraRapida({ usuario_id: uid, contenido: notaRapida.trim() });
      setNotaRapida('');
      await invalidarNotasYSemana();
      toast.success('Nota guardada');
    } catch (err) {
      console.error('[guardarNotaRapida]', err);
      toast.error('No se pudo guardar la nota.');
    }
  }

  async function confirmarConvertirNotaTarea(input: {
    titulo: string;
    prioridad: Tarea['prioridad'];
    descripcion: string;
    fecha_planificada: string;
    asignado_a: string;
  }) {
    if (!usuario || !notaConvertir) return;
    await convertirNotaEnTareaApi({
      notaId: notaConvertir.id,
      titulo: input.titulo,
      descripcion: input.descripcion,
      prioridad: input.prioridad,
      fecha_planificada: input.fecha_planificada,
      asignado_a: input.asignado_a,
      creado_por: usuario.id,
    });
    setNotaConvertir(null);
    await invalidarNotasYSemana();
    toast.success('Nota convertida en tarea');
  }

  async function confirmarConvertirNotaEvento(input: {
    titulo: string;
    tipo: TipoEvento;
    fecha_dia: string;
    hora_inicio: string;
    hora_fin: string;
  }) {
    if (!usuario || !notaConvertir) return;
    await convertirNotaEnEventoApi({
      notaId: notaConvertir.id,
      titulo: input.titulo,
      tipo: input.tipo,
      fecha_dia: input.fecha_dia,
      hora_inicio: input.hora_inicio,
      hora_fin: input.hora_fin,
      usuario_id: usuario.id,
    });
    setNotaConvertir(null);
    await invalidarNotasYSemana();
    toast.success('Nota convertida en evento');
  }

  // ── DnD ───────────────────────────────────────────────────────────────────
  const dnd = useSemanaDnD({
    tareasPlan,
    hoyYmd,
    usuarioId: usuario?.id,
    onMoverDia: mut.moverDia,
  });

  // ── Modales ───────────────────────────────────────────────────────────────
  const modales = useSemanaModales({
    tareasPlan,
    hoyYmd,
    usuario,
    jefesNotificacion,
    mut,
  });

  function puedeGestionar(t: Tarea) {
    return puedeGestionarTarea(t, usuario);
  }

  async function generarOtDesdeTarea(t: Tarea) {
    if (!usuario || !puedeGestionar(t)) return;
    if (t.es_imprevisto || ['completada', 'cancelada'].includes(t.estado)) return;
    if (ordenesPorTarea.has(t.id)) {
      const ot = ordenesPorTarea.get(t.id)!;
      navigate('/ordenes-trabajo', { state: { abrirOtId: ot.id } });
      return;
    }
    try {
      const otId = await crearOtDesdeTarea({
        tareaId:       t.id,
        fechaEstimada: t.fecha_planificada ?? hoyYmd,
      });
      await invalidateRelatedQueries(qc, ['ot', 'semana']);
      modales.setDetalleTareaId(null);
      navigate('/ordenes-trabajo', { state: { abrirOtId: otId } });
      toast.success('OT creada en borrador');
    } catch (err) {
      console.error('[generarOtDesdeTarea]', err);
      toast.error('No se pudo crear la OT.');
    }
  }

  return {
    usuario, esJefe,
    lunes, setLunes, sabado, diasSemana, semanaISO,
    uid, seleccionId, setSeleccionId,
    usuariosJefe, esBannerViernes,
    tareasPlan, eventos, isError, hoyYmd, conteos,
    incidenciasSemana, incidenciasHoy, notasHoy,
    ordenesPorTarea, nombresPorId, resumenDia,
    ocultarCompletadas, toggleOcultarCompletadas,
    modalInc, setModalInc,
    notaRapida, setNotaRapida,
    notaConvertir, setNotaConvertir,
    crearIncidenciaHoy, guardarNotaRapida,
    confirmarConvertirNotaTarea, confirmarConvertirNotaEvento,
    objetivosActivos, usuariosAsignables,
    tareaDetalle:   modales.tareaDetalle,
    tareaCompletar: modales.tareaCompletar,
    activeTareaDrag:  dnd.activeTareaDrag,
    activeDragId:     dnd.activeDragId,
    setActiveDragId:  dnd.setActiveDragId,
    overId:           dnd.overId,
    onDragOver:       dnd.onDragOver,
    onDragEnd:        dnd.onDragEnd,
    modal:               modales.modal,
    setModal:            modales.setModal,
    detalleTareaId:      modales.detalleTareaId,
    setDetalleTareaId:   modales.setDetalleTareaId,
    completarTareaId:    modales.completarTareaId,
    setCompletarTareaId: modales.setCompletarTareaId,
    reprDetalleTarea:    modales.reprDetalleTarea,
    setReprDetalleTarea: modales.setReprDetalleTarea,
    reprDragTarea:       dnd.reprDragTarea,
    setReprDragTarea:    dnd.setReprDragTarea,
    puedeGestionar,
    confirmarReprDrag:     dnd.confirmarReprDrag,
    confirmarReprDetalle:  modales.confirmarReprDetalle,
    confirmarCompletar:    modales.confirmarCompletar,
    crearTareaDesdeModal:  modales.crearTareaDesdeModal,
    crearEventoDesdeModal: modales.crearEventoDesdeModal,
    guardarDetalle:        modales.guardarDetalle,
    eliminarDesdeDetalle:  modales.eliminarDesdeDetalle,
    cancelarDesdeDetalle:  modales.cancelarDesdeDetalle,
    iniciarDesdeDetalle:   modales.iniciarDesdeDetalle,
    generarOtDesdeTarea,
  };
}