import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { markModalCompleted, Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { JustificacionField } from '@/components/ui/JustificacionField';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import { fechaLocalYmd } from '@/lib/fecha';
import type { Tarea } from '@/types';

const MIN_RESUMEN = 10;

type Props = {
  open:      boolean;
  tarea:     Tarea | null;
  onClose:   () => void;
  onConfirm: (input: { tareaId: string; resumen: string }) => Promise<void>;
};

export function ModalCompletarTarea({ open, tarea, onClose, onConfirm }: Props) {
  const [resumen, setResumen] = useState('');
  const [busy, setBusy]       = useState(false);

  const hoyYmd = fechaLocalYmd(new Date());
  const esAtrasada = tarea
    ? estadoEfectivoTablero(tarea, hoyYmd) === 'atrasada'
    : false;

  useEffect(() => { setResumen(''); }, [tarea?.id]);

  const canSubmit = resumen.trim().length >= MIN_RESUMEN && !busy;

  async function submit() {
    if (!tarea || !canSubmit) return;
    setBusy(true);
    try {
      await onConfirm({ tareaId: tarea.id, resumen: resumen.trim() });
      markModalCompleted('modal-completar-tarea');
      onClose();
    } finally { setBusy(false); }
  }

  return (
    <Modal
      open={open && tarea !== null}
      onClose={onClose}
      stackLevel={1}
      title="Completar tarea"
      analyticsId="modal-completar-tarea"
      descriptionElementId="modal-completar-desc"
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

          {esAtrasada && (
            <div
              className="flex gap-2 rounded-[var(--mc-radius-md)] border border-[var(--mc-color-warning)] bg-[var(--mc-color-warning-soft)] p-3 text-sm text-[var(--mc-color-text)]"
              role="alert"
            >
              <AlertTriangle size={18} className="shrink-0 text-[var(--mc-color-warning)]" aria-hidden />
              <p>
                Esta tarea está atrasada. ¿Confirmas que fue completada?
                Indica el motivo o resultado en el resumen (obligatorio).
              </p>
            </div>
          )}

          <p id="modal-completar-desc" className="text-sm text-[var(--mc-color-text-secondary)]">
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
