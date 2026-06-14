/**
 * hooks/useMiSemanaPage.ts
 *
 * Orquestador de la vista Mi Semana.
 * Coordina datos, catálogos, modales y acciones — sin lógica de UI propia.
 */

import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useMiSemanaData, useMiSemanaMutations } from '@/hooks/useMiSemana';
import { useMiSemanaCatalogos } from '@/hooks/useMiSemanaCatalogos';
import { useSemanaNotasIncidencias } from '@/hooks/useSemanaNotasIncidencias';
import { useWorkspaceId } from '@/hooks/useWorkspaceId';
import { useSemanaModales } from '@/hooks/useSemanaModales';
import { useSemanaNavegacion } from '@/hooks/useSemanaNavegacion';
import { useMarcarAtrasadasAlMontar } from '@/hooks/useTareas';
import { getOrdenesPorTareaIds, crearOtDesdeTarea, type OrdenTrabajo } from '@/api/ordenTrabajo';
import { getIncidenciasRangoUsuario } from '@/api/hoyColumnas';
import { fechaLocalYmd } from '@/lib/fecha';
import { invalidateRelatedQueries } from '@/lib/queryHelpers';
import { qkWsId } from '@/lib/queryKeys';
import { puedeGestionarTarea } from '@/lib/permisos';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import type { Tarea } from '@/types';

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

  const qc          = useQueryClient();
  const workspaceId = useWorkspaceId();

  // ── Catálogos opcionales ──────────────────────────────────────────────────
  const catalogos = useMiSemanaCatalogos();

  // ── Datos de la semana ────────────────────────────────────────────────────
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

  const { data: incidenciasSemana = [] } = useQuery({
    queryKey: qkWsId(workspaceId, 'semana', 'incidencias', semanaISO, uid),
    enabled: Boolean(uid) && Boolean(workspaceId),
    queryFn: () => getIncidenciasRangoUsuario(uid!, desdeYmd, hastaYmd),
  });

  const tareaIds = useMemo(() => tareasPlan.map((t) => t.id), [tareasPlan]);
  const { data: ordenesPorTarea = new Map<string, OrdenTrabajo>() } = useQuery({
    queryKey: qkWsId(workspaceId, 'semana', 'ot-por-tarea', tareaIds),
    enabled: tareaIds.length > 0 && Boolean(workspaceId),
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

  // ── Notas e incidencias ───────────────────────────────────────────────────
  const notasInc = useSemanaNotasIncidencias({ uid, esJefe, hoyYmd, usuario });

  // ── Modales de tareas ─────────────────────────────────────────────────────
  const modales = useSemanaModales({
    tareasPlan,
    hoyYmd,
    usuario,
    jefesNotificacion: notasInc.jefesNotificacion,
    mut,
  });

  function puedeGestionar(t: Tarea) {
    return puedeGestionarTarea(t, usuario);
  }

  // ── OT desde tarea ────────────────────────────────────────────────────────
  async function generarOtDesdeTarea(t: Tarea) {
    if (!usuario || !puedeGestionar(t)) return;
    if (t.es_imprevisto || ['completada', 'cancelada'].includes(t.estado)) return;
    if (ordenesPorTarea.has(t.id)) {
      navigate('/ordenes-trabajo', { state: { abrirOtId: ordenesPorTarea.get(t.id)!.id } });
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
    // Navegación
    usuario, esJefe,
    lunes, setLunes, sabado, diasSemana, semanaISO,
    uid, seleccionId, setSeleccionId,
    usuariosJefe, esBannerViernes,
    // Datos semana
    tareasPlan, eventos, isError, hoyYmd, conteos,
    incidenciasSemana, ordenesPorTarea, nombresPorId, resumenDia,
    // Catálogos
    ...catalogos,
    // Objetivos y usuarios
    objetivosActivos, usuariosAsignables,
    // Notas e incidencias
    incidenciasHoy:            notasInc.incidenciasHoy,
    notasHoy:                  notasInc.notasHoy,
    modalInc:                  notasInc.modalInc,
    setModalInc:               notasInc.setModalInc,
    notaRapida:                notasInc.notaRapida,
    setNotaRapida:             notasInc.setNotaRapida,
    notaConvertir:             notasInc.notaConvertir,
    setNotaConvertir:          notasInc.setNotaConvertir,
    crearIncidenciaHoy:        notasInc.crearIncidenciaHoy,
    guardarNotaRapida:         notasInc.guardarNotaRapida,
    confirmarConvertirNotaTarea:  notasInc.confirmarConvertirNotaTarea,
    confirmarConvertirNotaEvento: notasInc.confirmarConvertirNotaEvento,
    // OT
    completarPendingId: mut.completarPendingId,
    iniciarPendingId:   mut.iniciarPendingId,
    generarOtDesdeTarea,
    // Modales de tareas
    tareaDetalle:        modales.tareaDetalle,
    tareaCompletar:      modales.tareaCompletar,
    modal:               modales.modal,
    setModal:            modales.setModal,
    detalleTareaId:      modales.detalleTareaId,
    setDetalleTareaId:   modales.setDetalleTareaId,
    completarTareaId:    modales.completarTareaId,
    setCompletarTareaId: modales.setCompletarTareaId,
    reprDetalleTarea:    modales.reprDetalleTarea,
    setReprDetalleTarea: modales.setReprDetalleTarea,
    puedeGestionar,
    confirmarReprDetalle:  modales.confirmarReprDetalle,
    confirmarCompletar:    modales.confirmarCompletar,
    crearTareaDesdeModal:  modales.crearTareaDesdeModal,
    crearEventoDesdeModal: modales.crearEventoDesdeModal,
    guardarDetalle:        modales.guardarDetalle,
    eliminarDesdeDetalle:  modales.eliminarDesdeDetalle,
    cancelarDesdeDetalle:  modales.cancelarDesdeDetalle,
    iniciarDesdeDetalle:   modales.iniciarDesdeDetalle,
    moverTareaADia:        modales.moverTareaADia,
  };
}
