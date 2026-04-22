import { useEffect, useState } from 'react';

import type { NotaBitacora, TipoEvento } from '@/types';

type Props = {
  nota: NotaBitacora | null;
  onClose: () => void;
  onConfirm: (input: {
    titulo: string;
    tipo: TipoEvento;
    fecha_dia: string;
    hora_inicio: string;
    hora_fin: string;
    es_recurrente: boolean;
  }) => Promise<void>;
};

export function ModalConvertirEvento({ nota, onClose, onConfirm }: Props) {
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<TipoEvento>('reunion');
  const [fecha, setFecha] = useState('');
  const [horaIni, setHoraIni] = useState('09:00');
  const [horaFin, setHoraFin] = useState('10:00');
  const [recurrente, setRecurrente] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (nota) {
      setTitulo(nota.contenido.slice(0, 120));
      setFecha('');
      setTipo('reunion');
      setHoraIni('09:00');
      setHoraFin('10:00');
      setRecurrente(false);
    }
  }, [nota]);

  if (!nota) return null;

  const canSubmit = titulo.trim().length > 0 && fecha.length > 0 && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await onConfirm({
        titulo: titulo.trim(),
        tipo,
        fecha_dia: fecha,
        hora_inicio: horaIni,
        hora_fin: horaFin,
        es_recurrente: recurrente,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mc-overlay flex items-center justify-center p-4" role="presentation" onClick={onClose}>
      <div className="mc-modal" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-[var(--mc-color-text)]">Convertir en evento</h2>
        <label className="mt-3 block text-xs font-medium text-[var(--mc-color-text-secondary)]">
          Titulo
          <input className="mc-input mt-1" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </label>
        <label className="mt-3 block text-xs font-medium text-[var(--mc-color-text-secondary)]">
          Fecha
          <input type="date" className="mc-input mt-1" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-[var(--mc-color-text-secondary)]">
            Hora inicio
            <input type="time" className="mc-input mt-1" value={horaIni} onChange={(e) => setHoraIni(e.target.value)} />
          </label>
          <label className="block text-xs font-medium text-[var(--mc-color-text-secondary)]">
            Hora fin
            <input type="time" className="mc-input mt-1" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
          </label>
        </div>
        <label className="mt-3 block text-xs font-medium text-[var(--mc-color-text-secondary)]">
          Tipo
          <select className="mc-input mt-1" value={tipo} onChange={(e) => setTipo(e.target.value as TipoEvento)}>
            <option value="reunion">Reunion</option>
            <option value="entrega">Entrega</option>
            <option value="personal">Personal</option>
            <option value="otro">Otro</option>
          </select>
        </label>
        <label className="mt-3 flex items-center gap-2 text-xs text-[var(--mc-color-text-secondary)]">
          <input type="checkbox" checked={recurrente} onChange={(e) => setRecurrente(e.target.checked)} />
          Recurrente
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="mc-btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className="mc-btn" onClick={() => void submit()} disabled={!canSubmit}>
            {busy ? 'Creando...' : 'Crear evento'}
          </button>
        </div>
      </div>
    </div>
  );
}
