import { useMediaQuery } from '@/hooks/useMediaQuery';

/**
 * Breakpoint móvil alineado con Tailwind `md:` (768px).
 * Móvil = viewport &lt; 768px; desktop = `min-width: 768px`.
 */
export const MOBILE_MAX_WIDTH_PX = 767;
export const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_MAX_WIDTH_PX}px)`;

export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_MEDIA_QUERY);
}
