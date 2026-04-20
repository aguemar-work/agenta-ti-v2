/**
 * Contenedor estándar de cada vista bajo `mc-main` (Outlet).
 * Regla global: ancho único `max-w-[1400px]` + `mc-module`; sin otros `max-w-*` en la raíz de página.
 */
export const APP_PAGE_CLASS =
  'mc-module mx-auto w-full max-w-[1400px] flex flex-col gap-6' as const;
