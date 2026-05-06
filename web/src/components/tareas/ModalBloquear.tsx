import { useEffect, useState } from 'react';
import { MIN_JUSTIFICACION_CHARS } from '@/lib/constants';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { JustificacionField } from '@/components/ui/JustificacionField';
import type { Tarea } from '@/types';

type Props = {
  tarea:     Tarea | null;
  onClose:   () => void;
  onConfirm: (input: { tareaId: string; justificacion: string }) => Promise<void>;
};

export function ModalBloquear({ tarea, onClose, onConfirm }: Props) {
  const [just, setJust] = useState('');
  const [busy, setBusy] = useState(false);

  const canSubmit = just.trim().length >= MIN_JUSTIFICACION_CHARS && !busy;

  useEffect(() => { setJust(''); }, [tarea?.id]);

  async function submit() {
    if (!tarea || !canSubmit) return;
    setBusy(true);
    try {
      await onConfirm({ tareaId: tarea.id, justificacion: just.trim() });
      onClose();
      setJust('');
    } finally { setBusy(false); }
  }

  return (
    <Modal
      open={tarea !== null}
      onClose={onClose}
      title="Bloquear tarea"
      size="sm"
      footer={tarea ? (
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={!canSubmit}
            onClick={() => void submit()}
          >
            {busy ? 'Guardando…' : 'Bloquear tarea'}
          </Button>
        </>
      ) : null}
    >
      {tarea && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--mc-color-text-secondary)]">{tarea.titulo}</p>
          <p className="text-sm text-[var(--mc-color-text-secondary)]">
            Indica el motivo. El jefe podrá revisarlo y desbloquearla.
          </p>

          <JustificacionField
            value={just}
            onChange={setJust}
            disabled={busy}
            autoFocus
            placeholder="Describe por qué está bloqueada esta tarea…"
          />
        </div>
      )}
    </Modal>
  );
}