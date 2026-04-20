import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';

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
    </QueryClientProvider>
  );
}
