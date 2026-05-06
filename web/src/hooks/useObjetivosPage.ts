/**
 * hooks/useObjetivosPage.ts
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MIN_JUSTIFICACION_CHARS } from '@/lib/constants';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { completarObjetivo, crearObjetivo, eliminarObjetivo, getOTsPorObjetivo, getTareasPorObjetivo } from '@/api/objetivos';
import { useUsuariosActivos } from '@/hooks/useUsuarios';
import { crearTareaPlanificada } from '@/api/semana';
import { fechaLocalYmd } from '@/lib/fecha';
import { Q_KPIS, Q_OBJ_PROG, useObjetivosProgreso } from '@/hooks/useObjetivosMetricas';
import { useDraftForm } from '@/hooks/useDraftForm';
import { useAuthStore } from '@/store/authStore';
import type { Tarea } from '@/types';

type NuevoObjetivoDraft = {
  titulo: string;
  descripcion: string;
  limite: string;
  responsableId: string;
};

type ObjetivoTareaNuevaDraft = {
  titulo: string;
  prioridad: Tarea['prioridad'];
  asignadoId: string;
  fecha: string;
};

export const Q_TAREAS_OBJ = 'objetivo-tareas';
export const Q_OTS_OBJ    = 'objetivo-ots';

export function useObjetivosPage() {
  const qc      = useQueryClient();
  const usuario = useAuthStore((s) => s.usuario);
  const esJefe  = usuario?.rol === 'jefe';

  const { data: objetivos = [], isLoading: loadO, isError } = useObjetivosProgreso();
  const { data: usuariosActivos = [] } = useUsuariosActivos({ enabled: esJefe });

  const [seleccionId, setSeleccionId] = useState<string | null>(null);
  const objetivoSel = objetivos.find((o) => o.id === seleccionId) ?? null;

  const { data: tareasVinc = [], isLoading: loadTareas } = useQuery({
    queryKey: [Q_TAREAS_OBJ, seleccionId],
    enabled:  Boolean(seleccionId),
    queryFn:  () => getTareasPorObjetivo(seleccionId!),
  });

  const { data: otsVinc = [], isLoading: loadOTs } = useQuery({
    queryKey: [Q_OTS_OBJ, seleccionId],
    enabled:  Boolean(seleccionId),
    queryFn:  () => getOTsPorObjetivo(seleccionId!),
  });

  const [menuObjId,    setMenuObjId]    = useState<string | null>(null);
  const [menuPos,      setMenuPos]      = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [tareaDetalle, setTareaDetalle] = useState<Tarea | null>(null);

  useEffect(() => {
    if (!menuObjId) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuObjId(null);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuObjId]);

  const [modalNuevo,      setModalNuevo]      = useState(false);
  const [modalCompletar,  setModalCompletar]  = useState(false);
  const [completarObjId,  setCompletarObjId]  = useState<string | null>(null);

  const nuevoObjInitial = useMemo<NuevoObjetivoDraft>(
    () => ({ titulo: '', descripcion: '', limite: '', responsableId: usuario?.id ?? '' }),
    [usuario?.id],
  );
  const {
    form:      nuevoObjetivoForm,
    setForm:   setNuevoObjetivoForm,
    hasChanges: nuevoObjetivoHasChanges,
    clearDraft: clearNuevoObjetivoDraft,
  } = useDraftForm('objetivo-nuevo', nuevoObjInitial, { enabled: modalNuevo });

  const [modalTarea, setModalTarea] = useState(false);
  const mananaYmd = fechaLocalYmd(new Date(Date.now() + 86_400_000));
  const tareaObjetivoInitial = useMemo<ObjetivoTareaNuevaDraft>(
    () => ({ titulo: '', prioridad: 'media', asignadoId: usuario?.id ?? '', fecha: mananaYmd }),
    [usuario?.id, mananaYmd],
  );
  const {
    form:      tareaObjetivoForm,
    setForm:   setTareaObjetivoForm,
    hasChanges: tareaObjetivoHasChanges,
    clearDraft: clearTareaObjetivoDraft,
  } = useDraftForm('objetivo-tarea-nueva', tareaObjetivoInitial, {
    enabled: modalTarea && Boolean(seleccionId),
  });

  const [eliminarObjId,  setEliminarObjId]  = useState<string | null>(null);
  const [motivoEliminar, setMotivoEliminar] = useState('');
  const objetivoEliminar = objetivos.find((o) => o.id === eliminarObjId) ?? null;
  const motivoOk = motivoEliminar.trim().length >= MIN_JUSTIFICACION_CHARS;

  const invalidarObjetivos = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: [Q_OBJ_PROG] }),
      qc.invalidateQueries({ queryKey: [Q_KPIS] }),
      qc.invalidateQueries({ queryKey: [Q_KPIS, usuario?.id] }),
    ]);
  };

  const mutCrearObj = useMutation({
    mutationFn: crearObjetivo,
    onSuccess: async () => {
      await invalidarObjetivos();
      clearNuevoObjetivoDraft();
      setModalNuevo(false);
      toast.success('Objetivo creado');
    },
    onError: (err) => { console.error('[mutCrearObj]', err); toast.error('No se pudo crear el objetivo.'); },
  });

  const mutCompletarObj = useMutation({
    mutationFn: completarObjetivo,
    onSuccess: async () => {
      await invalidarObjetivos();
      setModalCompletar(false);
      setCompletarObjId(null);
      toast.success('Objetivo completado');
    },
    onError: (err) => {
      console.error('[mutCompletarObj]', err);
      const msg = (err as { message?: string }).message ?? 'No se pudo completar el objetivo.';
      toast.error(msg);
    },
  });

  const mutEliminarObj = useMutation({
    mutationFn: (input: { objetivoId: string; usuarioId: string; motivo: string }) => eliminarObjetivo(input),
    onSuccess: async () => {
      await invalidarObjetivos();
      if (seleccionId === eliminarObjId) setSeleccionId(null);
      setEliminarObjId(null);
      setMotivoEliminar('');
      toast.success('Objetivo eliminado');
    },
    onError: (err) => { console.error('[mutEliminarObj]', err); toast.error('No se pudo eliminar el objetivo.'); },
  });

  const mutAddTarea = useMutation({
    mutationFn: crearTareaPlanificada,
    onSuccess: async (_, vars) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: [Q_TAREAS_OBJ, vars.objetivo_id] }),
        qc.invalidateQueries({ queryKey: [Q_OBJ_PROG] }),
        qc.invalidateQueries({ queryKey: ['semana'] }),
      ]);
      clearTareaObjetivoDraft();
      setModalTarea(false);
      toast.success('Tarea añadida al objetivo');
    },
    onError: (err) => { console.error('[mutAddTarea]', err); toast.error('No se pudo añadir la tarea.'); },
  });

  function puedeEliminar(objetivoId: string): boolean {
    const obj = objetivos.find((o) => o.id === objetivoId);
    if (!obj) return false;
    return esJefe || obj.creado_por === usuario?.id;
  }

  function puedeCompletar(objetivoId: string): boolean {
    const obj = objetivos.find((o) => o.id === objetivoId);
    if (!obj || obj.estado !== 'activo') return false;
    if (esJefe) return true;
    // Responsable puede completar solo al 100%
    return obj.responsable_id === usuario?.id && obj.pct >= 100;
  }

  async function submitNuevoObjetivo() {
    if (!usuario || !esJefe || !nuevoObjetivoForm.titulo.trim()) return;
    const responsable = nuevoObjetivoForm.responsableId.trim();
    if (!responsable) return;
    try {
      await mutCrearObj.mutateAsync({
        titulo:         nuevoObjetivoForm.titulo.trim(),
        descripcion:    nuevoObjetivoForm.descripcion.trim() || null,
        fecha_limite:   nuevoObjetivoForm.limite.trim() || null,
        creado_por:     usuario.id,
        responsable_id: responsable,
      });
    } catch (err) { console.error('[submitNuevoObjetivo]', err); }
  }

  function addTareaVinculada(input?: { titulo: string; prioridad: Tarea['prioridad']; descripcion: string; objetivo_id?: string | null; asignado_a: string }) {
    if (!seleccionId || !usuario) return;
    const titulo    = input?.titulo ?? tareaObjetivoForm.titulo.trim();
    const prioridad = input?.prioridad ?? tareaObjetivoForm.prioridad;
    const asignado  = (input?.asignado_a ?? tareaObjetivoForm.asignadoId.trim()) || null;
    if (!titulo) return;
    mutAddTarea.mutate({
      titulo,
      prioridad,
      descripcion:       input?.descripcion ?? null,
      fecha_planificada: tareaObjetivoForm.fecha || mananaYmd,
      asignado_a:        asignado,
      creado_por:        usuario.id,
      objetivo_id:       seleccionId,
    });
  }

  function abrirCompletar(objetivoId: string) {
    setCompletarObjId(objetivoId);
    setModalCompletar(true);
    setMenuObjId(null);
  }

  async function confirmarCompletar() {
    if (!completarObjId || !usuario) return;
    await mutCompletarObj.mutateAsync({ objetivoId: completarObjId, usuarioId: usuario.id });
  }

  function cerrarModalTareaObjetivo() { clearTareaObjetivoDraft(); setModalTarea(false); }
  function cerrarModalNuevoObjetivo() { clearNuevoObjetivoDraft(); setModalNuevo(false); }
  function cerrarEliminar()           { setEliminarObjId(null); setMotivoEliminar(''); }
  function cerrarCompletar()          { setCompletarObjId(null); setModalCompletar(false); }

  async function confirmarEliminar() {
    if (!eliminarObjId || !motivoOk || !usuario) return;
    try {
      await mutEliminarObj.mutateAsync({ objetivoId: eliminarObjId, usuarioId: usuario.id, motivo: motivoEliminar.trim() });
    } catch (err) { console.error('[confirmarEliminar]', err); }
  }

  return {
    usuario, esJefe,
    objetivos, loadO, isError,
    tareasVinc, loadTareas,
    otsVinc, loadOTs,
    usuariosActivos,
    objetivoSel, objetivoEliminar,
    seleccionId, setSeleccionId,
    menuObjId, setMenuObjId, menuPos, setMenuPos, menuRef,
    tareaDetalle, setTareaDetalle,
    modalNuevo, setModalNuevo,
    nuevoObjetivoForm, setNuevoObjetivoForm,
    nuevoObjetivoHasChanges,
    cerrarModalNuevoObjetivo,
    creandoObj: mutCrearObj.isPending,
    modalTarea, setModalTarea,
    tareaObjetivoForm, setTareaObjetivoForm,
    tareaObjetivoHasChanges,
    cerrarModalTareaObjetivo,
    addingTarea: mutAddTarea.isPending,
    eliminarObjId, setEliminarObjId,
    motivoEliminar, setMotivoEliminar,
    motivoOk, MIN_JUSTIFICACION_CHARS,
    eliminandoObj: mutEliminarObj.isPending,
    modalCompletar, completarObjId,
    completandoObj: mutCompletarObj.isPending,
    puedeEliminar, puedeCompletar,
    submitNuevoObjetivo,
    addTareaVinculada,
    confirmarEliminar,
    confirmarCompletar,
    cerrarCompletar,
    abrirCompletar,
    abrirModalNuevo: () => { if (esJefe) setModalNuevo(true); },
    cerrarEliminar,
  };
}