/**
 * hooks/useObjetivosPage.ts
 * Lógica diferenciada por rol para crear objetivos:
 *   - Jefe: puede asignar responsable_id a cualquier usuario
 *   - Miembro: responsable_id siempre es su propio id (forzado aquí y en RLS)
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { crearObjetivo, eliminarObjetivo, getTareasPorObjetivo } from '@/api/objetivos';
import { getUsuariosActivosParaAsignacion } from '@/api/usuarios';
import { crearTareaLibre } from '@/api/semana';
import { Q_KPIS, Q_OBJ_PROG, useObjetivosProgreso } from '@/hooks/useObjetivosMetricas';
import { useAuthStore } from '@/store/authStore';
import type { Tarea } from '@/types';

export const Q_TAREAS_OBJ = 'objetivo-tareas';
const MIN_MOTIVO = 10;

export function useObjetivosPage() {
  const qc = useQueryClient();
  const usuario = useAuthStore((s) => s.usuario);
  const esJefe = usuario?.rol === 'jefe';

  const { data: objetivos = [], isLoading: loadO, isError } = useObjetivosProgreso();
  const { data: usuariosActivos = [] } = useQuery({
    queryKey: ['usuarios-asignacion-objetivos'],
    queryFn: () => getUsuariosActivosParaAsignacion(),
    enabled: esJefe, // solo jefe necesita la lista
  });

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
  const [tituloObj, setTituloObj] = useState('');
  const [descObj, setDescObj] = useState('');
  const [limiteObj, setLimiteObj] = useState('');
  const [responsableObjId, setResponsableObjId] = useState('');

  const [modalTarea, setModalTarea] = useState(false);
  const [nuevaTareaTitulo, setNuevaTareaTitulo] = useState('');
  const [nuevaTareaPrioridad, setNuevaTareaPrioridad] = useState<Tarea['prioridad']>('media');
  const [nuevaTareaAsignadoId, setNuevaTareaAsignadoId] = useState('');

  const [eliminarObjId, setEliminarObjId] = useState<string | null>(null);
  const [motivoEliminar, setMotivoEliminar] = useState('');
  const objetivoEliminar = objetivos.find((o) => o.id === eliminarObjId) ?? null;
  const motivoOk = motivoEliminar.trim().length >= MIN_MOTIVO;

  useEffect(() => {
    if (!usuario?.id) return;
    setNuevaTareaAsignadoId(usuario.id);
    setResponsableObjId(usuario.id);
  }, [usuario?.id]);

  const mutCrearObj = useMutation({
    mutationFn: crearObjetivo,
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ refetchType: 'active', queryKey: [Q_OBJ_PROG] }),
        qc.invalidateQueries({ refetchType: 'active', queryKey: [Q_KPIS] }),
        qc.invalidateQueries({ refetchType: 'active', queryKey: [Q_KPIS, usuario?.id] }),
      ]);
      setTituloObj(''); setDescObj(''); setLimiteObj('');
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
    mutationFn: crearTareaLibre,
    onSuccess: async (_, vars) => {
      await Promise.all([
        qc.invalidateQueries({ refetchType: 'active', queryKey: [Q_TAREAS_OBJ, vars.objetivo_id] }),
        qc.invalidateQueries({ refetchType: 'active', queryKey: [Q_OBJ_PROG] }),
        qc.invalidateQueries({ refetchType: 'active', queryKey: ['tablero'] }),
        qc.invalidateQueries({ refetchType: 'active', queryKey: ['semana'] }),
      ]);
      setNuevaTareaTitulo('');
      setNuevaTareaPrioridad('media');
      setNuevaTareaAsignadoId(usuario?.id ?? '');
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
    if (!usuario || !tituloObj.trim()) return;
    // Miembro siempre es responsable de sus propios objetivos — RLS lo refuerza
    const responsable = esJefe ? responsableObjId.trim() : usuario.id;
    if (!responsable) return;
    try {
      await mutCrearObj.mutateAsync({
        titulo: tituloObj.trim(),
        descripcion: descObj.trim() || null,
        fecha_limite: limiteObj.trim() || null,
        creado_por: usuario.id,
        responsable_id: responsable,
      });
    } catch (err) { console.error('[submitNuevoObjetivo]', err); }
  }

  function addTareaVinculada() {
    if (!seleccionId || !nuevaTareaTitulo.trim() || !usuario) return;
    mutAddTarea.mutate({
      titulo: nuevaTareaTitulo.trim(),
      prioridad: nuevaTareaPrioridad,
      descripcion: null,
      asignado_a: nuevaTareaAsignadoId.trim() || null,
      creado_por: usuario.id,
      objetivo_id: seleccionId,
    });
  }

  async function confirmarEliminar() {
    if (!eliminarObjId || !motivoOk || !usuario) return;
    try {
      await mutEliminarObj.mutateAsync({ objetivoId: eliminarObjId, usuarioId: usuario.id, motivo: motivoEliminar.trim() });
    } catch (err) { console.error('[confirmarEliminar]', err); }
  }

  function abrirModalNuevo() {
    if (usuario) setResponsableObjId(usuario.id);
    setModalNuevo(true);
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
    tituloObj, setTituloObj,
    descObj, setDescObj,
    limiteObj, setLimiteObj,
    responsableObjId, setResponsableObjId,
    creandoObj: mutCrearObj.isPending,
    modalTarea, setModalTarea,
    nuevaTareaTitulo, setNuevaTareaTitulo,
    nuevaTareaPrioridad, setNuevaTareaPrioridad,
    nuevaTareaAsignadoId, setNuevaTareaAsignadoId,
    addingTarea: mutAddTarea.isPending,
    eliminarObjId, setEliminarObjId,
    motivoEliminar, setMotivoEliminar,
    motivoOk, MIN_MOTIVO,
    eliminandoObj: mutEliminarObj.isPending,
    puedeEliminar,
    submitNuevoObjetivo,
    addTareaVinculada,
    confirmarEliminar,
    abrirModalNuevo,
    cerrarEliminar,
  };
}