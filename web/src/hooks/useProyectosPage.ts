/**
 * hooks/useProyectosPage.ts
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Q_CLIENTES, getClientes } from '@/api/clientes';
import {
  Q_PROYECTOS,
  archivarProyecto,
  actualizarProyecto,
  crearProyecto,
  getProyectos,
  type EstadoProyecto,
} from '@/api/proyectos';
import { useWorkspaceId } from '@/hooks/useWorkspaceId';
import { qkWsId } from '@/lib/queryKeys';
import { useWorkspaceStore } from '@/store/workspaceStore';

type ProyectoForm = {
  nombre: string;
  descripcion: string;
  cliente_id: string;
  estado: EstadoProyecto;
};

const FORM_VACIO: ProyectoForm = {
  nombre: '',
  descripcion: '',
  cliente_id: '',
  estado: 'activo',
};

function formFromProyecto(p: {
  nombre: string;
  descripcion: string | null;
  cliente_id: string | null;
  estado: EstadoProyecto;
}): ProyectoForm {
  return {
    nombre:      p.nombre,
    descripcion: p.descripcion ?? '',
    cliente_id:  p.cliente_id ?? '',
    estado:      p.estado,
  };
}

export function useProyectosPage() {
  const qc = useQueryClient();
  const workspaceId = useWorkspaceId();
  const esJefe = useWorkspaceStore((s) => s.esJefe());

  const {
    data: proyectos = [],
    isLoading: loadProyectos,
    isError,
  } = useQuery({
    queryKey: qkWsId(workspaceId, Q_PROYECTOS),
    enabled: Boolean(workspaceId),
    queryFn: getProyectos,
  });

  const { data: clientes = [], isLoading: loadClientes } = useQuery({
    queryKey: qkWsId(workspaceId, Q_CLIENTES),
    enabled: Boolean(workspaceId),
    queryFn: getClientes,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<ProyectoForm>(FORM_VACIO);
  const [formInicial, setFormInicial] = useState<ProyectoForm>(FORM_VACIO);
  const [archivarId, setArchivarId] = useState<string | null>(null);

  const hasChanges = useMemo(
    () =>
      form.nombre.trim() !== formInicial.nombre.trim()
      || form.descripcion.trim() !== formInicial.descripcion.trim()
      || form.cliente_id !== formInicial.cliente_id
      || form.estado !== formInicial.estado,
    [form, formInicial],
  );

  const nombreValido = form.nombre.trim().length > 0;

  const invalidar = useCallback(() => {
    void qc.invalidateQueries({ queryKey: qkWsId(workspaceId, Q_PROYECTOS) });
  }, [qc, workspaceId]);

  function payloadFromForm() {
    return {
      nombre:      form.nombre,
      descripcion: form.descripcion || null,
      cliente_id:  form.cliente_id || null,
      estado:      form.estado,
    };
  }

  const mutCrear = useMutation({
    mutationFn: () => crearProyecto(payloadFromForm()),
    onSuccess: () => {
      invalidar();
      toast.success('Proyecto creado');
      cerrarModal();
    },
    onError: () => toast.error('No se pudo crear el proyecto'),
  });

  const mutActualizar = useMutation({
    mutationFn: () => actualizarProyecto({ id: editandoId!, ...payloadFromForm() }),
    onSuccess: () => {
      invalidar();
      toast.success('Proyecto actualizado');
      cerrarModal();
    },
    onError: () => toast.error('No se pudo actualizar el proyecto'),
  });

  const mutArchivar = useMutation({
    mutationFn: (id: string) => archivarProyecto(id),
    onSuccess: () => {
      invalidar();
      toast.success('Proyecto archivado');
      setArchivarId(null);
    },
    onError: () => toast.error('No se pudo archivar el proyecto'),
  });

  function abrirNuevo() {
    setEditandoId(null);
    setForm(FORM_VACIO);
    setFormInicial(FORM_VACIO);
    setModalOpen(true);
  }

  function abrirEditar(id: string) {
    const proyecto = proyectos.find((p) => p.id === id);
    if (!proyecto) return;
    const draft = formFromProyecto(proyecto);
    setEditandoId(id);
    setForm(draft);
    setFormInicial(draft);
    setModalOpen(true);
  }

  function cerrarModal() {
    setModalOpen(false);
    setEditandoId(null);
    setForm(FORM_VACIO);
    setFormInicial(FORM_VACIO);
  }

  function submitForm() {
    if (!nombreValido) return;
    if (editandoId) {
      mutActualizar.mutate();
    } else {
      mutCrear.mutate();
    }
  }

  const guardando = mutCrear.isPending || mutActualizar.isPending;

  const nombreClientePorId = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clientes) m.set(c.id, c.nombre);
    return m;
  }, [clientes]);

  return {
    esJefe,
    proyectos,
    clientes,
    loadProyectos,
    loadClientes,
    isError,
    nombreClientePorId,
    modalOpen,
    editandoId,
    form,
    setForm,
    hasChanges,
    nombreValido,
    guardando,
    archivarId,
    setArchivarId,
    archivando: mutArchivar.isPending,
    abrirNuevo,
    abrirEditar,
    cerrarModal,
    submitForm,
    confirmarArchivar: () => {
      if (archivarId) mutArchivar.mutate(archivarId);
    },
  };
}
