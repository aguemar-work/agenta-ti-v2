import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuthStore } from '@/store/authStore';

type Props = { children: ReactNode };

export function ProtectedRoute({ children }: Props) {
  const location = useLocation();
  const authUser = useAuthStore((s) => s.authUser);
  const usuario = useAuthStore((s) => s.usuario);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center text-[var(--mc-color-text-secondary)]">
        Cargando sesión…
      </div>
    );
  }

  if (!authUser || !usuario) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
