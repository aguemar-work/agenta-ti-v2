/**
 * pages/WorkspaceSelector.tsx
 * Pantalla de selección de organización y workspace (solo cuando hay >1 opción).
 */

import { ArrowRight } from 'lucide-react';

import { AppLogo } from '@/components/brand/AppLogo';
import { Button } from '@/components/ui/Button';
import { useWorkspaceSelectorPage } from '@/hooks/useWorkspaceSelectorPage';
import type { Organizacion } from '@/store/workspaceStore';

export function WorkspaceSelector() {
  const {
    orgs, orgUnica, orgId, setOrgId,
    workspaceId, setWorkspaceId, workspaces, cargandoWs, confirmando,
    puedeConfirmar, confirmar,
  } = useWorkspaceSelectorPage();

  return (
    <div className="mc-auth-page">
      <div className="mc-auth-container">
        <div className="mc-auth-card">
          <header className="mc-auth-card-header">
            <div className="mc-auth-brand">
              <AppLogo height={32} className="max-w-[min(200px,70vw)]" />
            </div>
            <h1 className="mc-auth-title">Selecciona tu espacio</h1>
            <p className="mc-auth-subtitle">
              Elige la organización y el espacio de trabajo con el que operarás.
            </p>
          </header>

          <div className="mc-auth-form">
            {!orgUnica && (
              <div className="mc-field">
                <label className="mc-field-label" htmlFor="ws-org">
                  Organización
                </label>
                <select
                  id="ws-org"
                  className="mc-input"
                  value={orgId}
                  onChange={(e) => setOrgId(e.target.value)}
                >
                  {orgs.map((org: Organizacion) => (
                    <option key={org.id} value={org.id}>
                      {org.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="mc-field">
              <label className="mc-field-label" htmlFor="ws-space">
                Espacio de trabajo
              </label>
              <select
                id="ws-space"
                className="mc-input"
                value={workspaceId}
                disabled={cargandoWs || workspaces.length === 0}
                onChange={(e) => setWorkspaceId(e.target.value)}
              >
                {workspaces.length === 0 ? (
                  <option value="">
                    {cargandoWs ? 'Cargando…' : 'Sin espacios disponibles'}
                  </option>
                ) : (
                  workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.nombre}
                    </option>
                  ))
                )}
              </select>
            </div>

            <Button
              type="button"
              variant="primary"
              fullWidth
              loading={confirmando}
              disabled={!puedeConfirmar || confirmando}
              onClick={() => void confirmar()}
            >
              Entrar
              <ArrowRight size={16} aria-hidden className="ml-1 inline" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
