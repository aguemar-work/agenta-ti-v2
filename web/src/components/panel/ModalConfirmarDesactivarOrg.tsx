import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

import { Button, CancelButton } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useDesactivarOrg } from '@/hooks/useOrgsDesactivadas';
import type { Organizacion } from '@/store/workspaceStore';

type Props = {
  open: boolean;
  onClose: () => void;
  org: Organizacion | null;
};

function fechaPurga(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function ModalConfirmarDesactivarOrg({ open, onClose, org }: Props) {
  const { mutate, isPending, reset } = useDesactivarOrg();

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  function confirmar() {
    if (!org) return;
    mutate(org.id, { onSuccess: () => onClose() });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Mover a papelera"
      analyticsId="modal-desactivar-org"
      size="md"
      bodyClassName="mc-modal-form"
      footerClassName="mc-modal-footer--stack"
      description={org ? `Desactivar "${org.nombre}"` : ''}
      footer={(
        <>
          <Button
            variant="danger"
            size="lg"
            fullWidth
            loading={isPending}
            disabled={!org || isPending}
            onClick={confirmar}
          >
            Mover a papelera
          </Button>
          <CancelButton onClick={onClose} disabled={isPending} />
        </>
      )}
    >
      {org ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-lg bg-[var(--mc-color-warning-subtle,#fef9ec)] p-3">
            <AlertTriangle
              size={18}
              className="mt-0.5 shrink-0 text-[var(--mc-color-warning,#d97706)]"
              aria-hidden
            />
            <p className="m-0 text-[13px] leading-relaxed text-[var(--mc-color-text-primary)]">
              <strong>{org.nombre}</strong> quedará inaccesible para sus miembros de inmediato.
              Si no la reactivas antes del <strong>{fechaPurga()}</strong>, se eliminará
              permanentemente junto con todos sus datos.
            </p>
          </div>
          <p className="m-0 text-[13px] text-[var(--mc-color-text-secondary)]">
            Puedes reactivarla desde la sección <em>Papelera</em> de este panel antes de esa fecha.
          </p>
        </div>
      ) : null}
    </Modal>
  );
}
