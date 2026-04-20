import { useEffect, useState } from 'react';

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

  if (!open) return null;

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
    <div className="mc-overlay flex items-center justify-center p-4" role="presentation" onClick={onClose}>
      <div className="mc-modal max-w-[560px]" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-[var(--mc-color-text)]">
          {modoOrigen === 'libre' ? 'Nuevo ítem en backlog' : `Nuevo ítem · ${fechaDia ?? ''}`}
        </h2>
        {modoOrigen === 'dia' && fechaDia ? (
          <label className="mt-3 block text-xs font-medium text-[var(--mc-color-text-secondary)]">
            Fecha límite
            <input type="date" className="mc-input mt-1" readOnly value={fechaDia} aria-readonly />
          </label>
        ) : null}

        <div className="mt-4 flex gap-1 rounded-[var(--mc-radius-md)] border border-[var(--mc-color-border)] bg-[var(--mc-color-bg)] p-1">
          <button
            type="button"
            className={`flex-1 rounded-[var(--mc-radius-sm)] px-3 py-2 text-xs font-medium ${tab === 'tarea' ? 'bg-[var(--mc-color-surface)] shadow-sm' : 'mc-btn-ghost !py-2'}`}
            onClick={() => setTab('tarea')}
          >
            Tarea
          </button>
          <button
            type="button"
            className={`flex-1 rounded-[var(--mc-radius-sm)] px-3 py-2 text-xs font-medium ${tab === 'evento' ? 'bg-[var(--mc-color-surface)] shadow-sm' : 'mc-btn-ghost !py-2'}`}
            onClick={() => setTab('evento')}
            disabled={modoOrigen !== 'dia'}
            title={modoOrigen !== 'dia' ? 'Selecciona un día en la agenda para crear un evento' : undefined}
          >
            Evento
          </button>
        </div>

        {tab === 'tarea' ? (
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-medium text-[var(--mc-color-text-secondary)]">
              Título
              <input className="mc-input mt-1" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </label>
            <label className="block text-xs font-medium text-[var(--mc-color-text-secondary)]">
              Prioridad
              <select
                className="mc-input mt-1"
                value={prioridad}
                onChange={(e) => setPrioridad(e.target.value as Tarea['prioridad'])}
              >
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            </label>
            <label className="block text-xs font-medium text-[var(--mc-color-text-secondary)]">
              Descripción
              <textarea className="mc-input mt-1 min-h-[80px]" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
            </label>
            <label className="block text-xs font-medium text-[var(--mc-color-text-secondary)]">
              Vincular a objetivo
              <select className="mc-input mt-1" value={objetivoId} onChange={(e) => setObjetivoId(e.target.value)}>
                <option value="">Sin objetivo</option>
                {objetivos.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.titulo}
                  </option>
                ))}
              </select>
            </label>
            {usuariosAsignables.length > 0 ? (
              <label className="mt-3 block text-xs font-medium text-[var(--mc-color-text-secondary)]">
                Responsable
                <select className="mc-input mt-1" value={asignadoId} onChange={(e) => setAsignadoId(e.target.value)}>
                  {usuariosAsignables.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-medium text-[var(--mc-color-text-secondary)]">
              Título
              <input className="mc-input mt-1" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </label>
            <label className="block text-xs font-medium text-[var(--mc-color-text-secondary)]">
              Tipo
              <select className="mc-input mt-1" value={tipoEv} onChange={(e) => setTipoEv(e.target.value as TipoEvento)}>
                <option value="reunion">Reunión</option>
                <option value="entrega">Entrega</option>
                <option value="personal">Personal</option>
                <option value="otro">Otro</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-[var(--mc-color-text-secondary)]">
                Hora inicio
                <input type="time" className="mc-input mt-1" value={horaIni} onChange={(e) => setHoraIni(e.target.value)} />
              </label>
              <label className="block text-xs font-medium text-[var(--mc-color-text-secondary)]">
                Hora fin
                <input type="time" className="mc-input mt-1" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
              </label>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--mc-color-text-secondary)]">
              <input type="checkbox" checked={recurrente} onChange={(e) => setRecurrente(e.target.checked)} />
              Recurrente
            </label>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="mc-btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          {tab === 'tarea' ? (
            <button type="button" className="mc-btn" disabled={busy || !titulo.trim()} onClick={() => void submitTarea()}>
              {busy ? 'Guardando…' : 'Crear tarea'}
            </button>
          ) : (
            <button
              type="button"
              className="mc-btn"
              disabled={busy || !titulo.trim() || !fechaEvento}
              onClick={() => void submitEvento()}
            >
              {busy ? 'Guardando…' : 'Crear evento'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
