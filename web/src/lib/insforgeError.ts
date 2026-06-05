/** Mensaje legible desde errores del SDK / PostgREST (evita "Something went wrong" genérico). */
export function mensajeErrorInsforge(err: unknown, fallback: string): string {
  if (!err || typeof err !== 'object') return fallback;
  const e = err as { message?: string; details?: string; hint?: string };
  const detail = e.details?.trim();
  if (detail && !/^something went wrong$/i.test(detail)) return detail;
  const hint = e.hint?.trim();
  if (hint) return hint;
  const msg = e.message?.trim();
  if (msg && !/^something went wrong$/i.test(msg)) return msg;
  return fallback;
}
