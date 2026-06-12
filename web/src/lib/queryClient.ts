import { QueryClient } from '@tanstack/react-query';

/** Singleton compartido entre AppProviders y stores (invalidación fuera de React). */
export const queryClient = new QueryClient();
