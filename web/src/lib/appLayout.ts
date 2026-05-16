/**
 * Contenedor estándar de cada vista bajo `mc-main` (Outlet).
 * Ocupa todo el ancho disponible (`w-full`); sin `max-w-*` en la raíz de página.
 */
/** Sin `flex-1`: el contenido define la altura y `mc-main` hace scroll (evita recortes). */
export const APP_PAGE_CLASS =
  'mc-module flex w-full min-h-0 shrink-0 flex-col gap-6' as const;

/**
 * Altura máxima de la lista de tareas por día en Mi Semana.
 * Definida en `tokens.css` (--mc-semana-dia-col-max-height): viewport menos shell, padding de
 * `mc-main` y chrome de página (header, filtros, resumen).
 */
export const CSS_VAR_SEMANA_DIA_COL_MAX_HEIGHT = '--mc-semana-dia-col-max-height' as const;

export const SEMANA_DIA_COL_MAX_HEIGHT = `var(${CSS_VAR_SEMANA_DIA_COL_MAX_HEIGHT})` as const;
