/**
 * components/tareas/ModalCompletarTarea.tsx
 * Migrado a <Modal> — Sprint 4.
 */

import { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { Tarea } from '@/types';

const MIN_RESUMEN = 10;

const HINT_ID = 'modal-completar-hint';
const ERR_ID = 'modal-completar-resumen-error';

type Props = {
  open: boolean;
  tarea: Tarea | null;
  onClose: () => void;
  onConfirm: (input: { tareaId: string; resumen: string }) => Promise<void>;
};

export function ModalCompletarTarea({ open, tarea, onClose, onConfirm }: Props) {
  const [resumen, setResumen] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setResumen('');
  }, [tarea?.id]);

  const resumenLen = resumen.trim().length;
  const ok = resumenLen >= MIN_RESUMEN;
  const canSubmit = ok && !busy;

  async function submit() {
    if (!tarea || !canSubmit) return;
    setBusy(true);
    try {
      await onConfirm({ tareaId: tarea.id, resumen: resumen.trim() });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const describedBy = [HINT_ID, resumenLen > 0 && !ok ? ERR_ID : null].filter(Boolean).join(' ') || undefined;

  return (
    <Modal
      open={open && tarea !== null}
      onClose={onClose}
      title="Completar tarea"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={!canSubmit}>
            {busy ? 'Guardando…' : 'Completar'}
          </Button>
        </>
      }
    >
      {tarea && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--mc-color-text-secondary)]">
            {tarea.titulo}
          </p>
          <p id={HINT_ID} className="text-sm text-[var(--mc-color-text-secondary)]">
            Indica un resumen de lo realizado. Es obligatorio para cerrar la tarea (mínimo {MIN_RESUMEN} caracteres).
          </p>

          <div className="mc-field">
            <label className="mc-field-label" htmlFor="comp-resumen">
              <span className="flex justify-between">
                <span>Resumen de lo realizado</span>
                <span
                  aria-live="polite"
                  className={`mc-char-count ${ok ? 'mc-char-count-ok' : ''}`}
                >
                  {resumenLen}/{MIN_RESUMEN}
                </span>
              </span>
            </label>
            <textarea
              id="comp-resumen"
              className="mc-input"
              style={{ minHeight: 100, resize: 'vertical' }}
              value={resumen}
              onChange={(e) => setResumen(e.target.value)}
              placeholder="Describe lo entregado o el resultado obtenido…"
              autoFocus
              required
              minLength={MIN_RESUMEN}
              aria-describedby={describedBy}
              aria-invalid={resumenLen > 0 && !ok}
            />
          </div>
          {resumenLen > 0 && !ok && (
            <p id={ERR_ID} role="alert" className="text-xs text-[var(--mc-color-danger)]">
              Mínimo {MIN_RESUMEN} caracteres (llevas {resumenLen}/{MIN_RESUMEN}).
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
