/**
 * hooks/useMiSemanaPage.ts
 *
 * Orquestador de la vista Mi Semana V4.
 * Siempre muestra la semana completa (6 días).
 * Las incidencias se registran por día — solo el día actual permite crear nuevas.
 * Las notas viven en el panel lateral derecho.
 */

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useMiSemanaData, useMiSemanaMutations } from '@/hooks/useMiSemana';
import { useIncidenciasDelDia, useNotasBitacoraHoy, Q_INC_HOY } from '@/hooks/useHoyColumnas';
import { useJefesNotificacion } from '@/hooks/useUsuarios';
import { useSemanaDnD } from '@/hooks/useSemanaDnD';
import { useSemanaModales } from '@/hooks/useSemanaModales';
import { useSemanaNavegacion } from '@/hooks/useSemanaNavegacion';
import { useMarcarAtrasadasAlMontar } from '@/hooks/useTareas';
import { crearIncidencia, insertarNotaBitacoraRapida } from '@/api/hoyColumnas';
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
  const mut = useMiSemanaMutations(uid, semanaISO);

  const conteos = useMemo(() => {
    const c = { pendiente: 0, en_progreso: 0, atrasada: 0, reprogramada: 0, completada: 0 };
    for (const t of tareasPlan) {
      const est = estadoEfectivoTablero(t, hoyYmd);
      if (est in c) c[est as keyof typeof c]++;
    }
    return c;
  }, [tareasPlan, hoyYmd]);

  // ── Incidencias de hoy y notas ────────────────────────────────────────────
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
    ya_resuelta:  boolean;
  }) {
    if (!usuario || !uid) return;
    const incidencia = await crearIncidencia({
      titulo:            input.titulo,
      prioridad:         input.prioridad,
      descripcion:       input.descripcion ?? null,
      asignado_a:        input.asignado_a ?? uid,
      fecha_planificada: hoyYmd,
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
    incidenciasHoy, notasHoy,
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