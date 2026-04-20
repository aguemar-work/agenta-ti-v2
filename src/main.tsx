import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from '@/App.tsx';
import { getInsforgeEnv } from '@/lib/insforge';
import { installInsforgeFetchInterceptor } from '@/lib/insforgeFetchInterceptor';
import { AppProviders } from '@/providers/AppProviders';
import '@/index.css';

if (getInsforgeEnv()) {
  installInsforgeFetchInterceptor();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
