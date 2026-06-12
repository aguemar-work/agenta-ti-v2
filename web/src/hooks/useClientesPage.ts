/**
 * hooks/useClientesPage.ts
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import {
  Q_CLIENTES,
  actualizarCliente,
  crearCliente,
  desactivarCliente,
  getClientes,
} from '@/api/clientes';
import { useWorkspaceId } from '@/hooks/useWorkspaceId';
import { qkWsId } from '@/lib/queryKeys';
import { useWorkspaceStore } from '@/store/workspaceStore';

type ClienteForm = { nombre: string };

const FORM_VACIO: ClienteForm = { nombre: '' };

export function useClientesPage() {
  const qc = useQueryClient();
  const workspaceId = useWorkspaceId();
  const esJefe = useWorkspaceStore((s) => s.esJefe());

  const {
    data: clientes = [],
    isLoading: loadClientes,
    isError,
  } = useQuery({
    queryKey: qkWsId(workspaceId, Q_CLIENTES),
    enabled: Boolean(workspaceId),
    queryFn: getClientes,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<ClienteForm>(FORM_VACIO);
  const [formInicial, setFormInicial] = useState<ClienteForm>(FORM_VACIO);
  const [desactivarId, setDesactivarId] = useState<string | null>(null);

  const hasChanges = useMemo(
    () => form.nombre.trim() !== formInicial.nombre.trim(),
    [form.nombre, formInicial.nombre],
  );

  const nombreValido = form.nombre.trim().length > 0;

  const invalidar = useCallback(() => {
    void qc.invalidateQueries({ queryKey: qkWsId(workspaceId, Q_CLIENTES) });
  }, [qc, workspaceId]);

  const mutCrear = useMutation({
    mutationFn: () => crearCliente({ nombre: form.nombre }),
    onSuccess: () => {
      invalidar();
      toast.success('Cliente creado');
      cerrarModal();
    },
    onError: () => toast.error('No se pudo crear el cliente'),
  });

  const mutActualizar = useMutation({
    mutationFn: () => actualizarCliente({ id: editandoId!, nombre: form.nombre }),
    onSuccess: () => {
      invalidar();
      toast.success('Cliente actualizado');
      cerrarModal();
    },
    onError: () => toast.error('No se pudo actualizar el cliente'),
  });

  const mutDesactivar = useMutation({
    mutationFn: (id: string) => desactivarCliente(id),
    onSuccess: () => {
      invalidar();
      toast.success('Cliente desactivado');
      setDesactivarId(null);
    },
    onError: () => toast.error('No se pudo desactivar el cliente'),
  });

  function abrirNuevo() {
    setEditandoId(null);
    setForm(FORM_VACIO);
    setFormInicial(FORM_VACIO);
    setModalOpen(true);
  }

  function abrirEditar(id: string) {
    const cliente = clientes.find((c) => c.id === id);
    if (!cliente) return;
    const draft = { nombre: cliente.nombre };
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

  return {
    esJefe,
    clientes,
    loadClientes,
    isError,
    modalOpen,
    editandoId,
    form,
    setForm,
    hasChanges,
    nombreValido,
    guardando,
    desactivarId,
    setDesactivarId,
    desactivando: mutDesactivar.isPending,
    abrirNuevo,
    abrirEditar,
    cerrarModal,
    submitForm,
    confirmarDesactivar: () => {
      if (desactivarId) mutDesactivar.mutate(desactivarId);
    },
  };
}
