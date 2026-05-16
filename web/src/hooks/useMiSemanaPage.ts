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
import { toast } from 'sonner';

import { useMiSemanaData, useMiSemanaMutations } from '@/hooks/useMiSemana';
import { useIncidenciasDelDia, useNotasBitacoraHoy, Q_INC_HOY } from '@/hooks/useHoyColumnas';
import { useJefesNotificacion } from '@/hooks/useUsuarios';
import { useSemanaDnD } from '@/hooks/useSemanaDnD';
import { useSemanaModales } from '@/hooks/useSemanaModales';
import { useSemanaNavegacion } from '@/hooks/useSemanaNavegacion';
import { useMarcarAtrasadasAlMontar } from '@/hooks/useTareas';
import {
  crearIncidencia,
  getIncidenciasEquipoPorFechaPlanificada,
  getIncidenciasRangoUsuario,
  insertarNotaBitacoraRapida,
} from '@/api/hoyColumnas';
import { getOrdenesPorTareaIds, type OrdenTrabajo } from '@/api/ordenTrabajo';
import { fechaLocalYmd } from '@/lib/fecha';
import { publicarEventoEquipo } from '@/lib/realtimePublish';
import { invalidateRelatedQueries } from '@/lib/queryHelpers';
import { puedeGestionarTarea } from '@/lib/permisos';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import type { Tarea } from '@/types';

export function useMiSemanaPage() {
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
    const c = { pendiente: 0, en_progreso: 0, atrasada: 0, reprogramada: 0, completada: 0, bloqueada: 0 };
    for (const t of tareasPlan) {
      const est = estadoEfectivoTablero(t, hoyYmd);
      if (est in c) c[est as keyof typeof c]++;
    }
    return c;
  }, [tareasPlan, hoyYmd]);

  const desdeYmd = fechaLocalYmd(lunes);
  const hastaYmd = fechaLocalYmd(sabado);
  const verEquipoIncidencias = Boolean(esJefe && uid && usuario?.id && uid === usuario.id);

  const { data: incidenciasSemana = [] } = useQuery({
    queryKey: ['semana', 'incidencias', semanaISO, verEquipoIncidencias ? 'equipo' : uid],
    enabled: Boolean(uid),
    queryFn: () =>
      verEquipoIncidencias
        ? getIncidenciasEquipoPorFechaPlanificada(desdeYmd, hastaYmd)
        : getIncidenciasRangoUsuario(uid!, desdeYmd, hastaYmd),
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
    let bloqueadas = 0;
    for (const t of tareasPlan) {
      const est = estadoEfectivoTablero(t, hoyYmd);
      if (t.fecha_planificada === hoyYmd && est === 'pendiente') pendientesHoy++;
      if (est === 'atrasada') atrasadas++;
      if (est === 'bloqueada') bloqueadas++;
    }
    return { pendientesHoy, atrasadas, bloqueadas };
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
  const { data: notasHoy       = [] } = useNotasBitacoraHoy(uid);

  const { data: jefesNotificacion = [] } = useJefesNotificacion({
    enabled: Boolean(usuario && !esJefe),
  });

  const [modalInc,   setModalInc]   = useState(false);
  const [notaRapida, setNotaRapida] = useState('');

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
      toast.success('Nota guardada');
    } catch (err) {
      console.error('[guardarNotaRapida]', err);
      toast.error('No se pudo guardar la nota.');
    }
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
    crearIncidenciaHoy, guardarNotaRapida,
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
    bloquearTareaState:  modales.bloquearTareaState,
    setBloquearTareaState: modales.setBloquearTareaState,
    reprDetalleTarea:    modales.reprDetalleTarea,
    setReprDetalleTarea: modales.setReprDetalleTarea,
    reprDragTarea:       dnd.reprDragTarea,
    setReprDragTarea:    dnd.setReprDragTarea,
    puedeGestionar,
    confirmarReprDrag:     dnd.confirmarReprDrag,
    confirmarReprDetalle:  modales.confirmarReprDetalle,
    confirmarBloqueo:      modales.confirmarBloqueo,
    confirmarCompletar:    modales.confirmarCompletar,
    crearTareaDesdeModal:  modales.crearTareaDesdeModal,
    crearEventoDesdeModal: modales.crearEventoDesdeModal,
    guardarDetalle:        modales.guardarDetalle,
    eliminarDesdeDetalle:  modales.eliminarDesdeDetalle,
    iniciarDesdeDetalle:   modales.iniciarDesdeDetalle,
  };
}