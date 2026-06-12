/**
 * hooks/useAreasPage.ts
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import {
  Q_AREAS,
  actualizarArea,
  crearArea,
  desactivarArea,
  getAreas,
} from '@/api/areas';
import { useWorkspaceId } from '@/hooks/useWorkspaceId';
import { qkWsId } from '@/lib/queryKeys';
import { useWorkspaceStore } from '@/store/workspaceStore';

type AreaForm = { nombre: string };

const FORM_VACIO: AreaForm = { nombre: '' };

export function useAreasPage() {
  const qc = useQueryClient();
  const workspaceId = useWorkspaceId();
  const esJefe = useWorkspaceStore((s) => s.esJefe());

  const {
    data: areas = [],
    isLoading: loadAreas,
    isError,
  } = useQuery({
    queryKey: qkWsId(workspaceId, Q_AREAS),
    enabled: Boolean(workspaceId),
    queryFn: getAreas,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<AreaForm>(FORM_VACIO);
  const [formInicial, setFormInicial] = useState<AreaForm>(FORM_VACIO);
  const [desactivarId, setDesactivarId] = useState<string | null>(null);

  const hasChanges = useMemo(
    () => form.nombre.trim() !== formInicial.nombre.trim(),
    [form.nombre, formInicial.nombre],
  );

  const nombreValido = form.nombre.trim().length > 0;

  const invalidar = useCallback(() => {
    void qc.invalidateQueries({ queryKey: qkWsId(workspaceId, Q_AREAS) });
  }, [qc, workspaceId]);

  const mutCrear = useMutation({
    mutationFn: () => crearArea({ nombre: form.nombre }),
    onSuccess: () => {
      invalidar();
      toast.success('Área creada');
      cerrarModal();
    },
    onError: () => toast.error('No se pudo crear el área'),
  });

  const mutActualizar = useMutation({
    mutationFn: () => actualizarArea({ id: editandoId!, nombre: form.nombre }),
    onSuccess: () => {
      invalidar();
      toast.success('Área actualizada');
      cerrarModal();
    },
    onError: () => toast.error('No se pudo actualizar el área'),
  });

  const mutDesactivar = useMutation({
    mutationFn: (id: string) => desactivarArea(id),
    onSuccess: () => {
      invalidar();
      toast.success('Área desactivada');
      setDesactivarId(null);
    },
    onError: () => toast.error('No se pudo desactivar el área'),
  });

  function abrirNuevo() {
    setEditandoId(null);
    setForm(FORM_VACIO);
    setFormInicial(FORM_VACIO);
    setModalOpen(true);
  }

  function abrirEditar(id: string) {
    const area = areas.find((a) => a.id === id);
    if (!area) return;
    const draft = { nombre: area.nombre };
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
    areas,
    loadAreas,
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
