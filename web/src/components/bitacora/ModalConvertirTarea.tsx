import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button, CancelButton } from '@/components/ui/Button';

import type { NotaBitacora, Tarea } from '@/types';

type Props = {
  nota: NotaBitacora | null;
  onClose: () => void;
  onConfirm: (input: {
    titulo: string;
    descripcion: string;
    prioridad: Tarea['prioridad'];
    fecha_planificada: string;
  }) => Promise<void>;
};

export function ModalConvertirTarea({ nota, onClose, onConfirm }: Props) {
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [prioridad, setPrioridad] = useState<Tarea['prioridad']>('media');
  const [fecha, setFecha] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (nota) {
      setTitulo(nota.contenido.slice(0, 120));
      setDescripcion(nota.contenido);
      setPrioridad('media');
      // Pre-populate with today as a starting point — user can change via Reprogramar later
      const hoy = new Date();
      const yyyy = hoy.getFullYear();
      const mm   = String(hoy.getMonth() + 1).padStart(2, '0');
      const dd   = String(hoy.getDate()).padStart(2, '0');
      setFecha(`${yyyy}-${mm}-${dd}`);
    }
  }, [nota]);

  const canSubmit = titulo.trim().length > 0 && fecha.length > 0 && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await onConfirm({ titulo: titulo.trim(), descripcion: descripcion.trim(), prioridad, fecha_planificada: fecha });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={nota !== null}
      onClose={onClose}
      title="Convertir en tarea"
      size="sm"
      footer={(
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!canSubmit}
            onClick={() => void submit()}
          >
            {busy ? 'Creando…' : 'Crear tarea'}
          </Button>
          <CancelButton onClick={onClose} disabled={busy} />
        </div>
      )}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[var(--mc-color-text-secondary)]">Revisa y completa los datos antes de crear.</p>
        <div className="mc-field">
          <label className="mc-field-label" htmlFor="conv-title">Título</label>
          <input id="conv-title" className="mc-input" value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="mc-field">
            <label className="mc-field-label" htmlFor="conv-fecha">Fecha planificada</label>
            <input id="conv-fecha" type="date" className="mc-input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            <p className="mt-1 text-[10px] text-[var(--mc-color-text-secondary)]">Puedes reprogramarla después.</p>
          </div>
          <div className="mc-field">
            <label className="mc-field-label" htmlFor="conv-prioridad">Prioridad</label>
            <select id="conv-prioridad" className="mc-input" value={prioridad} onChange={(e) => setPrioridad(e.target.value as Tarea['prioridad'])}>
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
            </select>
          </div>
        </div>
        <div className="mc-field">
          <label className="mc-field-label" htmlFor="conv-desc">Descripción</label>
          <textarea id="conv-desc" className="mc-input" style={{ minHeight: 72, resize: 'vertical' }} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}