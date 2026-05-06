import { useEffect, useState } from 'react';
import { MIN_JUSTIFICACION_CHARS } from '@/lib/constants';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { JustificacionField } from '@/components/ui/JustificacionField';
import { fechaLocalYmd } from '@/lib/fecha';
import type { Tarea } from '@/types';

type Props = {
  tarea:      Tarea | null;
  fechaFija?: string;
  onClose:    () => void;
  onConfirm:  (input: { tareaId: string; nuevaFecha: string; justificacion: string }) => Promise<void>;
};

function esDomingo(ymd: string): boolean {
  if (!ymd) return false;
  // new Date('YYYY-MM-DD') interpreta en UTC — usamos T12:00 para evitar off-by-one
  return new Date(`${ymd}T12:00:00`).getDay() === 0;
}

export function ModalReprogramar({ tarea, fechaFija, onClose, onConfirm }: Props) {
  const [fecha, setFecha] = useState('');
  const [just, setJust]   = useState('');
  const [busy, setBusy]   = useState(false);

  useEffect(() => { setFecha(''); setJust(''); }, [tarea?.id]);

  const fechaElegida = fechaFija ?? fecha;
  const esDom        = esDomingo(fechaElegida);
  const fechaOk      = Boolean(fechaElegida) && !esDom;
  const canSubmit    = fechaOk && just.trim().length >= MIN_JUSTIFICACION_CHARS && !busy;

  // Fecha mínima: mañana (no se puede reprogramar para hoy o antes)
  const minFecha = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return fechaLocalYmd(d);
  })();

  async function submit() {
    if (!tarea || !canSubmit) return;
    setBusy(true);
    try {
      await onConfirm({ tareaId: tarea.id, nuevaFecha: fechaElegida, justificacion: just.trim() });
      onClose();
    } finally { setBusy(false); }
  }

  return (
    <Modal
      open={tarea !== null}
      onClose={onClose}
      title="Reprogramar tarea"
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
            {busy ? 'Guardando…' : 'Confirmar reprogramación'}
          </Button>
        </>
      ) : null}
    >
      {tarea && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--mc-color-text-secondary)]">{tarea.titulo}</p>
          <p className="text-sm text-[var(--mc-color-text-secondary)]">
            La justificación es obligatoria (mínimo {MIN_JUSTIFICACION_CHARS} caracteres).
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
                min={minFecha}
                onChange={(e) => setFecha(e.target.value)}
                required
                autoFocus
              />
            )}
            {esDom && (
              <p style={{ fontSize: 12, color: 'var(--mc-color-danger)', marginTop: 4 }}>
                Los domingos no son días laborables. Elige de lunes a sábado.
              </p>
            )}
          </div>

          <JustificacionField
            value={just}
            onChange={setJust}
            placeholder="Describe el motivo de la reprogramación…"
            disabled={busy}
            autoFocus={Boolean(fechaFija)}
          />
        </div>
      )}
    </Modal>
  );
}