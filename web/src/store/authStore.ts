import type { UserSchema } from '@insforge/sdk';
import { create } from 'zustand';

import type { RolUsuario, Usuario } from '@/types';

export type AuthState = {
  authUser: UserSchema | null;
  usuario: Usuario | null;
  isLoading: boolean;
  setAuth: (authUser: UserSchema | null, usuario: Usuario | null) => void;
  setLoading: (v: boolean) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  authUser: null,
  usuario: null,
  isLoading: true,
  setAuth: (authUser, usuario) => set({ authUser, usuario, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  clear: () => set({ authUser: null, usuario: null, isLoading: false }),
}));

export function selectRol(s: AuthState): RolUsuario | null {
  return s.usuario?.rol ?? null;
}

export function selectEsJefe(s: AuthState): boolean {
  return s.usuario?.rol === 'jefe';
}
