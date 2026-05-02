/**
 * components/tareas/ModalBloquear.tsx
 * Migrado a <Modal> — Sprint 4 hallazgo 2.2.
 * Patrón de referencia para migrar los demás modales.
 */

import { useEffect, useState } from 'react';
import { MIN_JUSTIFICACION_CHARS } from '@/lib/constants';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { Tarea } from '@/types';

type Props = {
  tarea: Tarea | null;
  onClose: () => void;
  onConfirm: (input: { tareaId: string; justificacion: string }) => Promise<void>;
};


export function ModalBloquear({ tarea, onClose, onConfirm }: Props) {
  const [just, setJust] = useState('');
  const [busy, setBusy] = useState(false);

  const len = just.trim().length;
  const justOk = len >= MIN_JUSTIFICACION_CHARS;
  const canSubmit = justOk && !busy;

  useEffect(() => {
    setJust('');
  }, [tarea?.id]);

  async function submit() {
    if (!tarea || !canSubmit) return;
    setBusy(true);
    try {
      await onConfirm({ tareaId: tarea.id, justificacion: just.trim() });
      onClose();
      setJust('');
    } finally {
      setBusy(false);
    }
  }

  const hintId = 'modal-bloquear-just-hint';

  return (
    <Modal
      open={tarea !== null}
      onClose={onClose}
      title="Bloquear tarea"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={!canSubmit}>
            {busy ? 'Guardando…' : 'Bloquear'}
          </Button>
        </>
      }
    >
      {tarea && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--mc-color-text-secondary)]">
            {tarea.titulo}
          </p>
          <p id={hintId} className="text-sm text-[var(--mc-color-text-secondary)]">
            Indica el motivo del bloqueo (mínimo {MIN_JUSTIFICACION_CHARS} caracteres). El jefe podrá revisarlo y desbloquearla.
          </p>
          <div className="mc-field">
            <label className="mc-field-label" htmlFor="bloq-just">
              <span className="flex justify-between">
                <span>Justificación</span>
                <span
                  aria-live="polite"
                  className={`mc-char-count ${justOk ? 'mc-char-count-ok' : ''}`}
                >
                  {len}/{MIN_JUSTIFICACION_CHARS}
                </span>
              </span>
            </label>
            <textarea
              id="bloq-just"
              className="mc-input"
              style={{ minHeight: 96, resize: 'vertical' }}
              value={just}
              onChange={(e) => setJust(e.target.value)}
              placeholder="Describe por qué está bloqueada esta tarea…"
              aria-describedby={hintId}
              aria-invalid={len > 0 && !justOk}
              autoFocus
            />
          </div>
          {len > 0 && !justOk && (
            <p role="status" className="text-xs text-[var(--mc-color-danger)]">
              Mínimo {MIN_JUSTIFICACION_CHARS} caracteres (llevas {len}/{MIN_JUSTIFICACION_CHARS})
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}