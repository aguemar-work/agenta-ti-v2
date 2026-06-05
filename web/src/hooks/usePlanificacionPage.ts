/**
 * hooks/usePlanificacionPage.ts
 * Centraliza toda la lógica de negocio, estado y mutaciones de la vista Planificación.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MIN_JUSTIFICACION_CHARS } from '@/lib/constants';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import {
  getActividadEquipoSemana,
  getHistorialLogs,
  aceptarJustificacionJefe,
  devolverJustificacionJefe,
  getJustificacionesPendientesJefe,
  type FiltrosHistorialLog,
} from '@/api/audit';
import { useUsuariosActivos } from '@/hooks/useUsuarios';
import {
  fechaLunesDesdeSemanaIso,
  getCargaEquipoSemana,
  getIncidenciasEquipoSemana,
  getMiembrosActivos,
  getTareasUsuarioDia,
} from '@/api/planificacion';
import {
  crearTareaPlanificada,
  reprogramarTareaConLog,
} from '@/api/semana';
import { getObjetivosActivos } from '@/api/objetivos';
import { invalidateRelatedQueries } from '@/lib/queryHelpers';
import { getInsforge } from '@/lib/insforge';
import { fechaLocalYmd } from '@/lib/fecha';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import { agregarDias, inicioSemanaIso, numeroSemanaDesdeLunes, semanaIsoDesdeFecha } from '@/lib/semanas';
import { useAuthStore } from '@/store/authStore';
import type { ClaveVisualTarea, Tarea } from '@/types';

export const Q_LOGS = 'audit-logs-pendientes';

export function usePlanificacionPage() {
  const qc = useQueryClient();
  const usuario = useAuthStore((s) => s.usuario);
  const hoyYmd = fechaLocalYmd(new Date());

  // ── Navegación de semana ──────────────────────────────────────────────────
  const [lunes, setLunes] = useState(() => inicioSemanaIso(new Date()));
  const semanaISO = semanaIsoDesdeFecha(lunes);
  const numSem = numeroSemanaDesdeLunes(lunes);
  const sabado = useMemo(() => agregarDias(lunes, 5), [lunes]);
  const diasLab = useMemo(
    () => [0, 1, 2, 3, 4, 5].map((i) => agregarDias(lunes, i)),
    [lunes],
  );

  // ── Estado de modales ─────────────────────────────────────────────────────
  const [modal, setModal] = useState<{ usuarioId: string; fecha: string; nombre: string } | null>(null);
  /** Controla el modal de creación directa de tarea desde el panel del Jefe. */
  const [modalCrear, setModalCrear] = useState<{ usuarioId: string; fecha: string } | null>(null);
  const [devolverTarea, setDevolverTarea] = useState<Tarea | null>(null);
  const [motivoDevolver, setMotivoDevolver] = useState('');
  const [busyDevolver, setBusyDevolver] = useState(false);

  const motivoDevolverOk = motivoDevolver.trim().length >= MIN_JUSTIFICACION_CHARS;
  const motivoDevolverLen = motivoDevolver.trim().length;

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: miembros = [] } = useQuery({
    queryKey: ['planificacion', 'miembros'],
    queryFn: () => getMiembrosActivos(),
  });

  const { data: objetivosActivos = [] } = useQuery({
    queryKey: ['objetivos-activos-planificacion'],
    queryFn: () => getObjetivosActivos(),
  });

  const { data: carga = [] } = useQuery({
    queryKey: ['planificacion', 'carga', semanaISO],
    queryFn: () => getCargaEquipoSemana(semanaISO),
  });

  // OTs pendientes de aprobación — dato para el resumen ejecutivo
  const { data: otsPendientes = [] } = useQuery({
    queryKey: ['planificacion', 'ots-pendientes'],
    queryFn: async () => {
      const { data, error } = await getInsforge().database
        .from('orden_trabajo')
        .select('id')
        .eq('estado', 'pendiente');
      if (error) throw error;
      return (data ?? []) as { id: string }[];
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: incidencias = [], isLoading: loadInc } = useQuery({
    queryKey: ['planificacion', 'incidencias', semanaISO],
    queryFn: () => getIncidenciasEquipoSemana(lunes, sabado),
  });

  const { data: detalle = [], isLoading: loadDetalleCelda } = useQuery({
    queryKey: ['planificacion', 'celda', modal?.usuarioId, modal?.fecha],
    enabled: Boolean(modal),
    queryFn: () => getTareasUsuarioDia(modal!.usuarioId, modal!.fecha),
  });

  const { data: actividad = [], isLoading: loadActividad } = useQuery({
    queryKey: ['planificacion', 'actividad', semanaISO],
    queryFn:  () => getActividadEquipoSemana(lunes, sabado),
  });

  const { data: logsPend = [], isLoading: loadLogs, isError: errLogs } = useQuery({
    queryKey: [Q_LOGS],
    queryFn: () => getJustificacionesPendientesJefe(),
  });

  // ── Historial de logs ─────────────────────────────────────────────────────
  const [mostrarHistorial,    setMostrarHistorial]    = useState(false);
  const [histPagina,          setHistPagina]          = useState(0);
  const [histUsuarioId,       setHistUsuarioId]       = useState<string>('todos');
  const [histTipoAccion,      setHistTipoAccion]      = useState<FiltrosHistorialLog['tipoAccion']>('todos');
  const HIST_POR_PAGINA = 20;

  const filtrosHist: FiltrosHistorialLog = {
    usuarioId:   histUsuarioId,
    tipoAccion:  histTipoAccion,
    pagina:      histPagina,
    porPagina:   HIST_POR_PAGINA,
  };

  const { data: histResult, isLoading: loadHist } = useQuery({
    queryKey: ['audit-historial', filtrosHist],
    queryFn:  () => getHistorialLogs(filtrosHist),
    enabled:  mostrarHistorial,
  });

  const histLogs  = histResult?.logs  ?? [];
  const histTotal = histResult?.total ?? 0;
  const histTotalPaginas = Math.ceil(histTotal / HIST_POR_PAGINA);

  const { data: todosUsuarios = [] } = useUsuariosActivos({ enabled: mostrarHistorial });

  function resetHistFiltros() {
    setHistPagina(0);
    setHistUsuarioId('todos');
    setHistTipoAccion('todos');
  }

  // ── Mutaciones ────────────────────────────────────────────────────────────
  async function invalidarTrasRevisionJustificacion() {
    await qc.invalidateQueries({ refetchType: 'active', queryKey: [Q_LOGS] });
    await invalidateRelatedQueries(qc, ['planificacion', 'semana', 'tablero']);
  }

  const mutAceptarJustificacion = useMutation({
    mutationFn: (logId: string) => aceptarJustificacionJefe(logId),
    onSuccess: async () => {
      await invalidarTrasRevisionJustificacion();
      toast.success('Justificación aceptada');
    },
    onError: () => toast.error('No se pudo aceptar la justificación.'),
  });

  const mutDevolverJustificacion = useMutation({
    mutationFn: ({ logId, nota }: { logId: string; nota: string }) =>
      devolverJustificacionJefe(logId, nota),
    onSuccess: async () => {
      await invalidarTrasRevisionJustificacion();
      toast.success('Tarea devuelta a pendiente');
    },
    onError: () => toast.error('No se pudo devolver la tarea.'),
  });

  // ── Datos derivados ───────────────────────────────────────────────────────
  function esTareaActivaCelda(t: Tarea): boolean {
    const est = estadoEfectivoTablero(t, hoyYmd);
    return est !== 'completada' && est !== 'cancelada';
  }

  function cuenta(uid: string, ymd: string): number {
    return carga.filter(
      (t) => t.asignado_a === uid && t.fecha_planificada === ymd && esTareaActivaCelda(t),
    ).length;
  }

  function totalDiaEquipo(ymd: string): number {
    return miembros.reduce((acc, u) => acc + cuenta(u.id, ymd), 0);
  }

  const resumenAlertas = useMemo(() => {
    let atrasadas = 0;
    for (const t of carga) {
      if (estadoEfectivoTablero(t, hoyYmd) === 'atrasada') atrasadas++;
    }
    return {
      atrasadas,
      otsPendientes: otsPendientes.length,
      incidenciasActivas: incidencias.length,
      justificacionesPendientes: logsPend.length,
    };
  }, [carga, hoyYmd, otsPendientes, incidencias.length, logsPend.length]);

  function conteoEstadosDia(ymd: string): Partial<Record<ClaveVisualTarea, number>> {
    const del = carga.filter((t) => t.fecha_planificada === ymd);
    const counts: Partial<Record<ClaveVisualTarea, number>> = {};
    for (const t of del) {
      const est = estadoEfectivoTablero(t, hoyYmd);
      counts[est] = (counts[est] ?? 0) + 1;
    }
    return counts;
  }

  function conteoEstadosDiaMiembro(uid: string, ymd: string): Partial<Record<ClaveVisualTarea, number>> {
    const del = carga.filter((t) => t.asignado_a === uid && t.fecha_planificada === ymd);
    const counts: Partial<Record<ClaveVisualTarea, number>> = {};
    for (const t of del) {
      const est = estadoEfectivoTablero(t, hoyYmd);
      counts[est] = (counts[est] ?? 0) + 1;
    }
    return counts;
  }

  const conteoSemana = useMemo(() => {
    const counts: Partial<Record<ClaveVisualTarea, number>> = {};
    for (const t of carga) {
      const est = estadoEfectivoTablero(t, hoyYmd);
      counts[est] = (counts[est] ?? 0) + 1;
    }
    return counts;
  }, [carga, hoyYmd]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function invalidarCarga() {
    await invalidateRelatedQueries(qc, ['planificacion', 'tablero', 'semana']);
    await qc.invalidateQueries({ refetchType: 'active', queryKey: ['planificacion', 'celda', modal?.usuarioId, modal?.fecha] });
  }

  async function confirmarDevolver() {
    if (!devolverTarea || !usuario || !motivoDevolverOk) return;
    setBusyDevolver(true);
    try {
      await reprogramarTareaConLog({
        tareaId: devolverTarea.id,
        usuarioId: usuario.id,
        nuevaFecha: devolverTarea.fecha_planificada ?? hoyYmd,
        justificacion: motivoDevolver.trim(),
      });
      setDevolverTarea(null);
      setMotivoDevolver('');
      toast.success('Tarea devuelta a pendiente');
      await invalidarCarga();
    } catch (err) {
      console.error('[confirmarDevolver]', err);
      toast.error('No se pudo devolver la tarea.');
    } finally {
      setBusyDevolver(false);
    }
  }

  function abrirDevolver(t: Tarea) {
    setDevolverTarea(t);
    setMotivoDevolver('');
  }

  function cerrarDevolver() {
    setDevolverTarea(null);
    setMotivoDevolver('');
  }

  // ── Creación directa desde panel del Jefe ───────────────────────────────
  async function crearTareaDesdePanel(input: {
    titulo: string;
    prioridad: Tarea['prioridad'];
    descripcion: string;
    objetivo_id?: string | null;
  }) {
    if (!modalCrear || !usuario) return;
    await crearTareaPlanificada({
      titulo:           input.titulo,
      prioridad:        input.prioridad,
      descripcion:      input.descripcion,
      fecha_planificada: modalCrear.fecha,
      asignado_a:       modalCrear.usuarioId,
      creado_por:       usuario.id,
      objetivo_id:      input.objetivo_id ?? null,
    });
    toast.success('Tarea creada');
    setModalCrear(null);
    await invalidarCarga();
  }

  // Utilidad expuesta para el JSX
  const fechaLunes = fechaLunesDesdeSemanaIso(semanaISO);

  return {
    // Auth
    usuario,

    // Semana
    lunes, setLunes, sabado, diasLab, semanaISO, numSem, fechaLunes, hoyYmd,

    // Datos
    miembros, carga, detalle, loadDetalleCelda, incidencias, loadInc, logsPend, loadLogs, errLogs,
    actividad, loadActividad,
    objetivosActivos,
    modalCrear, setModalCrear,
    crearTareaDesdePanel,
    mostrarHistorial, setMostrarHistorial,
    histLogs, histTotal, histTotalPaginas, loadHist,
    histPagina, setHistPagina,
    histUsuarioId, setHistUsuarioId,
    histTipoAccion, setHistTipoAccion,
    todosUsuarios,
    HIST_POR_PAGINA,
    resetHistFiltros,
    conteoSemana,
    otsPendientes,
    resumenAlertas,
    totalDiaEquipo,

    // Mutaciones justificaciones
    mutAceptarJustificacion,
    mutDevolverJustificacion,

    // Modales
    modal, setModal,
    devolverTarea,
    motivoDevolver, setMotivoDevolver,
    motivoDevolverOk, motivoDevolverLen,
    busyDevolver,
    MIN_JUSTIFICACION_CHARS,

    // Helpers
    cuenta,
    conteoEstadosDia,
    conteoEstadosDiaMiembro,

    // Handlers
    confirmarDevolver,
    abrirDevolver,
    cerrarDevolver,
  };
}