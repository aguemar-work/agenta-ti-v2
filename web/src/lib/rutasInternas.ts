/** Rutas internas permitidas tras login (evita open redirect same-origin). */
const RUTAS_POST_LOGIN = [
  '/semana',
  '/objetivos',
  '/ordenes-trabajo',
  '/planificacion',
  '/metricas',
] as const;

/** Normaliza `location.state.from` a una ruta SPA segura. */
export function destinoPostLogin(from: string | undefined): string {
  if (!from) return '/semana';
  if (from === '/login' || from === '/hoy') return '/semana';
  if ((RUTAS_POST_LOGIN as readonly string[]).includes(from)) return from;
  if (from.startsWith('/') && !from.startsWith('//') && !from.includes('://')) {
    const base = from.split('?')[0]?.split('#')[0] ?? from;
    if ((RUTAS_POST_LOGIN as readonly string[]).includes(base)) return from;
  }
  return '/semana';
}
