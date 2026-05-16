import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';

import { LiveRegion } from '@/components/a11y/LiveRegion';
import { InsforgeConfigMissing } from '@/components/config/InsforgeConfigMissing';
import { getInsforgeEnv } from '@/lib/insforge';
import { AuthProvider } from '@/providers/AuthProvider';

type Props = { children: ReactNode };

export function AppProviders({ children }: Props) {
  const [queryClient] = useState(() => new QueryClient());

  if (!getInsforgeEnv()) {
    return <InsforgeConfigMissing />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>{children}</AuthProvider>
      </BrowserRouter>
      <Toaster richColors position="top-center" />
      <LiveRegion />
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}