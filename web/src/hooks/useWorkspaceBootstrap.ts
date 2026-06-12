/**
 * hooks/useWorkspaceBootstrap.ts
 * Orquesta la carga inicial de org/workspace tras el login.
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { fetchEsPlataformaOwnerCached } from '@/api/plataforma';
import {
  getModulosDelWorkspace,
  getOrgsDelUsuario,
  getPreferenciaWorkspace,
  getWorkspacesAccesiblesDeOrg,
  guardarPreferenciaWorkspace,
} from '@/api/workspace';
import { useAuthStore } from '@/store/authStore';
import type { Organizacion, WorkspaceConRol } from '@/store/workspaceStore';
import { useWorkspaceStore } from '@/store/workspaceStore';

async function aplicarContexto(org: Organizacion, ws: WorkspaceConRol) {
  const { setOrgActiva, setWorkspaceActivo, setModulos, setInicializado } = useWorkspaceStore.getState();
  setOrgActiva(org);
  setWorkspaceActivo(ws, ws.rol);
  try {
    const modulos = await getModulosDelWorkspace(ws.id);
    setModulos(modulos);
  } catch (err) {
    console.error('[useWorkspaceBootstrap] módulos', err);
    setModulos([]);
  }
  setInicializado(true);
}

export function useWorkspaceBootstrap(): {
  necesitaSelector: boolean;
  error: string | null;
  reintentar: () => void;
} {
  const usuario = useAuthStore((s) => s.usuario);
  const inicializado = useWorkspaceStore((s) => s.inicializado);

  const [necesitaSelector, setNecesitaSelector] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intentos, setIntentos] = useState(0);
  const [storeHydrated, setStoreHydrated] = useState(
    () => useWorkspaceStore.persist.hasHydrated(),
  );

  const reintentar = useCallback(() => {
    setError(null);
    setNecesitaSelector(false);
    setIntentos((n) => n + 1);
  }, []);

  useEffect(() => {
    if (useWorkspaceStore.persist.hasHydrated()) {
      setStoreHydrated(true);
      return;
    }
    return useWorkspaceStore.persist.onFinishHydration(() => {
      setStoreHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!usuario || !storeHydrated) return;

    if (useWorkspaceStore.getState().inicializado) {
      setNecesitaSelector(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function bootstrap() {
      setError(null);
      setNecesitaSelector(false);
      useWorkspaceStore.getState().setCargando(true);

      try {
        // Rehidratar modo panel (refresh en /panel): no caer en contexto operativo.
        const modoPersistido = useWorkspaceStore.getState().modoContexto;
        if (modoPersistido === 'panel') {
          let esOwner = false;
          try {
            esOwner = await fetchEsPlataformaOwnerCached();
          } catch (err) {
            console.error('[useWorkspaceBootstrap] esOwner panel', err);
            esOwner = false;
          }
          if (cancelled) return;

          if (esOwner) {
            const orgsPanel = await getOrgsDelUsuario();
            if (cancelled) return;
            useWorkspaceStore.getState().setOrgs(orgsPanel);
            useWorkspaceStore.getState().entrarModoPanel();
            return;
          }
          // Ya no es dueño: seguir flujo operativo normal.
        }

        const orgs = await getOrgsDelUsuario();
        if (cancelled) return;

        if (orgs.length === 0) {
          let esOwner = false;
          try {
            esOwner = await fetchEsPlataformaOwnerCached();
          } catch (err) {
            console.error('[useWorkspaceBootstrap] esOwner', err);
            esOwner = false;
          }
          if (cancelled) return;

          if (esOwner) {
            useWorkspaceStore.getState().setOrgs([]);
            useWorkspaceStore.getState().entrarModoPanel();
            return;
          }

          setError('No tienes acceso a ninguna organización.');
          toast.error('No tienes acceso a ninguna organización.');
          return;
        }

        useWorkspaceStore.getState().setOrgs(orgs);

        const { orgActiva, workspaceActivo, rolActivo } = useWorkspaceStore.getState();

        // Contexto rehidratado desde localStorage — validar membresía vigente
        if (orgActiva && workspaceActivo && rolActivo) {
          const orgValida = orgs.some((o) => o.id === orgActiva.id);
          if (orgValida) {
            const workspaces = await getWorkspacesAccesiblesDeOrg(orgActiva.id);
            if (cancelled) return;
            const wsValido = workspaces.find((w) => w.id === workspaceActivo.id);
            if (wsValido) {
              await aplicarContexto(orgActiva, wsValido);
              return;
            }
          }
        }

        const pref = await getPreferenciaWorkspace();
        if (cancelled) return;

        if (pref?.ultima_org_id && pref.ultima_workspace_id) {
          const org = orgs.find((o) => o.id === pref.ultima_org_id);
          if (org) {
            const workspaces = await getWorkspacesAccesiblesDeOrg(org.id);
            if (cancelled) return;
            const ws = workspaces.find((w) => w.id === pref.ultima_workspace_id);
            if (ws) {
              await aplicarContexto(org, ws);
              return;
            }
          }
        }

        const wsPorOrg = await Promise.all(
          orgs.map(async (org) => ({
            org,
            workspaces: await getWorkspacesAccesiblesDeOrg(org.id),
          })),
        );
        if (cancelled) return;

        const accesibles = wsPorOrg.flatMap(({ org, workspaces }) =>
          workspaces.map((ws) => ({ org, ws })),
        );

        if (accesibles.length === 0) {
          setError('No tienes acceso a ningún espacio de trabajo.');
          toast.error('No tienes acceso a ningún espacio de trabajo.');
          return;
        }

        if (orgs.length === 1 && accesibles.length === 1) {
          const { org, ws } = accesibles[0]!;
          await guardarPreferenciaWorkspace(org.id, ws.id);
          if (cancelled) return;
          await aplicarContexto(org, ws);
          return;
        }

        if (orgs.length === 1) {
          useWorkspaceStore.getState().setWorkspaces(wsPorOrg[0]!.workspaces);
        }

        setNecesitaSelector(true);
      } catch (err) {
        if (cancelled) return;
        console.error('[useWorkspaceBootstrap]', err);
        setError('No se pudo cargar tu espacio de trabajo.');
        toast.error('No se pudo cargar tu espacio de trabajo.');
      } finally {
        if (!cancelled) {
          useWorkspaceStore.getState().setCargando(false);
        }
      }
    }

    void bootstrap();
    return () => { cancelled = true; };
  }, [usuario?.id, inicializado, storeHydrated, intentos]);

  if (inicializado) {
    return { necesitaSelector: false, error: null, reintentar };
  }

  return { necesitaSelector, error, reintentar };
}
