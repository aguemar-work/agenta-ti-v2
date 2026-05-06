import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button, CancelButton } from '@/components/ui/Button';
import { RecurrenciaForm, type RecurrenciaConfig } from '@/components/semana/RecurrenciaForm';
import type { NotaBitacora, TipoEvento } from '@/types';

type Props = {
  nota: NotaBitacora | null;
  onClose: () => void;
  /** Evento único */
  onConfirm: (input: {
    titulo: string;
    tipo: TipoEvento;
    fecha_dia: string;
    hora_inicio: string;
    hora_fin: string;
    es_recurrente: boolean;
  }) => Promise<void>;
  /** Evento recurrente — recibe la config de recurrencia */
  onConfirmRecurrente: (input: {
    titulo: string;
    tipo: TipoEvento;
    hora_inicio: string;
    hora_fin: string;
    fecha_inicio: string;
    dias_semana: number[];
    fecha_fin?: string;
    meses: number;
  }) => Promise<void>;
};

export function ModalConvertirEvento({ nota, onClose, onConfirm, onConfirmRecurrente }: Props) {
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<TipoEvento>('reunion');
  const [fecha, setFecha] = useState('');
  const [horaIni, setHoraIni] = useState('09:00');
  const [horaFin, setHoraFin] = useState('10:00');
  const [recurrente, setRecurrente] = useState(false);
  const [recConfig, setRecConfig] = useState<RecurrenciaConfig>({ dias_semana: [], fecha_fin: '', meses: 1 });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (nota) {
      setTitulo(nota.contenido.slice(0, 120));
      setFecha('');
      setTipo('reunion');
      setHoraIni('09:00');
      setHoraFin('10:00');
      setRecurrente(false);
      setRecConfig({ dias_semana: [], fecha_fin: '', meses: 1 });
    }
  }, [nota]);

  const canSubmit = titulo.trim().length > 0 && fecha.length > 0 && !busy;

  async function submit() {
    if (!canSubmit) return;
    if (recurrente && recConfig.dias_semana.length === 0) return;
    setBusy(true);
    try {
      if (recurrente) {
        // Crear recurrencia en lugar de evento único
        // usuario_id no está disponible en este modal — se resuelve en el hook del padre
        await onConfirmRecurrente({
          titulo:       titulo.trim(),
          tipo,
          hora_inicio:  horaIni,
          hora_fin:     horaFin,
          fecha_inicio: fecha,
          dias_semana:  recConfig.dias_semana,
          fecha_fin:    recConfig.fecha_fin || undefined,
          meses:        recConfig.meses,
        });
      } else {
        await onConfirm({
          titulo:        titulo.trim(),
          tipo,
          fecha_dia:     fecha,
          hora_inicio:   horaIni,
          hora_fin:      horaFin,
          es_recurrente: false,
        });
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={nota !== null}
      onClose={onClose}
      title="Convertir en evento"
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
            {busy ? 'Creando…' : 'Crear evento'}
          </Button>
          <CancelButton onClick={onClose} disabled={busy} />
        </div>
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="mc-field">
          <label className="mc-field-label" htmlFor="conv-ev-title">Título</label>
          <input id="conv-ev-title" className="mc-input" value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus />
        </div>
        <div className="mc-field">
          <label className="mc-field-label" htmlFor="conv-ev-fecha">Fecha</label>
          <input id="conv-ev-fecha" type="date" className="mc-input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="mc-field">
            <label className="mc-field-label" htmlFor="conv-ev-start">Hora inicio</label>
            <input id="conv-ev-start" type="time" className="mc-input" value={horaIni} onChange={(e) => setHoraIni(e.target.value)} />
          </div>
          <div className="mc-field">
            <label className="mc-field-label" htmlFor="conv-ev-end">Hora fin</label>
            <input id="conv-ev-end" type="time" className="mc-input" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
          </div>
        </div>
        <div className="mc-field">
          <label className="mc-field-label" htmlFor="conv-ev-tipo">Tipo</label>
          <select id="conv-ev-tipo" className="mc-input" value={tipo} onChange={(e) => setTipo(e.target.value as TipoEvento)}>
            <option value="reunion">Reunión</option>
            <option value="entrega">Entrega</option>
            <option value="personal">Personal</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-[var(--mc-color-text-secondary)]">
          <input
            type="checkbox"
            className="mc-checkbox"
            checked={recurrente}
            onChange={(e) => {
              setRecurrente(e.target.checked);
              if (!e.target.checked) setRecConfig({ dias_semana: [], fecha_fin: '', meses: 1 });
            }}
          />
          Recurrente (se repite cada semana)
        </label>
        {recurrente && (
          <RecurrenciaForm value={recConfig} onChange={setRecConfig} />
        )}
      </div>
    </Modal>
  );
}