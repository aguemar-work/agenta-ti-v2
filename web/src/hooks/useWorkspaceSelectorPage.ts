/**
 * hooks/useWorkspaceSelectorPage.ts
 * Orquestador de la vista de selección de organización y workspace.
 */

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import {
  getModulosDelWorkspace,
  getWorkspacesAccesiblesDeOrg,
  guardarPreferenciaWorkspace,
} from '@/api/workspace';
import type { WorkspaceConRol } from '@/store/workspaceStore';
import { useWorkspaceStore } from '@/store/workspaceStore';

export function useWorkspaceSelectorPage() {
  const orgs            = useWorkspaceStore((s) => s.orgs);
  const workspacesStore = useWorkspaceStore((s) => s.workspaces);
  const setOrgActiva    = useWorkspaceStore((s) => s.setOrgActiva);
  const setWorkspaceActivo = useWorkspaceStore((s) => s.setWorkspaceActivo);
  const setWorkspaces   = useWorkspaceStore((s) => s.setWorkspaces);
  const setInicializado = useWorkspaceStore((s) => s.setInicializado);

  const orgUnica   = orgs.length === 1;
  const orgInicial = orgUnica ? orgs[0]!.id : (orgs[0]?.id ?? '');

  const [orgId,           setOrgId]          = useState(orgInicial);
  const [workspaceId,     setWorkspaceId]    = useState('');
  const [workspaces,      setWorkspacesLocal] = useState<WorkspaceConRol[]>(
    orgUnica ? workspacesStore : [],
  );
  const [cargandoWs,  setCargandoWs]  = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const orgSeleccionada = useMemo(
    () => orgs.find((o) => o.id === orgId) ?? null,
    [orgs, orgId],
  );

  useEffect(() => {
    if (!orgId) {
      setWorkspacesLocal([]); // eslint-disable-line react-hooks/set-state-in-effect -- resetea workspaces al cambiar de org
      setWorkspaceId('');
      return;
    }

    if (orgUnica && workspacesStore.length > 0) {
      setWorkspacesLocal(workspacesStore);
      setWorkspaceId(workspacesStore[0]?.id ?? '');
      return;
    }

    let cancelled = false;
    setCargandoWs(true);

    void (async () => {
      try {
        const lista = await getWorkspacesAccesiblesDeOrg(orgId);
        if (cancelled) return;
        setWorkspacesLocal(lista);
        setWorkspaces(lista);
        setWorkspaceId(lista[0]?.id ?? '');
      } catch (err) {
        console.error('[useWorkspaceSelectorPage]', err);
        toast.error('No se pudieron cargar los espacios de trabajo.');
      } finally {
        if (!cancelled) setCargandoWs(false);
      }
    })();

    return () => { cancelled = true; };
  }, [orgId, orgUnica, setWorkspaces, workspacesStore]);

  const workspaceSeleccionado = workspaces.find((w) => w.id === workspaceId) ?? null;
  const puedeConfirmar = Boolean(orgSeleccionada && workspaceSeleccionado && !cargandoWs);

  async function confirmar() {
    if (!orgSeleccionada || !workspaceSeleccionado) return;
    setConfirmando(true);
    try {
      await guardarPreferenciaWorkspace(orgSeleccionada.id, workspaceSeleccionado.id);
      setOrgActiva(orgSeleccionada);
      setWorkspaceActivo(workspaceSeleccionado, workspaceSeleccionado.rol);
      try {
        const modulos = await getModulosDelWorkspace(workspaceSeleccionado.id);
        useWorkspaceStore.getState().setModulos(modulos);
      } catch (err) {
        console.error('[useWorkspaceSelectorPage] módulos', err);
        useWorkspaceStore.getState().setModulos([]);
      }
      setInicializado(true);
    } catch (err) {
      console.error('[useWorkspaceSelectorPage.confirmar]', err);
      toast.error('No se pudo guardar tu selección.');
    } finally {
      setConfirmando(false);
    }
  }

  return {
    orgs,
    orgUnica,
    orgId,
    setOrgId,
    workspaceId,
    setWorkspaceId,
    workspaces,
    cargandoWs,
    confirmando,
    orgSeleccionada,
    workspaceSeleccionado,
    puedeConfirmar,
    confirmar,
  };
}
