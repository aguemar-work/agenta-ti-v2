/**
 * hooks/useObjetivosPage.ts
 * Lógica diferenciada por rol para crear objetivos:
 *   - Jefe: puede asignar responsable_id a cualquier usuario
 *   - Miembro: responsable_id siempre es su propio id (forzado aquí y en RLS)
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MIN_JUSTIFICACION_CHARS } from '@/lib/constants';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { crearObjetivo, eliminarObjetivo, getTareasPorObjetivo } from '@/api/objetivos';
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

/** Modal «Añadir tarea al objetivo» — borrador en localStorage */
type ObjetivoTareaNuevaDraft = {
  titulo: string;
  prioridad: Tarea['prioridad'];
  asignadoId: string;
};

export const Q_TAREAS_OBJ = 'objetivo-tareas';

export function useObjetivosPage() {
  const qc = useQueryClient();
  const usuario = useAuthStore((s) => s.usuario);
  const esJefe = usuario?.rol === 'jefe';

  const { data: objetivos = [], isLoading: loadO, isError } = useObjetivosProgreso();
  const { data: usuariosActivos = [] } = useUsuariosActivos({ enabled: esJefe });

  const [seleccionId, setSeleccionId] = useState<string | null>(null);
  const objetivoSel = objetivos.find((o) => o.id === seleccionId) ?? null;

  const { data: tareasVinc = [], isLoading: loadTareas } = useQuery({
    queryKey: [Q_TAREAS_OBJ, seleccionId],
    enabled: Boolean(seleccionId),
    queryFn: () => getTareasPorObjetivo(seleccionId!),
  });

  const [menuObjId, setMenuObjId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuObjId) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuObjId(null);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuObjId]);

  const [modalNuevo, setModalNuevo] = useState(false);
  const nuevoObjInitial = useMemo<NuevoObjetivoDraft>(
    () => ({
      titulo: '',
      descripcion: '',
      limite: '',
      responsableId: usuario?.id ?? '',
    }),
    [usuario?.id],
  );
  const {
    form: nuevoObjetivoForm,
    setForm: setNuevoObjetivoForm,
    hasChanges: nuevoObjetivoHasChanges,
    clearDraft: clearNuevoObjetivoDraft,
  } = useDraftForm('objetivo-nuevo', nuevoObjInitial, { enabled: modalNuevo });

  const [modalTarea, setModalTarea] = useState(false);
  const tareaObjetivoInitial = useMemo<ObjetivoTareaNuevaDraft>(
    () => ({
      titulo: '',
      prioridad: 'media',
      asignadoId: usuario?.id ?? '',
    }),
    [usuario?.id],
  );
  const {
    form: tareaObjetivoForm,
    setForm: setTareaObjetivoForm,
    hasChanges: tareaObjetivoHasChanges,
    clearDraft: clearTareaObjetivoDraft,
  } = useDraftForm('objetivo-tarea-nueva', tareaObjetivoInitial, {
    enabled: modalTarea && Boolean(seleccionId),
  });

  const [eliminarObjId, setEliminarObjId] = useState<string | null>(null);
  const [motivoEliminar, setMotivoEliminar] = useState('');
  const objetivoEliminar = objetivos.find((o) => o.id === eliminarObjId) ?? null;
  const motivoOk = motivoEliminar.trim().length >= MIN_JUSTIFICACION_CHARS;

  const mutCrearObj = useMutation({
    mutationFn: crearObjetivo,
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ refetchType: 'active', queryKey: [Q_OBJ_PROG] }),
        qc.invalidateQueries({ refetchType: 'active', queryKey: [Q_KPIS] }),
        qc.invalidateQueries({ refetchType: 'active', queryKey: [Q_KPIS, usuario?.id] }),
      ]);
      clearNuevoObjetivoDraft();
      setModalNuevo(false);
      toast.success('Objetivo creado');
    },
    onError: (err) => { console.error('[mutCrearObj]', err); toast.error('No se pudo crear el objetivo.'); },
  });

  const mutEliminarObj = useMutation({
    mutationFn: (input: { objetivoId: string; usuarioId: string; motivo: string }) => eliminarObjetivo(input),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ refetchType: 'active', queryKey: [Q_OBJ_PROG] }),
        qc.invalidateQueries({ refetchType: 'active', queryKey: [Q_KPIS] }),
        qc.invalidateQueries({ refetchType: 'active', queryKey: [Q_KPIS, usuario?.id] }),
      ]);
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
        qc.invalidateQueries({ refetchType: 'active', queryKey: [Q_TAREAS_OBJ, vars.objetivo_id] }),
        qc.invalidateQueries({ refetchType: 'active', queryKey: [Q_OBJ_PROG] }),
        qc.invalidateQueries({ refetchType: 'active', queryKey: ['tablero'] }),
        qc.invalidateQueries({ refetchType: 'active', queryKey: ['semana'] }),
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

  async function submitNuevoObjetivo() {
    if (!usuario || !nuevoObjetivoForm.titulo.trim()) return;
    // Miembro siempre es responsable de sus propios objetivos — RLS lo refuerza
    const responsable = esJefe ? nuevoObjetivoForm.responsableId.trim() : usuario.id;
    if (!responsable) return;
    try {
      await mutCrearObj.mutateAsync({
        titulo: nuevoObjetivoForm.titulo.trim(),
        descripcion: nuevoObjetivoForm.descripcion.trim() || null,
        fecha_limite: nuevoObjetivoForm.limite.trim() || null,
        creado_por: usuario.id,
        responsable_id: responsable,
      });
    } catch (err) { console.error('[submitNuevoObjetivo]', err); }
  }

  function addTareaVinculada() {
    if (!seleccionId || !tareaObjetivoForm.titulo.trim() || !usuario) return;
    mutAddTarea.mutate({
      titulo: tareaObjetivoForm.titulo.trim(),
      prioridad: tareaObjetivoForm.prioridad,
      descripcion: null,
      fecha_planificada: fechaLocalYmd(new Date()), // hoy por defecto; se puede reprogramar
      asignado_a: tareaObjetivoForm.asignadoId.trim() || null,
      creado_por: usuario.id,
      objetivo_id: seleccionId,
    });
  }

  function cerrarModalTareaObjetivo() {
    clearTareaObjetivoDraft();
    setModalTarea(false);
  }

  async function confirmarEliminar() {
    if (!eliminarObjId || !motivoOk || !usuario) return;
    try {
      await mutEliminarObj.mutateAsync({ objetivoId: eliminarObjId, usuarioId: usuario.id, motivo: motivoEliminar.trim() });
    } catch (err) { console.error('[confirmarEliminar]', err); }
  }

  function abrirModalNuevo() {
    setModalNuevo(true);
  }

  function cerrarModalNuevoObjetivo() {
    clearNuevoObjetivoDraft();
    setModalNuevo(false);
  }

  function cerrarEliminar() { setEliminarObjId(null); setMotivoEliminar(''); }

  return {
    usuario, esJefe,
    objetivos, loadO, isError,
    tareasVinc, loadTareas,
    usuariosActivos,
    objetivoSel, objetivoEliminar,
    seleccionId, setSeleccionId,
    menuObjId, setMenuObjId, menuRef,
    modalNuevo, setModalNuevo,
    nuevoObjetivoForm,
    setNuevoObjetivoForm,
    nuevoObjetivoHasChanges,
    cerrarModalNuevoObjetivo,
    creandoObj: mutCrearObj.isPending,
    modalTarea, setModalTarea,
    tareaObjetivoForm,
    setTareaObjetivoForm,
    tareaObjetivoHasChanges,
    cerrarModalTareaObjetivo,
    addingTarea: mutAddTarea.isPending,
    eliminarObjId, setEliminarObjId,
    motivoEliminar, setMotivoEliminar,
    motivoOk, MIN_JUSTIFICACION_CHARS,
    eliminandoObj: mutEliminarObj.isPending,
    puedeEliminar,
    submitNuevoObjetivo,
    addTareaVinculada,
    confirmarEliminar,
    abrirModalNuevo,
    cerrarEliminar,
  };
}