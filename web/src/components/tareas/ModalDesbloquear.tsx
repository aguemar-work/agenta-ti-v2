import { useState } from 'react';
import { MIN_JUSTIFICACION_CHARS } from '@/lib/constants';
import { markModalCompleted, Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { JustificacionField } from '@/components/ui/JustificacionField';
import type { Tarea } from '@/types';

type Props = {
  tarea:     Tarea | null;
  onClose:   () => void;
  onConfirm: (input: { tareaId: string; nuevaFecha: string; justificacion: string }) => Promise<void>;
};

export function ModalDesbloquear({ tarea, onClose, onConfirm }: Props) {
  const [fecha, setFecha] = useState('');
  const [just, setJust]   = useState('');
  const [busy, setBusy]   = useState(false);

  if (!tarea) return null;

  const justOk    = just.trim().length >= MIN_JUSTIFICACION_CHARS;
  const canSubmit = fecha.length > 0 && justOk && !busy;

  async function submit() {
    if (!canSubmit || !tarea) return;
    setBusy(true);
    try {
      await onConfirm({ tareaId: tarea.id, nuevaFecha: fecha, justificacion: just.trim() });
      markModalCompleted('modal-desbloquear-tarea');
      onClose();
      setFecha('');
      setJust('');
    } finally { setBusy(false); }
  }

  return (
    <Modal
      open={tarea !== null}
      onClose={onClose}
      title="Desbloquear tarea"
      analyticsId="modal-desbloquear-tarea"
      descriptionElementId="modal-desbloquear-desc"
      size="sm"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={!canSubmit}
            onClick={() => void submit()}
          >
            {busy ? 'Guardando…' : 'Desbloquear tarea'}
          </Button>
        </>
      )}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[var(--mc-color-text-secondary)]">{tarea.titulo}</p>
        <p id="modal-desbloquear-desc" className="text-sm text-[var(--mc-color-text-secondary)]">
          Nueva fecha y justificación obligatorias para desbloquear.
        </p>

        <div className="mc-field">
          <label className="mc-field-label" htmlFor="desbloq-fecha">Nueva fecha planificada</label>
          <input
            id="desbloq-fecha"
            type="date"
            className="mc-input"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            autoFocus
          />
        </div>

        <JustificacionField
          value={just}
          onChange={setJust}
          placeholder="Indica el motivo del desbloqueo…"
          disabled={busy}
        />
      </div>
    </Modal>
  );
}