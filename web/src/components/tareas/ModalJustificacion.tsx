import { useState } from 'react';
import { MIN_JUSTIFICACION_CHARS } from '@/lib/constants';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { JustificacionField } from '@/components/ui/JustificacionField';

type Props = {
  open:         boolean;
  titulo:       string;
  descripcion?: string;
  /** Si true, el botón de confirmar usa variant="danger" (para acciones destructivas) */
  destructive?: boolean;
  labelConfirm?: string;
  onClose:      () => void;
  onConfirm:    (justificacion: string) => Promise<void>;
};

export function ModalJustificacion({
  open, titulo, descripcion,
  destructive = false,
  labelConfirm = 'Confirmar',
  onClose, onConfirm,
}: Props) {
  const [just, setJust] = useState('');
  const [busy, setBusy] = useState(false);

  const ok = just.trim().length >= MIN_JUSTIFICACION_CHARS;

  async function submit() {
    if (!ok) return;
    setBusy(true);
    try {
      await onConfirm(just.trim());
      setJust('');
      onClose();
    } finally { setBusy(false); }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={titulo}
      size="sm"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            disabled={!ok || busy}
            onClick={() => void submit()}
          >
            {busy ? 'Guardando…' : labelConfirm}
          </Button>
        </>
      )}
    >
      <div className="flex flex-col gap-4">
        {descripcion && (
          <p className="text-sm text-[var(--mc-color-text-secondary)]">{descripcion}</p>
        )}

        <JustificacionField
          label="Motivo / justificación"
          value={just}
          onChange={setJust}
          disabled={busy}
          autoFocus
        />
      </div>
    </Modal>
  );
}