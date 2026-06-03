/**

 * hooks/useOrdenesTrabajoPage.ts

 * Fix: keepPreviousData en query de tipos para evitar que el panel desaparezca

 * al hacer toggle activo/inactivo.

 * C-03: autoguardado de borrador OT en InsForge (debounce 2s).

 */



import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';

import { toast } from 'sonner';



import {

  aprobarOT, cancelarOrdenTrabajo, completarOT,

  crearOrdenTrabajo, enviarOTAlJefe, getBorradorOTUsuario, getOrdenesTrabajoMiembro, getOrdenesTrabajoTodas,

  getTiposTrabajoOT, rechazarOT, actualizarOrdenTrabajo,

  crearTipoTrabajoOT, toggleTipoTrabajoOT,

  type CrearOTInput, type EstadoOT, type OrdenTrabajo,

} from '@/api/ordenTrabajo';

import {

  formatBorradorGuardadoHace,

  formInicialOT,

  formToActualizarInput,

  normalizarFormOTParaGuardar,

  ordenTrabajoToForm,

  tieneContenidoBorrador,

} from '@/lib/otFormDraft';

import { useAuthStore } from '@/store/authStore';

import { publicarEventoUsuario } from '@/lib/realtimePublish';

import { getInsforge } from '@/lib/insforge';

import { invalidateRelatedQueries } from '@/lib/queryHelpers';
import { TAREA_ACTIVA } from '@/lib/tareaTables';
import { puedeCompletarOTReceptor } from '@/lib/otComplecion';
import { fechaLocalYmd } from '@/lib/fecha';
import { otVencida } from '@/lib/otHelpers';
import { labelNumeroOT } from '@/lib/otNumero';

import type { Id, Tarea } from '@/types';



export const Q_OT = 'ordenes-trabajo';

export const Q_TIPOS_OT = 'tipos-trabajo-ot';

export const Q_OT_BORRADOR = 'ot-borrador-usuario';



const FILTRO_ESTADO_OT_VALORES = [

  'todos', 'activas', 'completadas', 'urgentes', 'vencidas',

  'borrador', 'pendiente', 'aprobada', 'completada', 'rechazada', 'cancelada',

] as const;

export type FiltroEstadoOT = typeof FILTRO_ESTADO_OT_VALORES[number];



export type DraftSaveStatus = 'idle' | 'saving' | 'saved' | 'error';



const AUTOSAVE_MS = 2000;



export function useOrdenesTrabajoPage() {

  const qc = useQueryClient();

  const usuario = useAuthStore((s) => s.usuario);

  const esJefe = usuario?.rol === 'jefe';

  const location = useLocation();

  const navigate = useNavigate();

  const pendingAbrirOtIdRef = useRef<string | null>(
    (location.state as { abrirOtId?: string } | null)?.abrirOtId ?? null,
  );



  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: ordenes = [], isLoading, isError } = useQuery({

    queryKey: [Q_OT, usuario?.id, esJefe],

    enabled: Boolean(usuario?.id),

    queryFn: () => esJefe ? getOrdenesTrabajoTodas() : getOrdenesTrabajoMiembro(usuario!.id),

  });



  const { data: tiposTrabajo = [] } = useQuery({

    queryKey: [Q_TIPOS_OT],

    queryFn: () => getTiposTrabajoOT(),

    placeholderData: keepPreviousData,

  });



  const { data: tareasVinculables = [] } = useQuery({

    queryKey: ['ot-tareas-vinculables', usuario?.id],

    enabled: Boolean(usuario?.id),

    queryFn: async (): Promise<Pick<Tarea, 'id' | 'titulo' | 'estado'>[]> => {

      const { data, error } = await getInsforge().database

        .from(TAREA_ACTIVA)

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

  const [searchParams, setSearchParams] = useSearchParams();

  const filtroEstadoRaw = searchParams.get('estado') ?? 'todos';

  const filtroEstado: FiltroEstadoOT =

    (FILTRO_ESTADO_OT_VALORES as readonly string[]).includes(filtroEstadoRaw)

      ? (filtroEstadoRaw as FiltroEstadoOT)

      : 'todos';

  const setFiltroEstado = (v: FiltroEstadoOT) => {

    setSearchParams(

      (prev) => {

        const next = new URLSearchParams(prev);

        if (v === 'todos') next.delete('estado');

        else next.set('estado', v);

        return next;

      },

      { replace: true },

    );

  };



  const [form, setForm] = useState<CrearOTInput>(() => formInicialOT(usuario?.id ?? ''));

  const [borradorOTId, setBorradorOTId] = useState<Id | null>(null);

  const borradorOTIdRef = useRef<Id | null>(null);

  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null);

  const [draftSaveStatus, setDraftSaveStatus] = useState<DraftSaveStatus>('idle');

  const [draftTick, setDraftTick] = useState(0);

  const borradorHidratadoRef = useRef(false);



  const { data: borradorServidor, isLoading: borradorCargando } = useQuery({

    queryKey: [Q_OT_BORRADOR, usuario?.id],

    enabled: Boolean(modalForm && !editandoOT && usuario?.id),

    queryFn: () => getBorradorOTUsuario(usuario!.id),

  });



  useEffect(() => {

    borradorOTIdRef.current = borradorOTId;

  }, [borradorOTId]);



  useEffect(() => {

    if (!modalForm) {

      borradorHidratadoRef.current = false;

      return;

    }

    if (editandoOT || borradorCargando || borradorHidratadoRef.current) return;



    borradorHidratadoRef.current = true;

    if (borradorServidor) {

      setBorradorOTId(borradorServidor.id);

      borradorOTIdRef.current = borradorServidor.id;

      setDraftUpdatedAt(borradorServidor.updated_at);

      setForm(ordenTrabajoToForm(borradorServidor));

      setDraftSaveStatus('saved');

    }

  }, [modalForm, editandoOT, borradorCargando, borradorServidor]);



  useEffect(() => {

    if (!modalForm || !draftUpdatedAt) return;

    const id = window.setInterval(() => setDraftTick((t) => t + 1), 1000);

    return () => window.clearInterval(id);

  }, [modalForm, draftUpdatedAt]);



  const draftSavedLabel = useMemo(

    () => formatBorradorGuardadoHace(draftUpdatedAt),

    [draftUpdatedAt, draftTick],

  );



  const formVacio = useMemo(

    () => formInicialOT(usuario?.id ?? ''),

    [usuario?.id],

  );



  const hasUnsavedChanges = modalForm && tieneContenidoBorrador(form, formVacio);



  // Autoguardado en servidor (debounce 2s)

  useEffect(() => {

    if (!modalForm || !usuario?.id) return;

    const vacio = formInicialOT(usuario.id);

    if (!tieneContenidoBorrador(form, vacio)) return;



    const t = window.setTimeout(() => {

      void (async () => {

        setDraftSaveStatus('saving');

        try {

          const payload = normalizarFormOTParaGuardar(form, usuario.id);

          const otId = editandoOT?.id ?? borradorOTIdRef.current;



          const estadoGuardado = editandoOT?.estado ?? 'borrador';

          const ot = otId

            ? await actualizarOrdenTrabajo(formToActualizarInput(form, otId, estadoGuardado))

            : await crearOrdenTrabajo(payload);



          if (!editandoOT) {

            setBorradorOTId(ot.id);

            borradorOTIdRef.current = ot.id;

          }

          setDraftUpdatedAt(ot.updated_at);

          setDraftSaveStatus('saved');

          void qc.invalidateQueries({ queryKey: [Q_OT] });

          void qc.invalidateQueries({ queryKey: [Q_OT_BORRADOR, usuario.id] });

        } catch (err) {

          console.error('[autosaveOT]', err);

          setDraftSaveStatus('error');

        }

      })();

    }, AUTOSAVE_MS);



    return () => window.clearTimeout(t);

  }, [form, modalForm, editandoOT, usuario?.id, qc]);



  const [receptorNombre, setReceptorNombre] = useState('');

  const [receptorDni, setReceptorDni] = useState('');

  const [receptorCargo, setReceptorCargo] = useState('');

  const [obsCierre, setObsCierre] = useState('');



  const [nuevoTipoNombre, setNuevoTipoNombre] = useState('');



  const invalidarOTs = () => invalidateRelatedQueries(qc, ['ot']);

  const invalidarTipos = () => qc.invalidateQueries({ refetchType: 'active', queryKey: [Q_TIPOS_OT] });



  const enviarOT = useCallback(async () => {
    const estadoActual: EstadoOT = editandoOT?.estado ?? 'borrador';
    let otId = editandoOT?.id ?? borradorOTIdRef.current;
    const payload: CrearOTInput = {
      ...form,
      creado_por: usuario!.id,
      descripcion: form.descripcion.trim(),
      area_destino: form.area_destino.trim(),
    };
    let ot: OrdenTrabajo;

    if (otId) {
      ot = await actualizarOrdenTrabajo(formToActualizarInput(payload, otId, estadoActual));
    } else {
      ot = await crearOrdenTrabajo(payload);
      otId = ot.id;
    }

    if (estadoActual === 'pendiente') return ot;
    return enviarOTAlJefe(otId, usuario!.id);
  }, [form, editandoOT, usuario]);



  const resetFormularioOT = useCallback(() => {

    setBorradorOTId(null);

    borradorOTIdRef.current = null;

    setDraftUpdatedAt(null);

    setDraftSaveStatus('idle');

    setForm(formInicialOT(usuario?.id ?? ''));

    void qc.removeQueries({ queryKey: [Q_OT_BORRADOR, usuario?.id] });

  }, [qc, usuario?.id]);



  const mutCrear = useMutation({

    mutationFn: enviarOT,

    onSuccess: async (ot) => {

      await invalidarOTs();

      if (ot.estado === 'pendiente') {

        void qc.invalidateQueries({ queryKey: ['planificacion', 'ots-pendientes'] });

      }

      setModalForm(false);

      setEditandoOT(null);

      resetFormularioOT();

      toast.success(`${labelNumeroOT(ot.numero)} enviada al jefe`);

    },

    onError: (err) => { console.error('[mutCrearOT]', err); toast.error('No se pudo crear la OT.'); },

  });



  const mutActualizar = useMutation({

    mutationFn: enviarOT,

    onSuccess: async (ot) => {

      await invalidarOTs();

      void qc.invalidateQueries({ queryKey: ['planificacion', 'ots-pendientes'] });

      setModalForm(false);

      setEditandoOT(null);

      resetFormularioOT();

      toast.success(
        editandoOT?.estado === 'pendiente'
          ? 'Cambios guardados'
          : `${labelNumeroOT(ot.numero)} enviada al jefe`,
      );

    },

    onError: (err) => { console.error('[mutActualizarOT]', err); toast.error('No se pudo actualizar la OT.'); },

  });



  const mutAprobar = useMutation({

    mutationFn: (otId: Id) => aprobarOT(otId, usuario!.id),

    onSuccess: async (_data, otId) => {

      await invalidarOTs();

      void qc.invalidateQueries({ queryKey: ['planificacion', 'ots-pendientes'] });

      toast.success('OT aprobada');

      const ot = ordenes.find((o) => o.id === otId);

      if (ot) {

        void publicarEventoUsuario({

          tipo:      'ot_aprobada',

          usuarioId: ot.creado_por,

          otId:      ot.id,

          numero:    labelNumeroOT(ot.numero),

        });

      }

    },

    onError: (err) => { console.error('[mutAprobarOT]', err); toast.error('No se pudo aprobar la OT.'); },

  });



  const mutRechazar = useMutation({

    mutationFn: ({ otId, motivo }: { otId: Id; motivo: string }) => rechazarOT(otId, usuario!.id, motivo),

    onSuccess: async (_data, { otId, motivo }) => {

      await invalidarOTs();

      void qc.invalidateQueries({ queryKey: ['planificacion', 'ots-pendientes'] });

      setModalRechazar(null); setMotivoRechazo('');

      toast.success('OT rechazada');

      const ot = ordenes.find((o) => o.id === otId);

      if (ot) {

        void publicarEventoUsuario({

          tipo:      'ot_rechazada',

          usuarioId: ot.creado_por,

          otId:      ot.id,

          numero:    labelNumeroOT(ot.numero),

          motivo,

        });

      }

    },

    onError: (err) => { console.error('[mutRechazarOT]', err); toast.error('No se pudo rechazar la OT.'); },

  });



  const mutCompletar = useMutation({

    mutationFn: () => completarOT({

      otId: modalCompletar!.id,

      usuarioId: usuario!.id,

      receptorNombre,

      receptorDni,

      receptorCargo,

      ...(obsCierre.trim() ? { observacionesCierre: obsCierre.trim() } : {}),

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



  const mutCrearTipo = useMutation({

    mutationFn: () => crearTipoTrabajoOT(nuevoTipoNombre),

    onSuccess: async () => {

      await invalidarTipos();

      setNuevoTipoNombre('');

      toast.success('Tipo de trabajo agregado');

    },

    onError: (err) => { console.error('[mutCrearTipo]', err); toast.error('No se pudo agregar el tipo.'); },

  });



  const mutToggleTipo = useMutation({

    mutationFn: ({ id, activo }: { id: Id; activo: boolean }) => toggleTipoTrabajoOT(id, activo),

    onMutate: async ({ id, activo }) => {

      await qc.cancelQueries({ queryKey: [Q_TIPOS_OT] });

      const prev = qc.getQueryData([Q_TIPOS_OT]);

      qc.setQueryData([Q_TIPOS_OT], (old: typeof tiposTrabajo) =>

        old.map((t) => t.id === id ? { ...t, activo } : t),

      );

      return { prev };

    },

    onError: (err, _, ctx) => {

      if (ctx?.prev) qc.setQueryData([Q_TIPOS_OT], ctx.prev);

      console.error('[mutToggleTipo]', err);

      toast.error('No se pudo actualizar el tipo.');

    },

    onSettled: () => { void invalidarTipos(); },

  });



  function abrirNuevaOT() {

    setEditandoOT(null);

    setBorradorOTId(null);

    borradorOTIdRef.current = null;

    setDraftUpdatedAt(null);

    setDraftSaveStatus('idle');

    borradorHidratadoRef.current = false;

    setForm(formInicialOT(usuario?.id ?? ''));

    setModalForm(true);

  }



  function abrirEditarOT(ot: OrdenTrabajo) {

    setEditandoOT(ot);

    setBorradorOTId(ot.estado === 'borrador' ? ot.id : null);

    borradorOTIdRef.current = ot.estado === 'borrador' ? ot.id : null;

    setDraftUpdatedAt(ot.updated_at);

    setDraftSaveStatus('saved');

    borradorHidratadoRef.current = true;

    setForm(ordenTrabajoToForm(ot));

    setModalForm(true);

  }



  function cerrarFormularioOT() {

    setModalForm(false);

    setEditandoOT(null);

  }



  useEffect(() => {

    const otId = pendingAbrirOtIdRef.current;

    if (!otId || isLoading) return;

    const ot = ordenes.find((o) => o.id === otId);

    if (ot) {

      pendingAbrirOtIdRef.current = null;

      abrirEditarOT(ot);

      navigate('.', { replace: true, state: null });

    }

  }, [ordenes, isLoading, navigate]);



  const ESTADOS_OT_ACTIVAS: EstadoOT[] = ['borrador', 'pendiente', 'aprobada'];

  const ordenesFiltradas = (() => {

    if (filtroEstado === 'todos') return ordenes;

    if (filtroEstado === 'activas') return ordenes.filter((o) => ESTADOS_OT_ACTIVAS.includes(o.estado));

    if (filtroEstado === 'completadas') return ordenes.filter((o) => o.estado === 'completada');

    if (filtroEstado === 'urgentes') {
      return ordenes.filter(
        (o) => o.prioridad === 'urgente' && !['completada', 'cancelada', 'rechazada'].includes(o.estado),
      );
    }

    if (filtroEstado === 'vencidas') {
      const hoy = fechaLocalYmd(new Date());
      return ordenes.filter((o) => otVencida(o, hoy));
    }

    return ordenes.filter((o) => o.estado === filtroEstado);

  })();

  const pendientesCount = ordenes.filter((o) => o.estado === 'pendiente').length;

  const resumenOT = {
    activas: ordenes.filter((o) => ESTADOS_OT_ACTIVAS.includes(o.estado)).length,
    urgentes: ordenes.filter(
      (o) => o.prioridad === 'urgente' && !['completada', 'cancelada', 'rechazada'].includes(o.estado),
    ).length,
    vencidas: ordenes.filter((o) => otVencida(o, fechaLocalYmd(new Date()))).length,
    pendientes: pendientesCount,
  };

  const canCompletar = puedeCompletarOTReceptor(receptorNombre, receptorDni);

  const canCrearTipo = nuevoTipoNombre.trim().length > 0 && !mutCrearTipo.isPending;

  const tiposActivos = tiposTrabajo.filter((t) => t.activo);

  const tiposInactivos = tiposTrabajo.filter((t) => !t.activo);



  return {

    usuario, esJefe,

    ordenes: ordenesFiltradas, isLoading, isError,

    pendientesCount, resumenOT,

    tiposTrabajo, tiposActivos, tiposInactivos,

    tareasVinculables,

    filtroEstado, setFiltroEstado,

    form, setForm,

    modalForm, setModalForm, editandoOT,

    borradorCargando,

    draftSaveStatus, draftSavedLabel,

    hasUnsavedChanges,

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

    abrirNuevaOT, abrirEditarOT, cerrarFormularioOT,

    mutCrear, mutActualizar, mutAprobar, mutRechazar,

    mutCompletar, mutCancelar,

    mutCrearTipo, mutToggleTipo,

  };

}

