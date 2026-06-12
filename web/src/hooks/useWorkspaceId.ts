/**
 * hooks/useWorkspaceId.ts
 * Devuelve el workspaceId activo. Úsalo en queryKey para aislar caché por workspace.
 * Retorna null si no hay workspace activo (login, onboarding).
 */

import { useWorkspaceStore } from '@/store/workspaceStore';

export function useWorkspaceId(): string | null {
  return useWorkspaceStore((s) => s.workspaceActivo?.id ?? null);
}
