import { useState } from 'react';

import type { Tarea } from '@/types';

type Props = {
  open: boolean;
  tarea: Tarea | null;
  onClose: () => void;
  onConfirm: (input: { tareaId: string; resumen: string }) => Promise<void>;
};

export function ModalCompletarTarea({ open, tarea, onClose, onConfirm }: Props) {
  const [resumen, setResumen] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open || !tarea) return null;

  const tareaAct = tarea;
  const ok = resumen.trim().length >= 10;

  async function submit() {
    if (!ok) return;
    setBusy(true);
    try {
      await onConfirm({ tareaId: tareaAct.id, resumen: resumen.trim() });
      setResumen('');
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mc-overlay flex items-center justify-center p-4" role="presentation" onClick={onClose}>
      <div className="mc-modal" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-[var(--mc-color-text)]">Completar tarea</h2>
        <p className="mt-1 text-xs text-[var(--mc-color-text-secondary)]">{tareaAct.titulo}</p>
        <p className="mt-3 text-xs text-[var(--mc-color-text-secondary)]">
          Indica un resumen de lo realizado. Es obligatorio para cerrar la tarea (mínimo 10 caracteres).
        </p>
        <label className="mt-3 block text-xs font-medium text-[var(--mc-color-text-secondary)]">
          Resumen de lo realizado
          <textarea
            className="mc-input mt-1 min-h-[100px]"
            value={resumen}
            onChange={(e) => setResumen(e.target.value)}
            required
            minLength={10}
            placeholder="Describe lo entregado o el resultado obtenido…"
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="mc-btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className="mc-btn" onClick={() => void submit()} disabled={!ok || busy}>
            {busy ? 'Guardando…' : 'Completar'}
          </button>
        </div>
      </div>
    </div>
  );
}
