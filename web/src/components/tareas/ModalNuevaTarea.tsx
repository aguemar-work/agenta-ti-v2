import { useEffect, useMemo, useState } from 'react';
import { markModalCompleted, Modal } from '@/components/ui/Modal';
import { CancelButton } from '@/components/ui/Button';
import { useDraftForm } from '@/hooks/useDraftForm';
import type { Objetivo, Tarea, Usuario } from '@/types';

type Modo = 'dia' | 'incidencia';

type Props = {
  modo:               Modo;
  fechaDia?:          string;
  fechaReferencia:    string;
  open:               boolean;
  objetivos?:         Pick<Objetivo, 'id' | 'titulo'>[];
  usuarioActualId:    string;
  usuariosAsignables?: Pick<Usuario, 'id' | 'nombre'>[];
  onClose:            () => void;
  onSubmit:           (input: {
    titulo:       string;
    prioridad:    Tarea['prioridad'];
    descripcion:  string;
    objetivo_id?: string | null;
    asignado_a:   string;
    fecha_planificada?: string;
  }) => Promise<void>;
};

const TITULO_MODAL: Record<Modo, (fechaDia?: string) => string> = {
  incidencia: ()  => 'Nueva incidencia',
  dia:        (f = '') => `Nueva tarea · ${f}`,
};

export function ModalNuevaTarea({
  modo, fechaDia, fechaReferencia, open,
  objetivos = [], usuarioActualId, usuariosAsignables = [],
  onClose, onSubmit,
}: Props) {
  const [busy, setBusy] = useState(false);

  const initialForm = useMemo(() => ({
    titulo:      '',
    prioridad:   'media' as Tarea['prioridad'],
    descripcion: '',
    objetivoId:  '',
    asignadoId:  usuarioActualId,
  }), [usuarioActualId]);

  const draftKey = `tarea-nueva-${modo}-${usuarioActualId}`;
  const { form, setForm, hasChanges, clearDraft } = useDraftForm(draftKey, initialForm);

  const [fechaIncidencia, setFechaIncidencia] = useState(fechaReferencia);
  const fechaLimiteYmd = modo === 'dia' && fechaDia ? fechaDia : fechaIncidencia;
  const canSubmit      = form.titulo.trim().length > 0 && !busy;

  useEffect(() => {
    if (open && modo === 'incidencia') setFechaIncidencia(fechaReferencia);
  }, [open, modo, fechaReferencia]);

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const asignado = modo === 'incidencia'
        ? usuarioActualId
        : (form.asignadoId.trim() || usuarioActualId);
      await onSubmit({
        titulo:       form.titulo.trim(),
        prioridad:    form.prioridad,
        descripcion:  form.descripcion.trim(),
        objetivo_id:  modo === 'incidencia' ? null : (form.objetivoId || null),
        asignado_a:   asignado,
        ...(modo === 'incidencia' ? { fecha_planificada: fechaIncidencia } : {}),
      });
      markModalCompleted('modal-nueva-tarea');
      clearDraft();
      onClose();
    } finally { setBusy(false); }
  }

  function handleClose() { clearDraft(); onClose(); }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={TITULO_MODAL[modo](fechaDia)}
      size="md"
      analyticsId="modal-nueva-tarea"
      hasUnsavedChanges={hasChanges}
      bodyClassName="mc-modal-form"
      footerClassName="mc-modal-footer--stack"
      footer={(
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            className="mc-btn-modal-primary"
            disabled={!canSubmit}
            onClick={() => void submit()}
          >
            {busy ? 'Guardando…' : modo === 'incidencia' ? 'Registrar incidencia' : 'Crear tarea'}
          </button>
          <CancelButton onClick={handleClose} disabled={busy} />
        </div>
      )}
    >
      <div className="flex flex-col gap-4">
        {modo === 'incidencia' ? (
          <div className="mc-field">
            <label className="mc-field-label" htmlFor="new-fecha-inc">Fecha del incidente</label>
            <input
              id="new-fecha-inc"
              type="date"
              className="mc-input"
              value={fechaIncidencia}
              onChange={(e) => setFechaIncidencia(e.target.value)}
            />
          </div>
        ) : (
          <div className="mc-field">
            <label className="mc-field-label" htmlFor="new-fecha">Fecha límite</label>
            <input
              id="new-fecha"
              type="date"
              className="mc-input"
              readOnly
              disabled
              value={fechaLimiteYmd}
              aria-readonly
              title="Fecha fijada al día seleccionado"
            />
            <p className="mt-1 text-xs text-[var(--mc-color-text-secondary)]">
              Fecha fijada al día seleccionado
            </p>
          </div>
        )}

        <div className="mc-field">
          <label className="mc-field-label" htmlFor="new-titulo">
            {modo === 'incidencia' ? 'Título del incidente' : 'Título'}
          </label>
          <input
            id="new-titulo"
            className="mc-input"
            value={form.titulo}
            onChange={(e) => setForm((prev) => ({ ...prev, titulo: e.target.value }))}
            required
            autoFocus
          />
        </div>

        <div className="mc-field">
          <label className="mc-field-label" htmlFor="new-prioridad">Prioridad</label>
          <select
            id="new-prioridad"
            className="mc-input"
            value={form.prioridad}
            onChange={(e) => setForm((prev) => ({ ...prev, prioridad: e.target.value as Tarea['prioridad'] }))}
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
            value={form.descripcion}
            onChange={(e) => setForm((prev) => ({ ...prev, descripcion: e.target.value }))}
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
              value={form.objetivoId}
              onChange={(e) => setForm((prev) => ({ ...prev, objetivoId: e.target.value }))}
            >
              <option value="">Sin objetivo</option>
              {objetivos.map((o) => (
                <option key={o.id} value={o.id}>{o.titulo}</option>
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
              value={form.asignadoId}
              onChange={(e) => setForm((prev) => ({ ...prev, asignadoId: e.target.value }))}
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