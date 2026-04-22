import { useState } from 'react';

import type { Tarea } from '@/types';

type Props = {
  tarea: Tarea | null;
  onClose: () => void;
  onConfirm: (input: { tareaId: string; nuevaFecha: string; justificacion: string }) => Promise<void>;
};

export function ModalDesbloquear({ tarea, onClose, onConfirm }: Props) {
  const [fecha, setFecha] = useState('');
  const [just, setJust] = useState('');
  const [busy, setBusy] = useState(false);

  if (!tarea) return null;

  const canSubmit = fecha.length > 0 && just.trim().length >= 10 && !busy;

  async function submit() {
    if (!canSubmit || !tarea) return;
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
      <div className="mc-modal" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-[var(--mc-color-text)]">Desbloquear tarea</h2>
        <p className="mt-1 text-xs text-[var(--mc-color-text-secondary)]">{tarea.titulo}</p>
        <label className="mt-3 block text-xs font-medium text-[var(--mc-color-text-secondary)]">
          Nueva fecha planificada
          <input type="date" className="mc-input mt-1" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </label>
        <label className="mt-3 block text-xs font-medium text-[var(--mc-color-text-secondary)]">
          Justificacion (min. 10 caracteres)
          <textarea
            className="mc-input mt-1 min-h-[80px]"
            value={just}
            onChange={(e) => setJust(e.target.value)}
            placeholder="Indica el motivo del desbloqueo..."
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="mc-btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className="mc-btn" onClick={() => void submit()} disabled={!canSubmit}>
            {busy ? 'Guardando...' : 'Desbloquear'}
          </button>
        </div>
      </div>
    </div>
  );
}
