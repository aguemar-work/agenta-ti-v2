/**
 * Utilidades para query keys con scope de workspace (V5).
 * workspaceId siempre va como segundo segmento, después del root.
 */

/** Inserta workspaceId como segundo segmento (después del root). */
export function qkWsId(workspaceId: string | null, root: string, ...rest: unknown[]): unknown[] {
  if (workspaceId) return [root, workspaceId, ...rest];
  return [root, ...rest];
}
