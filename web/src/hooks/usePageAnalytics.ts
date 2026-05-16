import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { trackPageView } from '@/lib/analytics';

/** Registra page_view en cada cambio de ruta (módulos activos de la SPA). */
export function usePageAnalytics() {
  const { pathname } = useLocation();

  useEffect(() => {
    trackPageView(pathname);
  }, [pathname]);
}
