import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { Button } from '@/components/ui/Button';
import { useEsPlataformaOwner } from '@/hooks/useEsPlataformaOwner';

type Props = { children: ReactNode };

function PanelRouteLoading() {
  return <div className="mc-page-loading">Cargando…</div>;
}

function PanelRouteError({ onReintentar, cargando }: { onReintentar: () => void; cargando: boolean }) {
  return (
    <div className="mc-auth-page">
      <div className="mc-auth-container">
        <div className="mc-auth-card">
          <header className="mc-auth-card-header">
            <p className="mc-auth-subtitle">No se pudo verificar el acceso al panel.</p>
          </header>
          <Button type="button" variant="primary" fullWidth loading={cargando} onClick={onReintentar}>
            Reintentar
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * /panel solo accesible para dueños de plataforma.
 *
 * Distingue tres casos:
 *   isLoading            → spinner (query en vuelo)
 *   isError sin caché    → pantalla de error + reintentar (evita bucle con ModoContextoOutlet)
 *   isError con caché    → sirve el panel (placeholderData preserva la confirmación previa)
 *   esOwner !== true     → redirect a /semana (no-dueño confirmado)
 */
export function PanelRoute({ children }: Props) {
  const { data: esOwner, isLoading, isError, isFetching, refetch } = useEsPlataformaOwner();

  if (isLoading) return <PanelRouteLoading />;

  // Error sin datos previos confirmados: mostrar pantalla de error en lugar de redirigir.
  // Si hay datos de placeholder (refetch fallido con caché previa de true), se sirve el panel.
  if (isError && esOwner !== true) {
    return <PanelRouteError cargando={isFetching} onReintentar={() => void refetch()} />;
  }

  // No-dueño confirmado explícitamente por la BD → redirigir fuera del panel.
  if (esOwner !== true) return <Navigate to="/semana" replace />;

  return children;
}
