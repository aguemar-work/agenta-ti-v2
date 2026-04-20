import { useState } from 'react';

import type { Tarea } from '@/types';

type Props = {
  tarea: Tarea | null;
  onClose: () => void;
  onConfirm: (input: { tareaId: string; nuevaFecha: string; justificacion: string }) => Promise<void>;
};

export function ModalReprogramar({ tarea, onClose, onConfirm }: Props) {
  const [fecha, setFecha] = useState('');
  const [just, setJust] = useState('');
  const [busy, setBusy] = useState(false);

  if (!tarea) return null;

  const justOk = just.trim().length >= 10;
  const canSubmit = Boolean(fecha) && justOk && !busy;

  async function submit() {
    if (!tarea || !canSubmit) return;
    setBusy(true);
    try {
      await onConfirm({ tareaId: tarea.id, nuevaFecha: fecha, justificacion: just.trim() });
      onClose();
      setFecha('');
      setJust('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mc-overlay flex items-center justify-center p-4" role="presentation" onClick={onClose}>
      <div className="mc-modal" role="dialog" aria-modal="true" aria-labelledby="repr-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="repr-title" className="text-base font-semibold text-[var(--mc-color-text)]">
          Reprogramar tarea
        </h2>
        <p className="mt-1 text-xs text-[var(--mc-color-text-secondary)]">{tarea.titulo}</p>
        <p className="mt-3 text-xs text-[var(--mc-color-text-secondary)]">
          La justificación es obligatoria (mínimo 10 caracteres).
        </p>
        <label className="mt-3 block text-xs font-medium text-[var(--mc-color-text-secondary)]">
          Nueva fecha
          <input type="date" className="mc-input mt-1" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        </label>
        <label className="mt-3 block text-xs font-medium text-[var(--mc-color-text-secondary)]">
          Justificación
          <textarea
            className="mc-input mt-1 min-h-[96px]"
            value={just}
            onChange={(e) => setJust(e.target.value)}
            placeholder="Describe el motivo de la reprogramación…"
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="mc-btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className="mc-btn" onClick={() => void submit()} disabled={!canSubmit}>
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
