/**
 * store/vistaStore.ts
 * Persiste el miembro seleccionado por el Jefe durante la sesión.
 * Resuelve hallazgo I5: seleccionId se reiniciaba al navegar entre páginas.
 *
 * Se resetea automáticamente al cerrar sesión (llamado desde authStore.clear).
 */

import { create } from 'zustand';

type VistaState = {
  /** ID del miembro cuya vista está viendo el Jefe. null = propio usuario. */
  seleccionId: string | null;
  setSeleccionId: (id: string) => void;
  reset: () => void;
};

export const useVistaStore = create<VistaState>((set) => ({
  seleccionId: null,
  setSeleccionId: (id) => set({ seleccionId: id }),
  reset: () => set({ seleccionId: null }),
}));