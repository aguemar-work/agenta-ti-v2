import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { JustificacionField } from '@/components/ui/JustificacionField';
import type { Tarea } from '@/types';

const MIN_RESUMEN = 10;
const ERR_ID      = 'modal-completar-resumen-error';

type Props = {
  open:      boolean;
  tarea:     Tarea | null;
  onClose:   () => void;
  onConfirm: (input: { tareaId: string; resumen: string }) => Promise<void>;
};

export function ModalCompletarTarea({ open, tarea, onClose, onConfirm }: Props) {
  const [resumen, setResumen] = useState('');
  const [busy, setBusy]       = useState(false);

  useEffect(() => { setResumen(''); }, [tarea?.id]);

  const canSubmit = resumen.trim().length >= MIN_RESUMEN && !busy;

  async function submit() {
    if (!tarea || !canSubmit) return;
    setBusy(true);
    try {
      await onConfirm({ tareaId: tarea.id, resumen: resumen.trim() });
      onClose();
    } finally { setBusy(false); }
  }

  return (
    <Modal
      open={open && tarea !== null}
      onClose={onClose}
      title="Completar tarea"
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
            {busy ? 'Guardando…' : 'Marcar como completada'}
          </Button>
        </>
      ) : null}
    >
      {tarea && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--mc-color-text-secondary)]">{tarea.titulo}</p>
          <p className="text-sm text-[var(--mc-color-text-secondary)]">
            Indica un resumen de lo realizado (mínimo {MIN_RESUMEN} caracteres).
          </p>

          <JustificacionField
            label="Resumen de lo realizado"
            placeholder="Describe lo entregado o el resultado obtenido…"
            value={resumen}
            onChange={setResumen}
            minChars={MIN_RESUMEN}
            disabled={busy}
            autoFocus
          />
        </div>
      )}
    </Modal>
  );
}