import { QueryClient } from '@tanstack/react-query';

/**
 * Singleton compartido entre AppProviders y stores (invalidación fuera de React).
 *
 * Defaults (auditoría 2026-07-17, rendimiento #1): sin `staleTime` global cada
 * query quedaba en staleTime 0 + refetch al enfocar la pestaña → refetch masivo
 * contra Postgres en cada cambio de foco. La frescura tras escrituras la
 * garantizan las invalidaciones explícitas (lib/queryHelpers + hooks) y los
 * eventos realtime; el staleTime solo acota los refetch pasivos.
 * Las vistas que exigen frescura inmediata pueden declarar `staleTime: 0` local.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});
