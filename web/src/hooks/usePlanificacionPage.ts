/**
 * hooks/usePlanificacionPage.ts
 * Centraliza toda la lógica de negocio, estado y mutaciones de la vista Planificación.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { getJustificacionesPendientesJefe, marcarLogLeidoPorJefe } from '@/api/audit';
import {
  fechaLunesDesdeSemanaIso,
  getCargaEquipoSemana,
  getMiembrosActivos,
  getTareasUsuarioDia,
} from '@/api/planificacion';
import { desbloquearTareaConLog, reprogramarTareaConLog } from '@/api/semana';
import { fechaLocalYmd } from '@/lib/fecha';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import { agregarDias, inicioSemanaIso, numeroSemanaDesdeLunes, semanaIsoDesdeFecha } from '@/lib/semanas';
import { useAuthStore } from '@/store/authStore';
import type { EstadoTarea, Tarea } from '@/types';

export const Q_LOGS = 'audit-logs-pendientes';
const MIN_MOTIVO = 10;

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
  const [desbloquearTarea, setDesbloquearTarea] = useState<Tarea | null>(null);
  const [devolverTarea, setDevolverTarea] = useState<Tarea | null>(null);
  const [motivoDevolver, setMotivoDevolver] = useState('');
  const [busyDevolver, setBusyDevolver] = useState(false);

  const motivoDevolverOk = motivoDevolver.trim().length >= MIN_MOTIVO;
  const motivoDevolverLen = motivoDevolver.trim().length;

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: miembros = [] } = useQuery({
    queryKey: ['planificacion', 'miembros'],
    queryFn: () => getMiembrosActivos(),
  });

  const { data: carga = [] } = useQuery({
    queryKey: ['planificacion', 'carga', semanaISO],
    queryFn: () => getCargaEquipoSemana(semanaISO),
  });

  const { data: detalle = [] } = useQuery({
    queryKey: ['planificacion', 'celda', modal?.usuarioId, modal?.fecha],
    enabled: Boolean(modal),
    queryFn: () => getTareasUsuarioDia(modal!.usuarioId, modal!.fecha),
  });

  const { data: logsPend = [], isLoading: loadLogs, isError: errLogs } = useQuery({
    queryKey: [Q_LOGS],
    queryFn: () => getJustificacionesPendientesJefe(),
  });

  // ── Mutaciones ────────────────────────────────────────────────────────────
  const mutLeerLog = useMutation({
    mutationFn: (id: string) => marcarLogLeidoPorJefe(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ refetchType: 'active', queryKey: [Q_LOGS] });
      toast.success('Marcada como leído');
    },
    onError: () => toast.error('No se pudo actualizar el registro.'),
  });

  // ── Datos derivados ───────────────────────────────────────────────────────
  function cuenta(uid: string, ymd: string): number {
    return carga.filter((t) => t.asignado_a === uid && t.fecha_planificada === ymd).length;
  }

  function conteoEstadosDia(ymd: string): Partial<Record<EstadoTarea, number>> {
    const del = carga.filter((t) => t.fecha_planificada === ymd);
    const counts: Partial<Record<EstadoTarea, number>> = {};
    for (const t of del) {
      const est = estadoEfectivoTablero(t, hoyYmd);
      counts[est] = (counts[est] ?? 0) + 1;
    }
    return counts;
  }

  const conteoSemana = useMemo(() => {
    const counts: Partial<Record<EstadoTarea, number>> = {};
    for (const t of carga) {
      const est = estadoEfectivoTablero(t, hoyYmd);
      counts[est] = (counts[est] ?? 0) + 1;
    }
    return counts;
  }, [carga, hoyYmd]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function invalidarCarga() {
    await Promise.all([
      qc.invalidateQueries({ refetchType: 'active', queryKey: ['planificacion', 'carga', semanaISO] }),
      qc.invalidateQueries({ refetchType: 'active', queryKey: ['planificacion', 'celda', modal?.usuarioId, modal?.fecha] }),
      qc.invalidateQueries({ refetchType: 'active', queryKey: ['tablero'] }),
      qc.invalidateQueries({ refetchType: 'active', queryKey: ['semana'] }),
    ]);
  }

  async function confirmarDesbloqueo(input: { tareaId: string; nuevaFecha: string; justificacion: string }) {
    if (!usuario) return;
    try {
      await desbloquearTareaConLog({ ...input, usuarioId: usuario.id });
      setDesbloquearTarea(null);
      toast.success('Tarea desbloqueada');
      await invalidarCarga();
    } catch (err) {
      console.error('[confirmarDesbloqueo]', err);
      toast.error('No se pudo desbloquear la tarea.');
    }
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
        nuevoEstado: 'pendiente',
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

  // Utilidad expuesta para el JSX
  const fechaLunes = fechaLunesDesdeSemanaIso(semanaISO);

  return {
    // Auth
    usuario,

    // Semana
    lunes, setLunes, sabado, diasLab, semanaISO, numSem, fechaLunes, hoyYmd,

    // Datos
    miembros, carga, detalle, logsPend, loadLogs, errLogs,
    conteoSemana,

    // Mutaciones
    mutLeerLog,

    // Modales
    modal, setModal,
    desbloquearTarea, setDesbloquearTarea,
    devolverTarea,
    motivoDevolver, setMotivoDevolver,
    motivoDevolverOk, motivoDevolverLen,
    busyDevolver,
    MIN_MOTIVO,

    // Helpers
    cuenta,
    conteoEstadosDia,

    // Handlers
    confirmarDesbloqueo,
    confirmarDevolver,
    abrirDevolver,
    cerrarDevolver,
  };
}