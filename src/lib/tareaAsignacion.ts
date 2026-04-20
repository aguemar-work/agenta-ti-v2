/** Si no hay responsable explícito, el creador actúa como asignado. */
export function resolveAsignadoA(asignado: string | null | undefined, usuarioActualId: string): string {
  const v = typeof asignado === 'string' ? asignado.trim() : '';
  return v.length > 0 ? v : usuarioActualId;
}
