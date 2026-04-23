import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

type Props = {
  open: boolean;
  titulo: string;
  descripcion?: string;
  onClose: () => void;
  onConfirm: (justificacion: string) => Promise<void>;
};

export function ModalJustificacion({ open, titulo, descripcion, onClose, onConfirm }: Props) {
  const [just, setJust] = useState('');
  const [busy, setBusy] = useState(false);

  const ok = just.trim().length >= 10;

  async function submit() {
    if (!ok) return;
    setBusy(true);
    try {
      await onConfirm(just.trim());
      setJust('');
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={titulo}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={!ok || busy}>
            {busy ? 'Guardando…' : 'Confirmar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {descripcion && <p className="text-sm text-[var(--mc-color-text-secondary)]">{descripcion}</p>}
        <div className="mc-field">
          <label className="mc-field-label" htmlFor="just-input">
            Motivo / justificación (obligatorio, mín. 10 caracteres)
          </label>
          <textarea
            id="just-input"
            className="mc-input"
            style={{ minHeight: 96, resize: 'vertical' }}
            value={just}
            onChange={(e) => setJust(e.target.value)}
            required
            minLength={10}
            autoFocus
          />
        </div>
      </div>
    </Modal>
  );
}
