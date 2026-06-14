/**
 * Lanza un error con contexto desde respuestas de InsForge/Supabase.
 *
 * Uso:
 *   const { data, error } = await insforge.database.from(...).select(...)
 *   throwIfApiError(error, 'getTareasSemana')
 */
export function throwIfApiError(error: unknown, context: string): void {
  if (!error) return;
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(`[${context}] ${message}`);
}
