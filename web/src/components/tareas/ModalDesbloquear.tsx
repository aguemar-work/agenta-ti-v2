import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
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
    <Modal
      open={tarea !== null}
      onClose={onClose}
      title="Desbloquear tarea"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={!canSubmit}>
            {busy ? 'Guardando...' : 'Desbloquear'}
          </Button>
        </>
      }
    >
      {tarea && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--mc-color-text-secondary)]">{tarea.titulo}</p>
          <div className="mc-field">
            <label className="mc-field-label" htmlFor="desbloq-fecha">Nueva fecha planificada</label>
            <input
              id="desbloq-fecha"
              type="date"
              className="mc-input"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <div className="mc-field">
            <label className="mc-field-label" htmlFor="desbloq-just">Justificación (min. 10 caracteres)</label>
            <textarea
              id="desbloq-just"
              className="mc-input"
              style={{ minHeight: 80, resize: 'vertical' }}
              value={just}
              onChange={(e) => setJust(e.target.value)}
              placeholder="Indica el motivo del desbloqueo..."
            />
          </div>
        </div>
      )}
    </Modal>
  );
}
