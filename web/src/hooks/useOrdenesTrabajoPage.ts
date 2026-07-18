/**
 * hooks/useOrdenesTrabajoPage.ts
 *
 * Orquestador de la vista Órdenes de Trabajo.
 * Delega tipos → useOTTiposTrabajo, acciones de estado → useOTAcciones.
 * Retiene form/draft/autosave porque dependen de modalForm/editandoOT
 * que alimentan a useOrdenesTrabajoQueries.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import {
  actualizarOrdenTrabajo, crearOrdenTrabajo, enviarOTAlJefe, getOrdenTrabajoPorId,
  type CrearOTInput, type EstadoOT, type OrdenTrabajo,
} from '@/api/ordenTrabajo';
import {
  formatBorradorGuardadoHace, formInicialOT, formToActualizarInput,
  normalizarFormOTParaGuardar, ordenTrabajoToForm, tieneContenidoBorrador,
} from '@/lib/otFormDraft';
import { useAuthStore } from '@/store/authStore';
import { getWorkspaceId, useWorkspaceStore } from '@/store/workspaceStore';
import { useOrdenesTrabajoQueries, Q_OT, Q_OT_BORRADOR } from '@/hooks/useOrdenesTrabajoQueries';
import { useOTTiposTrabajo } from '@/hooks/useOTTiposTrabajo';
import { useOTAcciones } from '@/hooks/useOTAcciones';
import { qkWsId } from '@/lib/queryKeys';
import { labelNumeroOT } from '@/lib/otNumero';
import type { Id } from '@/types';

export { Q_OT, Q_TIPOS_OT, Q_OT_BORRADOR } from '@/hooks/useOrdenesTrabajoQueries';

const FILTRO_ESTADO_OT_VALORES = [
  'todos', 'activas', 'completadas', 'urgentes', 'vencidas',
  'borrador', 'pendiente', 'aprobada', 'completada', 'rechazada', 'cancelada',
] as const;
export type FiltroEstadoOT = typeof FILTRO_ESTADO_OT_VALORES[number];

export type DraftSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const AUTOSAVE_MS = 2000;

export function useOrdenesTrabajoPage() {
  const qc        = useQueryClient();
  const usuario   = useAuthStore((s) => s.usuario);
  const esJefe    = useWorkspaceStore((s) => s.esJefe());
  const location  = useLocation();
  const navigate  = useNavigate();

  const pendingAbrirOtIdRef = useRef<string | null>(
    (location.state as { abrirOtId?: string } | null)?.abrirOtId ?? null,
  );

  // ── Estado modal de formulario (alimenta la query de borrador) ────────────
  const [modalForm,  setModalForm]  = useState(false);
  const [editandoOT, setEditandoOT] = useState<OrdenTrabajo | null>(null);

  // ── Filtro por URL (se resuelve en servidor: alimenta la query de lista) ──
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

  const {
    ordenes, isLoading, isError,
    resumen, hayMas, cargarMas, cargandoMas,
    tiposTrabajo, tareasVinculables,
    borradorServidor, borradorCargando,
  } = useOrdenesTrabajoQueries({
    usuarioId:            usuario?.id,
    esJefe,
    borradorModalAbierto: modalForm,
    editandoOT:           Boolean(editandoOT),
    filtro:               filtroEstado,
  });

  // ── Sub-hooks ─────────────────────────────────────────────────────────────
  const tipos    = useOTTiposTrabajo(tiposTrabajo);
  const acciones = useOTAcciones({ ordenes, usuario });

  // ── Estado auxiliar de vista ──────────────────────────────────────────────
  const [viendoOT,      setViendoOT]      = useState<OrdenTrabajo | null>(null);
  const [imprimiendoOT, setImprimiendoOT] = useState<OrdenTrabajo | null>(null);

  // ── Form / draft / autosave ───────────────────────────────────────────────
  const [form,           setForm]           = useState<CrearOTInput>(() => formInicialOT(usuario?.id ?? ''));
  const [borradorOTId,   setBorradorOTId]   = useState<Id | null>(null);
  const borradorOTIdRef                     = useRef<Id | null>(null);
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null);
  const [draftSaveStatus, setDraftSaveStatus] = useState<DraftSaveStatus>('idle');
  const [draftTick,      setDraftTick]      = useState(0);
  const borradorHidratadoRef                = useRef(false);

  useEffect(() => {
    borradorOTIdRef.current = borradorOTId;
  }, [borradorOTId]);

  // Hidrata el form desde el borrador servidor al abrir el modal
  /* eslint-disable react-hooks/set-state-in-effect -- hidrata formulario desde borrador al abrir el modal; único punto de inicialización del estado de OT */
  useEffect(() => {
    if (!modalForm) { borradorHidratadoRef.current = false; return; }
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
  /* eslint-enable react-hooks/set-state-in-effect */

  // Tick por segundo para la etiqueta "guardado hace X"
  useEffect(() => {
    if (!modalForm || !draftUpdatedAt) return;
    const id = window.setInterval(() => setDraftTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [modalForm, draftUpdatedAt]);

  const draftSavedLabel = useMemo(
    () => formatBorradorGuardadoHace(draftUpdatedAt),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- draftTick es intencional: fuerza recompute en cada tick del reloj
    [draftUpdatedAt, draftTick],
  );

  const formVacio        = useMemo(() => formInicialOT(usuario?.id ?? ''), [usuario?.id]);
  const hasUnsavedChanges = modalForm && tieneContenidoBorrador(form, formVacio);

  // Autoguardado en servidor (debounce 2 s)
  useEffect(() => {
    if (!modalForm || !usuario?.id) return;
    const vacio = formInicialOT(usuario.id);
    if (!tieneContenidoBorrador(form, vacio)) return;

    const t = window.setTimeout(() => {
      void (async () => {
        setDraftSaveStatus('saving');
        try {
          const payload  = normalizarFormOTParaGuardar(form, usuario.id);
          const otId     = editandoOT?.id ?? borradorOTIdRef.current;
          const estadoActual: EstadoOT = editandoOT?.estado ?? 'borrador';
          const ot = otId
            ? await actualizarOrdenTrabajo(formToActualizarInput(form, otId, estadoActual))
            : await crearOrdenTrabajo(payload);

          if (!editandoOT) {
            setBorradorOTId(ot.id);
            borradorOTIdRef.current = ot.id;
          }
          setDraftUpdatedAt(ot.updated_at);
          setDraftSaveStatus('saved');
          void qc.invalidateQueries({ queryKey: qkWsId(getWorkspaceId(), Q_OT) });
          void qc.invalidateQueries({ queryKey: qkWsId(getWorkspaceId(), Q_OT_BORRADOR, usuario.id) });
        } catch (err) {
          console.error('[autosaveOT]', err);
          setDraftSaveStatus('error');
        }
      })();
    }, AUTOSAVE_MS);

    return () => window.clearTimeout(t);
  }, [form, modalForm, editandoOT, usuario?.id, qc]);

  const enviarOT = useCallback(async () => {
    const estadoActual: EstadoOT = editandoOT?.estado ?? 'borrador';
    let otId = editandoOT?.id ?? borradorOTIdRef.current;
    const payload: CrearOTInput = {
      ...form,
      creado_por:   usuario!.id,
      descripcion:  form.descripcion.trim(),
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
    void qc.removeQueries({ queryKey: qkWsId(getWorkspaceId(), Q_OT_BORRADOR, usuario?.id) });
  }, [qc, usuario?.id]);

  const mutCrear = useMutation({
    mutationFn: enviarOT,
    onSuccess: async (ot) => {
      await qc.invalidateQueries({ queryKey: qkWsId(getWorkspaceId(), Q_OT) });
      if (ot.estado === 'pendiente') {
        void qc.invalidateQueries({ queryKey: qkWsId(getWorkspaceId(), 'planificacion', 'ots-pendientes') });
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
      await qc.invalidateQueries({ queryKey: qkWsId(getWorkspaceId(), Q_OT) });
      void qc.invalidateQueries({ queryKey: qkWsId(getWorkspaceId(), 'planificacion', 'ots-pendientes') });
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

  // ── Acciones de apertura / cierre de modal ────────────────────────────────
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

  // Abre la OT indicada por navegación (state.abrirOtId) al cargar la lista.
  // Con la lista paginada la OT puede no estar en las páginas cargadas: fallback por id.
  useEffect(() => {
    const otId = pendingAbrirOtIdRef.current;
    if (!otId || isLoading) return;
    pendingAbrirOtIdRef.current = null;
    const ot = ordenes.find((o) => o.id === otId);
    if (ot) {
      abrirEditarOT(ot);
      navigate('.', { replace: true, state: null });
      return;
    }
    void getOrdenTrabajoPorId(otId)
      .then((otRemota) => { if (otRemota) abrirEditarOT(otRemota); })
      .catch((err) => console.error('[abrirOtId]', err))
      .finally(() => navigate('.', { replace: true, state: null }));
  }, [ordenes, isLoading, navigate]);

  // ── Resumen ejecutivo (contadores exactos en servidor; el filtrado de la
  //    lista también se resuelve en servidor vía useOrdenesTrabajoQueries) ───
  const pendientesCount = resumen.pendientes;
  const resumenOT = resumen;

  return {
    usuario, esJefe,
    ordenes, isLoading, isError,
    hayMas, cargarMas, cargandoMas,
    pendientesCount, resumenOT,
    tiposTrabajo, tareasVinculables,
    filtroEstado, setFiltroEstado,
    // Form / draft
    form, setForm,
    modalForm, setModalForm, editandoOT,
    borradorCargando, draftSaveStatus, draftSavedLabel, hasUnsavedChanges,
    abrirNuevaOT, abrirEditarOT, cerrarFormularioOT,
    mutCrear, mutActualizar,
    // Vista auxiliar
    viendoOT,      setViendoOT,
    imprimiendoOT, setImprimiendoOT,
    // Acciones OT (aprobar/rechazar/completar/cancelar)
    ...acciones,
    // Tipos de trabajo
    ...tipos,
  };
}
