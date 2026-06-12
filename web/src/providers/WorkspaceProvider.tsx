/**
 * providers/WorkspaceProvider.tsx
 * Gate post-login: bootstrap de workspace antes de AppShell.
 * Solo renderiza children cuando workspaceStore.inicializado === true.
 */

import type { ReactNode } from 'react';

import { Button } from '@/components/ui/Button';
import { useWorkspaceBootstrap } from '@/hooks/useWorkspaceBootstrap';
import { WorkspaceSelector } from '@/pages/WorkspaceSelector';
import { useWorkspaceStore } from '@/store/workspaceStore';

type Props = { children: ReactNode };

function WorkspaceLoadingSpinner() {
  return <div className="mc-page-loading">Preparando tu espacio…</div>;
}

function WorkspaceBootstrapError({
  mensaje,
  onReintentar,
}: {
  mensaje: string;
  onReintentar: () => void;
}) {
  return (
    <div className="mc-auth-page">
      <div className="mc-auth-container">
        <div className="mc-auth-card">
          <header className="mc-auth-card-header">
            <h1 className="mc-auth-title">No se pudo cargar tu espacio</h1>
            <p className="mc-auth-subtitle">{mensaje}</p>
          </header>
          <Button type="button" variant="primary" fullWidth onClick={onReintentar}>
            Reintentar
          </Button>
        </div>
      </div>
    </div>
  );
}

export function WorkspaceProvider({ children }: Props) {
  const inicializado = useWorkspaceStore((s) => s.inicializado);
  const { necesitaSelector, error, reintentar } = useWorkspaceBootstrap();

  if (inicializado) return children;
  if (necesitaSelector) return <WorkspaceSelector />;
  if (error) return <WorkspaceBootstrapError mensaje={error} onReintentar={reintentar} />;
  return <WorkspaceLoadingSpinner />;
}
