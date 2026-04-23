import { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { Objetivo, Tarea, TipoEvento, Usuario } from '@/types';

type ModoOrigen = 'libre' | 'dia';

type Props = {
  open: boolean;
  modoOrigen: ModoOrigen;
  fechaDia?: string;
  objetivos: Pick<Objetivo, 'id' | 'titulo'>[];
  usuariosAsignables: Pick<Usuario, 'id' | 'nombre'>[];
  /** Responsable por defecto (p. ej. dueño de la semana vista). */
  asignadoPorDefectoId: string;
  onClose: () => void;
  onCrearTarea: (input: {
    titulo: string;
    prioridad: Tarea['prioridad'];
    descripcion: string;
    objetivo_id?: string | null;
    asignado_a?: string | null;
  }) => Promise<void>;
  onCrearEvento: (input: {
    titulo: string;
    tipo: TipoEvento;
    hora_inicio: string;
    hora_fin: string;
    es_recurrente: boolean;
  }) => Promise<void>;
};

export function ModalMiSemana({
  open,
  modoOrigen,
  fechaDia,
  objetivos,
  usuariosAsignables,
  asignadoPorDefectoId,
  onClose,
  onCrearTarea,
  onCrearEvento,
}: Props) {
  const [tab, setTab] = useState<'tarea' | 'evento'>('tarea');
  const [titulo, setTitulo] = useState('');
  const [prioridad, setPrioridad] = useState<Tarea['prioridad']>('media');
  const [descripcion, setDescripcion] = useState('');
  const [objetivoId, setObjetivoId] = useState('');
  const [asignadoId, setAsignadoId] = useState(asignadoPorDefectoId);
  const [tipoEv, setTipoEv] = useState<TipoEvento>('reunion');
  const [horaIni, setHoraIni] = useState('09:00');
  const [horaFin, setHoraFin] = useState('10:00');
  const [recurrente, setRecurrente] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setAsignadoId(asignadoPorDefectoId);
  }, [open, asignadoPorDefectoId]);

  const fechaEvento = modoOrigen === 'dia' ? fechaDia : undefined;

  async function submitTarea() {
    if (!titulo.trim()) return;
    setBusy(true);
    try {
      await onCrearTarea({
        titulo: titulo.trim(),
        prioridad,
        descripcion: descripcion.trim(),
        objetivo_id: objetivoId || null,
        asignado_a: asignadoId.trim() || asignadoPorDefectoId,
      });
      resetAll();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function submitEvento() {
    if (!titulo.trim() || !fechaEvento) return;
    setBusy(true);
    try {
      await onCrearEvento({
        titulo: titulo.trim(),
        tipo: tipoEv,
        hora_inicio: horaIni,
        hora_fin: horaFin,
        es_recurrente: recurrente,
      });
      resetAll();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  function resetAll() {
    setTab('tarea');
    setTitulo('');
    setPrioridad('media');
    setDescripcion('');
    setObjetivoId('');
    setAsignadoId(asignadoPorDefectoId);
    setTipoEv('reunion');
    setHoraIni('09:00');
    setHoraFin('10:00');
    setRecurrente(false);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={modoOrigen === 'libre' ? 'Nuevo ítem en backlog' : `Nuevo ítem · ${fechaDia ?? ''}`}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          {tab === 'tarea' ? (
            <Button disabled={busy || !titulo.trim()} onClick={() => void submitTarea()}>
              {busy ? 'Guardando…' : 'Crear tarea'}
            </Button>
          ) : (
            <Button
              disabled={busy || !titulo.trim() || !fechaEvento}
              onClick={() => void submitEvento()}
            >
              {busy ? 'Guardando…' : 'Crear evento'}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {modoOrigen === 'dia' && fechaDia && (
          <div className="mc-field">
            <label className="mc-field-label" htmlFor="new-fecha">Fecha límite</label>
            <input id="new-fecha" type="date" className="mc-input" readOnly value={fechaDia} aria-readonly />
          </div>
        )}

        <div className="flex gap-1 rounded-[var(--mc-radius-md)] border border-[var(--mc-color-border)] bg-[var(--mc-color-bg)] p-1">
          <button
            type="button"
            className={`flex-1 rounded-[var(--mc-radius-sm)] px-3 py-1.5 text-xs font-medium transition-all ${
              tab === 'tarea' ? 'bg-[var(--mc-color-surface)] shadow-sm text-[var(--mc-color-text)]' : 'text-[var(--mc-color-text-secondary)] hover:bg-[var(--mc-color-bg-secondary)]'
            }`}
            onClick={() => setTab('tarea')}
          >
            Tarea
          </button>
          <button
            type="button"
            className={`flex-1 rounded-[var(--mc-radius-sm)] px-3 py-1.5 text-xs font-medium transition-all ${
              tab === 'evento' ? 'bg-[var(--mc-color-surface)] shadow-sm text-[var(--mc-color-text)]' : 'text-[var(--mc-color-text-secondary)] hover:bg-[var(--mc-color-bg-secondary)]'
            }`}
            onClick={() => setTab('evento')}
            disabled={modoOrigen !== 'dia'}
            title={modoOrigen !== 'dia' ? 'Selecciona un día en la agenda para crear un evento' : undefined}
          >
            Evento
          </button>
        </div>

        {tab === 'tarea' ? (
          <div className="flex flex-col gap-4">
            <div className="mc-field">
              <label className="mc-field-label" htmlFor="task-title">Título</label>
              <input id="task-title" className="mc-input" value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus />
            </div>
            <div className="mc-field">
              <label className="mc-field-label" htmlFor="task-desc">Descripción</label>
              <textarea id="task-desc" className="mc-input" style={{ minHeight: 80, resize: 'vertical' }} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
            </div>
            {modoOrigen === 'dia' && (
              <>
                <div className="mc-field">
                  <label className="mc-field-label" htmlFor="task-prioridad">Prioridad</label>
                  <select
                    id="task-prioridad"
                    className="mc-input"
                    value={prioridad}
                    onChange={(e) => setPrioridad(e.target.value as Tarea['prioridad'])}
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>
                <div className="mc-field">
                  <label className="mc-field-label" htmlFor="task-objetivo">Vincular a objetivo</label>
                  <select id="task-objetivo" className="mc-input" value={objetivoId} onChange={(e) => setObjetivoId(e.target.value)}>
                    <option value="">Sin objetivo</option>
                    {objetivos.map((o) => (
                      <option key={o.id} value={o.id}>{o.titulo}</option>
                    ))}
                  </select>
                </div>
                {usuariosAsignables.length > 0 && (
                  <div className="mc-field">
                    <label className="mc-field-label" htmlFor="task-asignado">Responsable</label>
                    <select id="task-asignado" className="mc-input" value={asignadoId} onChange={(e) => setAsignadoId(e.target.value)}>
                      {usuariosAsignables.map((u) => (
                        <option key={u.id} value={u.id}>{u.nombre}</option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="mc-field">
              <label className="mc-field-label" htmlFor="ev-title">Título</label>
              <input id="ev-title" className="mc-input" value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus />
            </div>
            <div className="mc-field">
              <label className="mc-field-label" htmlFor="ev-tipo">Tipo</label>
              <select id="ev-tipo" className="mc-input" value={tipoEv} onChange={(e) => setTipoEv(e.target.value as TipoEvento)}>
                <option value="reunion">Reunión</option>
                <option value="entrega">Entrega</option>
                <option value="personal">Personal</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="mc-field">
                <label className="mc-field-label" htmlFor="ev-start">Hora inicio</label>
                <input id="ev-start" type="time" className="mc-input" value={horaIni} onChange={(e) => setHoraIni(e.target.value)} />
              </div>
              <div className="mc-field">
                <label className="mc-field-label" htmlFor="ev-end">Hora fin</label>
                <input id="ev-end" type="time" className="mc-input" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-[var(--mc-color-text-secondary)]">
              <input type="checkbox" className="mc-checkbox" checked={recurrente} onChange={(e) => setRecurrente(e.target.checked)} />
              Recurrente
            </label>
          </div>
        )}
      </div>
    </Modal>
  );
}
