/**
 * components/tareas/ModalNuevaTarea.tsx
 * Migrado a <Modal> — Sprint 4.
 */

import { useCallback, useEffect, useState } from 'react';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { Objetivo, Tarea, Usuario } from '@/types';

type Modo = 'libre' | 'dia' | 'incidencia';

type Props = {
  modo: Modo;
  fechaDia?: string;
  fechaReferencia: string;
  open: boolean;
  objetivos?: Pick<Objetivo, 'id' | 'titulo'>[];
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

const TITULO_MODAL: Record<Modo, (fechaDia?: string) => string> = {
  libre: () => 'Nueva tarea libre',
  incidencia: () => 'Nueva incidencia',
  dia: (f = '') => `Nueva tarea · ${f}`,
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

  const reset = useCallback(() => {
    setTitulo('');
    setPrioridad('media');
    setDescripcion('');
    setObjetivoId('');
    setAsignadoId(usuarioActualId);
  }, [usuarioActualId]);

  useEffect(() => {
    if (open) reset();
  }, [open, modo, reset]);

  const fechaLimiteYmd = modo === 'dia' && fechaDia ? fechaDia : fechaReferencia;
  const canSubmit = titulo.trim().length > 0 && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const asignado = modo === 'incidencia' ? usuarioActualId : (asignadoId.trim() || usuarioActualId);
      await onSubmit({
        titulo: titulo.trim(),
        prioridad,
        descripcion: descripcion.trim(),
        objetivo_id: modo === 'incidencia' ? null : (objetivoId || null),
        asignado_a: asignado,
      });
      reset();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={TITULO_MODAL[modo](fechaDia)}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={!canSubmit}>
            {busy ? 'Guardando…' : modo === 'incidencia' ? 'Registrar' : 'Crear'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {modo === 'incidencia' ? (
          <p className="text-sm text-[var(--mc-color-text-secondary)]">
            Se registrará como imprevisto del día de hoy.
          </p>
        ) : (
          <div className="mc-field">
            <label className="mc-field-label" htmlFor="new-fecha">Fecha límite</label>
            <input id="new-fecha" type="date" className="mc-input" readOnly value={fechaLimiteYmd} aria-readonly="true" />
          </div>
        )}

        <div className="mc-field">
          <label className="mc-field-label" htmlFor="new-titulo">
            {modo === 'incidencia' ? 'Título del incidente' : 'Título'}
          </label>
          <input
            id="new-titulo"
            className="mc-input"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="mc-field">
          <label className="mc-field-label" htmlFor="new-prioridad">Prioridad</label>
          <select
            id="new-prioridad"
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
          <label className="mc-field-label" htmlFor="new-desc">
            {modo === 'incidencia' ? '¿Qué ocurrió y cómo se resolvió?' : 'Descripción'}
          </label>
          <textarea
            id="new-desc"
            className="mc-input"
            style={{ minHeight: 90, resize: 'vertical' }}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder={
              modo === 'incidencia'
                ? 'Describe el incidente y la solución aplicada…'
                : 'Describe la tarea…'
            }
          />
        </div>

        {modo !== 'incidencia' && (
          <div className="mc-field">
            <label className="mc-field-label" htmlFor="new-objetivo">Vincular a objetivo</label>
            <select
              id="new-objetivo"
              className="mc-input"
              value={objetivoId}
              onChange={(e) => setObjetivoId(e.target.value)}
            >
              <option value="">Sin objetivo</option>
              {objetivos.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.titulo}
                </option>
              ))}
            </select>
          </div>
        )}

        {modo !== 'incidencia' && usuariosAsignables.length > 0 && (
          <div className="mc-field">
            <label className="mc-field-label" htmlFor="new-asignado">Asignado a</label>
            <select
              id="new-asignado"
              className="mc-input"
              value={asignadoId}
              onChange={(e) => setAsignadoId(e.target.value)}
            >
              {usuariosAsignables.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.id === usuarioActualId ? `${u.nombre} (tú)` : u.nombre}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </Modal>
  );
}
