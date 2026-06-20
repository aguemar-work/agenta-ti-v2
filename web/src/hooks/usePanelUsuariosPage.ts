/**
 * hooks/usePanelUsuariosPage.ts
 * Orquestador de la vista Panel Usuarios.
 */

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import type { UsuarioPlataforma } from '@/api/plataforma';
import { getOrgsDelUsuario } from '@/api/workspace';
import { useEsPlataformaOwner } from '@/hooks/useEsPlataformaOwner';
import { useEliminarUsuario, useUsuariosPlataforma } from '@/hooks/useUsuariosPlataforma';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';

export function usePanelUsuariosPage() {
  const orgs = useWorkspaceStore((s) => s.orgs);
  const setOrgs = useWorkspaceStore((s) => s.setOrgs);
  const usuarioActualId = useAuthStore((s) => s.usuario?.id);

  const { data: esOwner } = useEsPlataformaOwner();
  const { data: usuarios, isLoading, isError, error } = useUsuariosPlataforma();

  const [cargandoOrgs, setCargandoOrgs] = useState(false);
  const [modalInvitar,    setModalInvitar]    = useState(false);
  const [usuarioAsignar,  setUsuarioAsignar]  = useState<UsuarioPlataforma | null>(null);
  const [modalAsignar,    setModalAsignar]    = useState(false);
  const [usuarioEliminar, setUsuarioEliminar] = useState<UsuarioPlataforma | null>(null);
  const [modalEliminar,   setModalEliminar]   = useState(false);

  const { mutate: eliminar, isPending: eliminando } = useEliminarUsuario(() => {
    toast.success(`Usuario ${usuarioEliminar?.nombre ?? ''} eliminado.`);
    setModalEliminar(false);
    setUsuarioEliminar(null);
  });

  useEffect(() => {
    if (orgs.length > 0) return;

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- flag de carga antes del fetch async; cancelled garantiza no-op en desmonte
    setCargandoOrgs(true);

    void (async () => {
      try {
        const lista = await getOrgsDelUsuario();
        if (!cancelled) setOrgs(lista);
      } catch (err) {
        console.error('[usePanelUsuariosPage.loadOrgs]', err);
        if (!cancelled) toast.error('No se pudieron cargar las organizaciones.');
      } finally {
        if (!cancelled) setCargandoOrgs(false);
      }
    })();

    return () => { cancelled = true; };
  }, [orgs.length, setOrgs]);

  useEffect(() => {
    if (isError && error) console.error('[usePanelUsuariosPage]', error);
  }, [isError, error]);

  function abrirAsignar(usuario: UsuarioPlataforma) {
    if (!esOwner) return;
    setUsuarioAsignar(usuario);
    setModalAsignar(true);
  }

  function abrirEliminar(usuario: UsuarioPlataforma) {
    if (!esOwner) return;
    setUsuarioEliminar(usuario);
    setModalEliminar(true);
  }

  function confirmarEliminar() {
    if (!usuarioEliminar) return;
    eliminar(usuarioEliminar.usuario_id, {
      onError: (err) => {
        console.error('[usePanelUsuariosPage.eliminar]', err);
        const msg = (err as { message?: string })?.message ?? 'No se pudo eliminar el usuario.';
        toast.error(msg);
      },
    });
  }

  return {
    orgs,
    esOwner,
    usuarios: usuarios ?? [],
    isLoading,
    isError,
    usuarioActualId,
    cargandoOrgs,
    eliminando,
    modalInvitar,
    setModalInvitar,
    usuarioAsignar,
    modalAsignar,
    setModalAsignar,
    setUsuarioAsignar,
    usuarioEliminar,
    modalEliminar,
    setModalEliminar,
    setUsuarioEliminar,
    abrirAsignar,
    abrirEliminar,
    confirmarEliminar,
  };
}
