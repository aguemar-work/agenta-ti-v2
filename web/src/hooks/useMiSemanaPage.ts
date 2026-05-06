/**
 * hooks/useMiSemanaPage.ts
 *
 * Orquestador de la vista Mi Semana. Compone los hooks especializados y
 * retorna el contrato que consume MiSemana.tsx sin cambios.
 *
 * Hooks especializados:
 *   useSemanaNavegacion  — modo Hoy/Semana, lunes, semanaISO, selector usuario
 *   useModoHoy           — queries y handlers del panel "Ahora"
 *   useSemanaDnD         — drag & drop entre días
 *   useSemanaModales     — estado de los 9 modales + handlers de acción
 */

import { useMemo } from 'react';

import { useMiSemanaData, useMiSemanaMutations } from '@/hooks/useMiSemana';
import { useModoHoy } from '@/hooks/useModoHoy';
import { useSemanaDnD } from '@/hooks/useSemanaDnD';
import { useSemanaModales } from '@/hooks/useSemanaModales';
import { useSemanaNavegacion } from '@/hooks/useSemanaNavegacion';
import { useMarcarAtrasadasAlMontar } from '@/hooks/useTareas';
import { puedeGestionarTarea } from '@/lib/permisos';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import type { Tarea } from '@/types';

export function useMiSemanaPage() {
  // ── Navegación y contexto ─────────────────────────────────────────────────
  const nav = useSemanaNavegacion();
  const {
    usuario, esJefe,
    lunes, setLunes, sabado, diasSemana, semanaISO, hoyYmd,
    uid, seleccionId, setSeleccionId,
    usuariosJefe, usuariosAsignables, objetivosActivos,
    modo, setModo, esModoHoy, esBannerViernes,
  } = nav;

  // ── Datos de la semana ────────────────────────────────────────────────────
  useMarcarAtrasadasAlMontar(uid);
  const { tareasPlan, eventos, isError } = useMiSemanaData(uid, semanaISO, lunes);
  const mut = useMiSemanaMutations(uid, semanaISO);

  // ── Conteos para la barra de resumen ─────────────────────────────────────
  const conteos = useMemo(() => {
    const c = { pendiente: 0, en_progreso: 0, atrasada: 0, reprogramada: 0, completada: 0 };
    for (const t of tareasPlan) {
      const est = estadoEfectivoTablero(t, hoyYmd);
      if (est in c) c[est as keyof typeof c]++;
    }
    return c;
  }, [tareasPlan, hoyYmd]);

  // ── Panel Hoy ─────────────────────────────────────────────────────────────
  const hoy = useModoHoy({ uid, hoyYmd, esModoHoy, usuario, esJefe });

  // ── Drag & Drop ───────────────────────────────────────────────────────────
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
    jefesNotificacion: hoy.jefesNotificacion,
    mut,
  });

  // ── Permisos ──────────────────────────────────────────────────────────────
  function puedeGestionar(t: Tarea) {
    return puedeGestionarTarea(t, usuario);
  }

  // ── Return (contrato idéntico al original — MiSemana.tsx no cambia) ───────
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
    incidenciasHoy:     hoy.incidenciasHoy,
    notasHoy:           hoy.notasHoy,
    eventosHoy:         hoy.eventosHoy,
    modalInc:           hoy.modalInc,
    setModalInc:        hoy.setModalInc,
    notaRapida:         hoy.notaRapida,
    setNotaRapida:      hoy.setNotaRapida,
    crearIncidenciaHoy: hoy.crearIncidenciaHoy,
    guardarNotaRapida:  hoy.guardarNotaRapida,
    objetivosActivos, usuariosAsignables,

    // Datos derivados de modales
    tareaDetalle:   modales.tareaDetalle,
    tareaCompletar: modales.tareaCompletar,

    // DnD
    activeTareaDrag:  dnd.activeTareaDrag,
    activeDragId:     dnd.activeDragId,
    setActiveDragId:  dnd.setActiveDragId,
    overId:           dnd.overId,
    onDragOver:       dnd.onDragOver,
    onDragEnd:        dnd.onDragEnd,

    // Modales
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

    // Permisos
    puedeGestionar,

    // Handlers
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