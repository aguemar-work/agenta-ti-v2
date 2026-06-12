import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useWorkspaceStore } from '@/store/workspaceStore';

function esRutaPanel(pathname: string): boolean {
  return pathname === '/panel' || pathname.startsWith('/panel/');
}

/** Redirect raíz y rutas desconocidas según modoContexto. */
export function DefaultHomeRedirect() {
  const modoContexto = useWorkspaceStore((s) => s.modoContexto);
  const to = modoContexto === 'panel' ? '/panel' : '/semana';
  return <Navigate to={to} replace />;
}

/**
 * En modo panel, solo rutas bajo /panel son accesibles; el resto redirige al panel.
 * Envuelve el Outlet de AppShell.
 */
export function ModoContextoOutlet() {
  const modoContexto = useWorkspaceStore((s) => s.modoContexto);
  const { pathname } = useLocation();

  if (modoContexto === 'panel' && !esRutaPanel(pathname)) {
    return <Navigate to="/panel" replace />;
  }

  return <Outlet />;
}

/** Rutas operativas: bloquea acceso si el contexto activo es panel. */
export function OperativoRouteGuard({ children }: { children: ReactNode }) {
  const modoContexto = useWorkspaceStore((s) => s.modoContexto);

  if (modoContexto === 'panel') {
    return <Navigate to="/panel" replace />;
  }

  return children;
}
