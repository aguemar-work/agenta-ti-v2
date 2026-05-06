import type { UserSchema } from '@insforge/sdk';
import { create } from 'zustand';

import type { RolUsuario, Usuario } from '@/types';

export type AuthState = {
  authUser:    UserSchema | null;
  usuario:     Usuario | null;
  isLoading:   boolean;
  setAuth:     (authUser: UserSchema | null, usuario: Usuario | null) => void;
  setLoading:  (v: boolean) => void;
  clear:       () => void;
  _onClearCbs: Array<() => void>;
  onClear:     (cb: () => void) => () => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  authUser:    null,
  usuario:     null,
  isLoading:   true,
  _onClearCbs: [],

  setAuth:    (authUser, usuario) => set({ authUser, usuario, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),

  clear: () => {
    set({ authUser: null, usuario: null, isLoading: false });
    get()._onClearCbs.forEach((cb) => cb());
  },

  onClear: (cb) => {
    set((s) => ({ _onClearCbs: [...s._onClearCbs, cb] }));
    return () =>
      set((s) => ({ _onClearCbs: s._onClearCbs.filter((c) => c !== cb) }));
  },
}));

export function selectRol(s: AuthState): RolUsuario | null {
  return s.usuario?.rol ?? null;
}

export function selectEsJefe(s: AuthState): boolean {
  return s.usuario?.rol === 'jefe';
}