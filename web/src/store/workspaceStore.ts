/**
 * store/workspaceStore.ts
 * Contexto activo de organización y workspace (V5 multi-tenant).
 * Solo estado — la carga de datos la hacen hooks (useXxxPage).
 * Persiste org/workspace/rol en localStorage para rehidratar tras refresh.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { queryClient } from '@/lib/queryClient';
import { useVistaStore } from '@/store/vistaStore';

// ── Tipos de dominio ─────────────────────────────────────────────────────────

export interface Organizacion {
  id: string;
  nombre: string;
  slug: string;
  activa: boolean;
}

export interface Workspace {
  id: string;
  organizacion_id: string;
  nombre: string;
  tipo: 'interno' | 'agencia';
  activo: boolean;
}

export interface WorkspaceMember {
  workspace_id: string;
  usuario_id: string;
  rol: 'jefe' | 'miembro';
  activo: boolean;
  joined_at: string | null;
}

/** Workspace con rol del usuario en el picker de bootstrap. */
export type WorkspaceConRol = Workspace & { rol: 'jefe' | 'miembro' };

// ── Estado y acciones ────────────────────────────────────────────────────────

export interface WorkspaceState {
  orgActiva: Organizacion | null;
  workspaceActivo: Workspace | null;
  rolActivo: 'jefe' | 'miembro' | null;
  modulos: string[];

  /** 'panel' = vista dueño sin workspace; 'operativo' = org+ws activos; null = bootstrap pendiente. */
  modoContexto: 'panel' | 'operativo' | null;

  orgs: Organizacion[];
  workspaces: WorkspaceConRol[];

  cargando: boolean;
  inicializado: boolean;
}

export interface WorkspaceActions {
  setOrgActiva: (org: Organizacion) => void;
  setWorkspaceActivo: (ws: Workspace, rol: 'jefe' | 'miembro') => void;
  setModulos: (modulos: string[]) => void;
  setOrgs: (orgs: Organizacion[]) => void;
  setWorkspaces: (workspaces: WorkspaceConRol[]) => void;
  setCargando: (v: boolean) => void;
  setInicializado: (v: boolean) => void;

  entrarModoPanel: () => void;
  entrarModoOperativo: () => void;

  /** Cambio en vivo de org+ws: un solo set, limpia caché del ws anterior y refetchea lo activo. */
  aplicarContextoOperativo: (
    org: Organizacion,
    ws: Workspace,
    rol: 'jefe' | 'miembro',
    modulos: string[],
  ) => void;

  esJefe: () => boolean;
  tieneModulo: (clave: string) => boolean;
  tieneWorkspace: () => boolean;
  getWorkspaceId: () => string | null;

  reset: () => void;
}

type WorkspaceStore = WorkspaceState & WorkspaceActions;

type WorkspacePersistido = Pick<
  WorkspaceState,
  'orgActiva' | 'workspaceActivo' | 'rolActivo' | 'modoContexto'
>;

const estadoInicial: WorkspaceState = {
  orgActiva: null,
  workspaceActivo: null,
  rolActivo: null,
  modulos: [],
  modoContexto: null,
  orgs: [],
  workspaces: [],
  cargando: false,
  inicializado: false,
};

// ── Store ────────────────────────────────────────────────────────────────────

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set, get) => ({
      ...estadoInicial,

      setOrgActiva: (org) => set({ orgActiva: org }),

      setWorkspaceActivo: (ws, rol) => {
        set({ workspaceActivo: ws, rolActivo: rol, modoContexto: 'operativo' });
        // Evita servir caché del workspace anterior al cambiar contexto
        void queryClient.invalidateQueries();
      },

      aplicarContextoOperativo: (org, ws, rol, modulos) => {
        const wsAnterior = get().workspaceActivo?.id ?? null;
        set({
          orgActiva: org,
          workspaceActivo: ws,
          rolActivo: rol,
          modulos,
          modoContexto: 'operativo',
        });
        useVistaStore.getState().reset();
        // qkWsId → [root, workspaceId, ...]; índice 1 es el scope de tenant
        if (wsAnterior && wsAnterior !== ws.id) {
          queryClient.removeQueries({
            predicate: (q) =>
              Array.isArray(q.queryKey) && q.queryKey[1] === wsAnterior,
          });
        }
        void queryClient.invalidateQueries({ refetchType: 'active' });
      },

      entrarModoPanel: () => {
        const wsAnterior = get().workspaceActivo?.id ?? null;
        set({
          modoContexto: 'panel',
          orgActiva: null,
          workspaceActivo: null,
          rolActivo: null,
          modulos: [],
          inicializado: true,
        });
        // Limpia queries del workspace anterior sin tocar las de plataforma.
        // qkWsId → [root, workspaceId, ...]: el wsId va en índice 1 (UUID).
        // Las keys de plataforma tienen strings en índice 1 ('esOwner', 'usuarios'),
        // por lo que el predicado nunca las toca → no hay parpadeo de "Principal".
        if (wsAnterior) {
          queryClient.removeQueries({
            predicate: (q) =>
              Array.isArray(q.queryKey) && q.queryKey[1] === wsAnterior,
          });
        }
      },

      entrarModoOperativo: () => {
        set({ modoContexto: 'operativo' });
      },

      setModulos: (modulos) => set({ modulos }),
      setOrgs: (orgs) => set({ orgs }),
      setWorkspaces: (workspaces) => set({ workspaces }),
      setCargando: (cargando) => set({ cargando }),
      setInicializado: (inicializado) => set({ inicializado }),

      esJefe: () => get().rolActivo === 'jefe',
      tieneModulo: (clave) => get().modulos.includes(clave),
      tieneWorkspace: () => get().workspaceActivo !== null,
      getWorkspaceId: () => get().workspaceActivo?.id ?? null,

      reset: () => {
        set({ ...estadoInicial });
        void useWorkspaceStore.persist.clearStorage();
      },
    }),
    {
      name: 'materen-workspace-v5',
      partialize: (state): WorkspacePersistido => ({
        orgActiva: state.orgActiva,
        workspaceActivo: state.workspaceActivo,
        rolActivo: state.rolActivo,
        modoContexto: state.modoContexto,
      }),
    },
  ),
);

/** Helper para uso fuera de React (p. ej. header x-workspace-id en el SDK). */
export const getWorkspaceId = (): string | null =>
  useWorkspaceStore.getState().workspaceActivo?.id ?? null;
