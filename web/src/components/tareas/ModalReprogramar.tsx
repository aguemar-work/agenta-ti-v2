/**
 * components/tareas/ModalReprogramar.tsx
 * Migrado a <Modal> — Sprint 4.
 */

import { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { Tarea } from '@/types';

const MIN_JUST = 10;

type Props = {
  tarea: Tarea | null;
  fechaFija?: string;
  onClose: () => void;
  onConfirm: (input: {
    tareaId: string;
    nuevaFecha: string;
    justificacion: string;
  }) => Promise<void>;
};

const HINT_ID = 'modal-reprogramar-hint';
const ERR_ID = 'modal-reprogramar-just-error';

export function ModalReprogramar({ tarea, fechaFija, onClose, onConfirm }: Props) {
  const [fecha, setFecha] = useState('');
  const [just, setJust] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFecha('');
    setJust('');
  }, [tarea?.id]);

  const justLen = just.trim().length;
  const justOk = justLen >= MIN_JUST;
  const fechaOk = Boolean(fechaFija ?? fecha);
  const canSubmit = fechaOk && justOk && !busy;

  async function submit() {
    if (!tarea || !canSubmit) return;
    setBusy(true);
    try {
      await onConfirm({
        tareaId: tarea.id,
        nuevaFecha: fechaFija ?? fecha,
        justificacion: just.trim(),
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const describedBy = [HINT_ID, justLen > 0 && !justOk ? ERR_ID : null].filter(Boolean).join(' ') || undefined;

  return (
    <Modal
      open={tarea !== null}
      onClose={onClose}
      title="Reprogramar tarea"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={!canSubmit}>
            {busy ? 'Guardando…' : 'Guardar'}
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
            La justificación es obligatoria (mínimo {MIN_JUST} caracteres).
          </p>

          <div className="mc-field">
            <label className="mc-field-label" htmlFor="repr-fecha">Nueva fecha</label>
            {fechaFija ? (
              <input id="repr-fecha" type="date" className="mc-input" readOnly value={fechaFija} aria-readonly="true" />
            ) : (
              <input
                id="repr-fecha"
                type="date"
                className="mc-input"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
                autoFocus
              />
            )}
          </div>

          <div className="mc-field">
            <label className="mc-field-label" htmlFor="repr-just">
              <span className="flex justify-between">
                <span>Justificación</span>
                <span
                  aria-live="polite"
                  className={`mc-char-count ${justOk ? 'mc-char-count-ok' : ''}`}
                >
                  {justLen}/{MIN_JUST}
                </span>
              </span>
            </label>
            <textarea
              id="repr-just"
              className="mc-input"
              style={{ minHeight: 96, resize: 'vertical' }}
              value={just}
              onChange={(e) => setJust(e.target.value)}
              placeholder="Describe el motivo de la reprogramación…"
              autoFocus={Boolean(fechaFija)}
              aria-describedby={describedBy}
              aria-invalid={justLen > 0 && !justOk}
            />
          </div>
          {justLen > 0 && !justOk && (
            <p id={ERR_ID} role="alert" className="text-xs text-[var(--mc-color-danger)]">
              Mínimo {MIN_JUST} caracteres (llevas {justLen}/{MIN_JUST}).
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
