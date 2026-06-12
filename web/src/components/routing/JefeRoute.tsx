import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { useWorkspaceStore } from '@/store/workspaceStore';

type Props = { children: ReactNode };

export function JefeRoute({ children }: Props) {
  const esJefe = useWorkspaceStore((s) => s.esJefe());

  if (!esJefe) {
    return <Navigate to="/semana" replace />;
  }

  return children;
}