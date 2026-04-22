import { useEffect, useState } from 'react';

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
      setFecha('');
    }
  }, [nota]);

  if (!nota) return null;

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
    <div className="mc-overlay flex items-center justify-center p-4" role="presentation" onClick={onClose}>
      <div className="mc-modal" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-[var(--mc-color-text)]">Convertir en tarea</h2>
        <p className="mt-1 text-xs text-[var(--mc-color-text-secondary)]">Revisa y completa los datos antes de crear.</p>
        <label className="mt-3 block text-xs font-medium text-[var(--mc-color-text-secondary)]">
          Titulo
          <input className="mc-input mt-1" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </label>
        <label className="mt-3 block text-xs font-medium text-[var(--mc-color-text-secondary)]">
          Fecha planificada
          <input type="date" className="mc-input mt-1" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </label>
        <label className="mt-3 block text-xs font-medium text-[var(--mc-color-text-secondary)]">
          Prioridad
          <select className="mc-input mt-1" value={prioridad} onChange={(e) => setPrioridad(e.target.value as Tarea['prioridad'])}>
            <option value="baja">Baja</option>
            <option value="media">Media</option>
            <option value="alta">Alta</option>
          </select>
        </label>
        <label className="mt-3 block text-xs font-medium text-[var(--mc-color-text-secondary)]">
          Descripcion
          <textarea className="mc-input mt-1 min-h-[80px]" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="mc-btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className="mc-btn" onClick={() => void submit()} disabled={!canSubmit}>
            {busy ? 'Creando...' : 'Crear tarea'}
          </button>
        </div>
      </div>
    </div>
  );
}
