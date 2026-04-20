import { useState } from 'react';

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

  if (!open) return null;

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
    <div className="mc-overlay flex items-center justify-center p-4" role="presentation" onClick={onClose}>
      <div className="mc-modal" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-[var(--mc-color-text)]">{titulo}</h2>
        {descripcion ? <p className="mt-1 text-xs text-[var(--mc-color-text-secondary)]">{descripcion}</p> : null}
        <label className="mt-3 block text-xs font-medium text-[var(--mc-color-text-secondary)]">
          Motivo / justificación (obligatorio, mín. 10 caracteres)
          <textarea
            className="mc-input mt-1 min-h-[96px]"
            value={just}
            onChange={(e) => setJust(e.target.value)}
            required
            minLength={10}
            aria-required
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="mc-btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className="mc-btn" onClick={() => void submit()} disabled={!ok || busy}>
            {busy ? 'Guardando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
