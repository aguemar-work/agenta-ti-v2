/**
 * hooks/useOrdenesTrabajoPage.ts
 * Fix: keepPreviousData en query de tipos para evitar que el panel desaparezca
 * al hacer toggle activo/inactivo.
 */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  aprobarOT, cancelarOrdenTrabajo, completarOT,
  crearOrdenTrabajo, getOrdenesTrabajoMiembro, getOrdenesTrabajoTodas,
  getTiposTrabajoOT, iniciarEjecucionOT, rechazarOT, actualizarOrdenTrabajo,
  crearTipoTrabajoOT, toggleTipoTrabajoOT,
  type CrearOTInput, type EstadoOT, type OrdenTrabajo,
} from '@/api/ordenTrabajo';
import { useAuthStore } from '@/store/authStore';
import { publicarEventoUsuario } from '@/lib/realtimePublish';
import { getInsforge } from '@/lib/insforge';
import type { Id, Tarea } from '@/types';

export const Q_OT = 'ordenes-trabajo';
export const Q_TIPOS_OT = 'tipos-trabajo-ot';

function formInicial(usuarioId: Id): Omit<CrearOTInput, 'enviar'> {
  return {
    creado_por: usuarioId, tipo_trabajo_id: null, tarea_id: null,
    descripcion: '', area_destino: '', ubicacion: '',
    modalidad: 'presencial', fecha_estimada: '',
    hora_inicio_est: '', duracion_est_min: null,
    equipos_materiales: '', observaciones: '',
  };
}

export function useOrdenesTrabajoPage() {
  const qc = useQueryClient();
  const usuario = useAuthStore((s) => s.usuario);
  const esJefe = usuario?.rol === 'jefe';

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: ordenes = [], isLoading, isError } = useQuery({
    queryKey: [Q_OT, usuario?.id, esJefe],
    enabled: Boolean(usuario?.id),
    queryFn: () => esJefe ? getOrdenesTrabajoTodas() : getOrdenesTrabajoMiembro(usuario!.id),
  });

  const { data: tiposTrabajo = [] } = useQuery({
    queryKey: [Q_TIPOS_OT],
    queryFn: () => getTiposTrabajoOT(),
    // FIX: mantiene datos anteriores mientras refetch — evita que el panel desaparezca
    placeholderData: keepPreviousData,
  });

  /** Tareas planificadas del miembro para vincular a la OT */
  const { data: tareasVinculables = [] } = useQuery({
    queryKey: ['ot-tareas-vinculables', usuario?.id],
    enabled: Boolean(usuario?.id),
    queryFn: async (): Promise<Pick<Tarea, 'id' | 'titulo' | 'estado'>[]> => {
      const { data, error } = await getInsforge().database
        .from('tarea')
        .select('id,titulo,estado')
        .eq('asignado_a', usuario!.id)
        .in('estado', ['pendiente', 'en_progreso', 'atrasada'])
        .order('fecha_planificada', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Pick<Tarea, 'id' | 'titulo' | 'estado'>[];
    },
  });

  // ── Estado UI — OTs ───────────────────────────────────────────────────────
  const [modalForm, setModalForm] = useState(false);
  const [editandoOT, setEditandoOT] = useState<OrdenTrabajo | null>(null);
  const [viendoOT, setViendoOT] = useState<OrdenTrabajo | null>(null);
  const [imprimiendoOT, setImprimiendoOT] = useState<OrdenTrabajo | null>(null);
  const [modalCompletar, setModalCompletar] = useState<OrdenTrabajo | null>(null);
  const [modalRechazar, setModalRechazar] = useState<OrdenTrabajo | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoOT | 'todos'>('todos');
  const [form, setForm] = useState<Omit<CrearOTInput, 'enviar'>>(() => formInicial(usuario?.id ?? ''));

  const [receptorNombre, setReceptorNombre] = useState('');
  const [receptorDni, setReceptorDni] = useState('');
  const [receptorCargo, setReceptorCargo] = useState('');
  const [obsCierre, setObsCierre] = useState('');

  // ── Estado UI — Tipos de trabajo ──────────────────────────────────────────
  const [nuevoTipoNombre, setNuevoTipoNombre] = useState('');

  // ── Invalidar ─────────────────────────────────────────────────────────────
  const invalidarOTs = () => qc.invalidateQueries({ refetchType: 'active', queryKey: [Q_OT] });
  const invalidarTipos = () => qc.invalidateQueries({ refetchType: 'active', queryKey: [Q_TIPOS_OT] });

  // ── Mutaciones — OTs ──────────────────────────────────────────────────────
  const mutCrear = useMutation({
    mutationFn: (enviar: boolean) => crearOrdenTrabajo({ ...form, enviar }),
    onSuccess: async (ot) => {
      await invalidarOTs();
      setModalForm(false);
      setForm(formInicial(usuario?.id ?? ''));
      toast.success(ot.estado === 'pendiente' ? `${ot.numero} enviada al jefe` : `${ot.numero} guardada como borrador`);
    },
    onError: (err) => { console.error('[mutCrearOT]', err); toast.error('No se pudo crear la OT.'); },
  });

  const mutActualizar = useMutation({
    mutationFn: (enviar: boolean) => actualizarOrdenTrabajo({ ...form, otId: editandoOT!.id, enviar }),
    onSuccess: async (_, enviar) => {
      await invalidarOTs();
      setModalForm(false); setEditandoOT(null);
      toast.success(enviar ? 'OT enviada al jefe' : 'OT actualizada');
    },
    onError: (err) => { console.error('[mutActualizarOT]', err); toast.error('No se pudo actualizar la OT.'); },
  });

  const mutAprobar = useMutation({
    mutationFn: (otId: Id) => aprobarOT(otId, usuario!.id),
    onSuccess: async (_data, otId) => {
      await invalidarOTs();
      toast.success('OT aprobada');
      // Notificar al creador de la OT
      const ot = ordenes.find((o) => o.id === otId);
      if (ot) {
        void publicarEventoUsuario({
          tipo:      'ot_aprobada',
          usuarioId: ot.creado_por,
          otId:      ot.id,
          numero:    ot.numero,
        });
      }
    },
    onError: (err) => { console.error('[mutAprobarOT]', err); toast.error('No se pudo aprobar la OT.'); },
  });

  const mutRechazar = useMutation({
    mutationFn: ({ otId, motivo }: { otId: Id; motivo: string }) => rechazarOT(otId, usuario!.id, motivo),
    onSuccess: async (_data, { otId, motivo }) => {
      await invalidarOTs();
      setModalRechazar(null); setMotivoRechazo('');
      toast.success('OT rechazada');
      // Notificar al creador de la OT
      const ot = ordenes.find((o) => o.id === otId);
      if (ot) {
        void publicarEventoUsuario({
          tipo:      'ot_rechazada',
          usuarioId: ot.creado_por,
          otId:      ot.id,
          numero:    ot.numero,
          motivo,
        });
      }
    },
    onError: (err) => { console.error('[mutRechazarOT]', err); toast.error('No se pudo rechazar la OT.'); },
  });

  const mutIniciar = useMutation({
    mutationFn: (otId: Id) => iniciarEjecucionOT(otId, usuario!.id),
    onSuccess: async () => { await invalidarOTs(); toast.success('OT en ejecución'); },
    onError: (err) => { console.error('[mutIniciarOT]', err); toast.error('No se pudo iniciar la OT.'); },
  });

  const mutCompletar = useMutation({
    mutationFn: () => completarOT({
      otId: modalCompletar!.id,
      usuarioId: usuario!.id,
      receptorNombre,
      receptorDni,
      receptorCargo,
      observacionesCierre: obsCierre || undefined,
    }),
    onSuccess: async () => {
      await invalidarOTs();
      setModalCompletar(null);
      setReceptorNombre(''); setReceptorDni(''); setReceptorCargo(''); setObsCierre('');
      toast.success('OT completada');
    },
    onError: (err) => { console.error('[mutCompletarOT]', err); toast.error('No se pudo completar la OT.'); },
  });

  const mutCancelar = useMutation({
    mutationFn: (otId: Id) => cancelarOrdenTrabajo(otId, usuario!.id),
    onSuccess: async () => { await invalidarOTs(); toast.success('OT cancelada'); },
    onError: (err) => { console.error('[mutCancelarOT]', err); toast.error('No se pudo cancelar la OT.'); },
  });

  // ── Mutaciones — Tipos de trabajo ─────────────────────────────────────────
  const mutCrearTipo = useMutation({
    mutationFn: () => crearTipoTrabajoOT(nuevoTipoNombre, usuario!.id),
    onSuccess: async () => {
      await invalidarTipos();
      setNuevoTipoNombre('');
      toast.success('Tipo de trabajo agregado');
    },
    onError: (err) => { console.error('[mutCrearTipo]', err); toast.error('No se pudo agregar el tipo.'); },
  });

  const mutToggleTipo = useMutation({
    mutationFn: ({ id, activo }: { id: Id; activo: boolean }) => toggleTipoTrabajoOT(id, activo),
    // FIX: optimistic update — cambia el estado localmente antes del refetch
    onMutate: async ({ id, activo }) => {
      await qc.cancelQueries({ queryKey: [Q_TIPOS_OT] });
      const prev = qc.getQueryData([Q_TIPOS_OT]);
      qc.setQueryData([Q_TIPOS_OT], (old: typeof tiposTrabajo) =>
        old.map((t) => t.id === id ? { ...t, activo } : t),
      );
      return { prev };
    },
    onError: (err, _, ctx) => {
      // Revertir si falla
      if (ctx?.prev) qc.setQueryData([Q_TIPOS_OT], ctx.prev);
      console.error('[mutToggleTipo]', err);
      toast.error('No se pudo actualizar el tipo.');
    },
    onSettled: () => { void invalidarTipos(); },
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  function abrirNuevaOT() {
    setEditandoOT(null);
    setForm(formInicial(usuario?.id ?? ''));
    setModalForm(true);
  }

  function abrirEditarOT(ot: OrdenTrabajo) {
    setEditandoOT(ot);
    setForm({
      creado_por: ot.creado_por, tipo_trabajo_id: ot.tipo_trabajo_id,
      tarea_id: ot.tarea_id, descripcion: ot.descripcion,
      area_destino: ot.area_destino, ubicacion: ot.ubicacion ?? '',
      modalidad: ot.modalidad, fecha_estimada: ot.fecha_estimada,
      hora_inicio_est: ot.hora_inicio_est ?? '', duracion_est_min: ot.duracion_est_min,
      equipos_materiales: ot.equipos_materiales ?? '', observaciones: ot.observaciones ?? '',
    });
    setModalForm(true);
  }

  const ordenesFiltradas = filtroEstado === 'todos' ? ordenes : ordenes.filter((o) => o.estado === filtroEstado);
  const pendientesCount = ordenes.filter((o) => o.estado === 'pendiente').length;
  const canCompletar = receptorNombre.trim().length > 0 && receptorDni.trim().length > 0 && receptorCargo.trim().length > 0;
  const canCrearTipo = nuevoTipoNombre.trim().length > 0 && !mutCrearTipo.isPending;
  const tiposActivos = tiposTrabajo.filter((t) => t.activo);
  const tiposInactivos = tiposTrabajo.filter((t) => !t.activo);

  return {
    usuario, esJefe,
    ordenes: ordenesFiltradas, isLoading, isError,
    pendientesCount,
    tiposTrabajo, tiposActivos, tiposInactivos,
    tareasVinculables,
    filtroEstado, setFiltroEstado,
    form, setForm,
    modalForm, setModalForm, editandoOT,
    viendoOT, setViendoOT,
    imprimiendoOT, setImprimiendoOT,
    modalCompletar, setModalCompletar,
    modalRechazar, setModalRechazar,
    motivoRechazo, setMotivoRechazo,
    receptorNombre, setReceptorNombre,
    receptorDni, setReceptorDni,
    receptorCargo, setReceptorCargo,
    obsCierre, setObsCierre,
    canCompletar,
    nuevoTipoNombre, setNuevoTipoNombre, canCrearTipo,
    abrirNuevaOT, abrirEditarOT,
    mutCrear, mutActualizar, mutAprobar, mutRechazar,
    mutIniciar, mutCompletar, mutCancelar,
    mutCrearTipo, mutToggleTipo,
  };
}