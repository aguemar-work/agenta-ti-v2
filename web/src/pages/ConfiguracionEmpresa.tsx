import { useMemo, useState } from 'react';
import { Settings } from 'lucide-react';

import { ModalGestionarModulos } from '@/components/panel/ModalGestionarModulos';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { useWorkspaceStore } from '@/store/workspaceStore';

export function ConfiguracionEmpresa() {
  const [modalOpen, setModalOpen] = useState(false);
  const orgActiva = useWorkspaceStore((s) => s.orgActiva);
  const rolActivo = useWorkspaceStore((s) => s.rolActivo);

  const puedeGestionar = rolActivo === 'jefe' && Boolean(orgActiva);
  const subtitulo = useMemo(
    () => (orgActiva ? `${orgActiva.nombre}` : 'Sin organización activa'),
    [orgActiva],
  );

  return (
    <div className={APP_PAGE_CLASS}>
      <PageHeader
        title="Configuración de la empresa"
        subtitle={subtitulo}
        detail="Gestiona los módulos habilitados para tu empresa. Desactivar no elimina datos."
        actions={(
          <Button
            variant="primary"
            size="sm"
            disabled={!puedeGestionar}
            onClick={() => setModalOpen(true)}
          >
            Gestionar módulos
          </Button>
        )}
      />

      {!orgActiva ? (
        <EmptyState
          icon={Settings}
          title="Sin organización activa"
          desc="Selecciona una organización para gestionar sus módulos."
        />
      ) : (
        <div className="mc-card">
          <p className="m-0 text-sm text-[var(--mc-color-text-secondary)]">
            Activa o desactiva módulos opcionales para {orgActiva.nombre}. El módulo de bitácora
            es obligatorio y permanece siempre activo.
          </p>
        </div>
      )}

      <ModalGestionarModulos
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        org={orgActiva}
      />
    </div>
  );
}

