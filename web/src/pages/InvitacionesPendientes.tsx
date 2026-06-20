/**
 * pages/InvitacionesPendientes.tsx
 * B2 — el invitado acepta o rechaza antes de entrar al espacio operativo.
 */

import { Mail } from 'lucide-react';

import { AppLogo } from '@/components/brand/AppLogo';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useInvitacionesPendientesPage } from '@/hooks/useInvitacionesPendientesPage';

type Props = {
  onAceptada: () => void;
};

function rolLabel(rol: string): string {
  return rol === 'jefe' ? 'Jefe' : 'Miembro';
}

export function InvitacionesPendientes({ onAceptada }: Props) {
  const {
    invitaciones, isLoading, isError,
    aceptar, rechazar, estaProcesando, procesando,
  } = useInvitacionesPendientesPage(onAceptada);

  return (
    <div className="mc-auth-page">
      <div className="mc-auth-container">
        <div className="mc-auth-card">
          <header className="mc-auth-card-header">
            <div className="mc-auth-brand">
              <AppLogo height={32} className="max-w-[min(200px,70vw)]" />
            </div>
            <h1 className="mc-auth-title">Invitaciones pendientes</h1>
            <p className="mc-auth-subtitle">
              Acepta una invitación para acceder a tu espacio de trabajo.
            </p>
          </header>

          {isLoading ? (
            <p className="m-0 text-[13px] text-[var(--mc-color-text-secondary)]">
              Cargando invitaciones…
            </p>
          ) : isError ? (
            <p className="m-0 text-[13px] text-[var(--mc-color-danger)]" role="alert">
              No se pudieron cargar tus invitaciones.
            </p>
          ) : invitaciones.length === 0 ? (
            <EmptyState
              icon={Mail}
              title="Sin invitaciones"
              desc="No hay invitaciones pendientes en este momento."
            />
          ) : (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {invitaciones.map((inv) => (
                  <li
                    key={inv.workspace_id}
                    className="flex flex-col gap-3 rounded-[var(--mc-radius-lg)] border border-[var(--mc-color-border)] p-[var(--mc-space-4)]"
                  >
                    <div className="flex flex-col gap-1">
                      <p className="m-0 text-[14px] font-medium text-[var(--mc-color-text-primary)]">
                        {inv.organizacion_nombre}
                      </p>
                      <p className="m-0 text-[12px] text-[var(--mc-color-text-secondary)]">
                        {inv.workspace_nombre} · {rolLabel(inv.rol)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        loading={estaProcesando(inv)}
                        disabled={procesando}
                        onClick={() => aceptar(inv.workspace_id)}
                      >
                        Aceptar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={procesando}
                        onClick={() => rechazar(inv.workspace_id)}
                      >
                        Rechazar
                      </Button>
                    </div>
                  </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
