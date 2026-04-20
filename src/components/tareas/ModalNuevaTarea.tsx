import { useEffect, useState } from 'react';

import type { Objetivo, Tarea, Usuario } from '@/types';

type Modo = 'libre' | 'dia' | 'incidencia';

type Props = {
  modo: Modo;
  fechaDia?: string;
  /** Día canónico `YYYY-MM-DD` (p. ej. hoy) para incidencias o respaldo. */
  fechaReferencia: string;
  open: boolean;
  objetivos?: Pick<Objetivo, 'id' | 'titulo'>[];
  /** UUID del usuario en sesión: se usa si "Asignado a" queda vacío. */
  usuarioActualId: string;
  usuariosAsignables?: Pick<Usuario, 'id' | 'nombre'>[];
  onClose: () => void;
  onSubmit: (input: {
    titulo: string;
    prioridad: Tarea['prioridad'];
    descripcion: string;
    objetivo_id?: string | null;
    asignado_a: string;
  }) => Promise<void>;
};

export function ModalNuevaTarea({
  modo,
  fechaDia,
  fechaReferencia,
  open,
  objetivos = [],
  usuarioActualId,
  usuariosAsignables = [],
  onClose,
  onSubmit,
}: Props) {
  const [titulo, setTitulo] = useState('');
  const [prioridad, setPrioridad] = useState<Tarea['prioridad']>('media');
  const [descripcion, setDescripcion] = useState('');
  const [objetivoId, setObjetivoId] = useState('');
  const [asignadoId, setAsignadoId] = useState(usuarioActualId);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setAsignadoId(usuarioActualId);
  }, [open, usuarioActualId]);

  if (!open) return null;

  const fechaLimiteYmd = modo === 'dia' && fechaDia ? fechaDia : fechaReferencia;

  async function submit() {
    if (!titulo.trim()) return;
    setBusy(true);
    try {
      const asignado = asignadoId.trim() || usuarioActualId;
      await onSubmit({
        titulo: titulo.trim(),
        prioridad,
        descripcion: descripcion.trim(),
        objetivo_id: objetivoId || null,
        asignado_a: asignado,
      });
      setTitulo('');
      setPrioridad('media');
      setDescripcion('');
      setObjetivoId('');
      setAsignadoId(usuarioActualId);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mc-overlay flex items-center justify-center p-4" role="presentation" onClick={onClose}>
      <div className="mc-modal" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-[var(--mc-color-text)]">
          {modo === 'libre'
            ? 'Nueva tarea libre'
            : modo === 'incidencia'
              ? 'Nueva incidencia'
              : `Nueva tarea · ${fechaDia ?? ''}`}
        </h2>
        <label className="mt-3 block text-xs font-medium text-[var(--mc-color-text-secondary)]">
          Fecha límite
          <input type="date" className="mc-input mt-1" readOnly value={fechaLimiteYmd} aria-readonly />
        </label>
        <label className="mt-3 block text-xs font-medium text-[var(--mc-color-text-secondary)]">
          Título
          <input className="mc-input mt-1" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
        </label>
        <label className="mt-3 block text-xs font-medium text-[var(--mc-color-text-secondary)]">
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
        <label className="mt-3 block text-xs font-medium text-[var(--mc-color-text-secondary)]">
          Descripción
          <textarea
            className="mc-input mt-1 min-h-[90px] resize-y"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Describe la tarea..."
          />
        </label>
        <label className="mt-3 block text-xs font-medium text-[var(--mc-color-text-secondary)]">
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
            Asignado a
            <select className="mc-input mt-1" value={asignadoId} onChange={(e) => setAsignadoId(e.target.value)}>
              {usuariosAsignables.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.id === usuarioActualId ? `${u.nombre} (tú)` : u.nombre}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="mc-btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className="mc-btn" onClick={() => void submit()} disabled={busy || !titulo.trim()}>
            {busy ? 'Guardando…' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  );
}
