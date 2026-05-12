/**
 * Contenedor estándar de cada vista bajo `mc-main` (Outlet).
 * Ocupa todo el ancho disponible (`w-full`); sin `max-w-*` en la raíz de página.
 */
/** Sin `flex-1`: el contenido define la altura y `mc-main` hace scroll (evita recortes). */
export const APP_PAGE_CLASS =
  'mc-module flex w-full min-h-0 shrink-0 flex-col gap-6' as const;
