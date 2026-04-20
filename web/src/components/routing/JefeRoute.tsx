import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuthStore } from '@/store/authStore';

type Props = { children: ReactNode };

export function JefeRoute({ children }: Props) {
  const rol = useAuthStore((s) => s.usuario?.rol);

  if (rol !== 'jefe') {
    return <Navigate to="/hoy" replace />;
  }

  return children;
}
