import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { CancelButton } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { descripcionDesdeNota, tituloDesdeNota } from '@/lib/notaBitacora';
import type { NotaBitacora, Tarea, TipoEvento, Usuario } from '@/types';

type Props = {
  open: boolean;
  nota: NotaBitacora | null;
  hoyYmd: string;
  usuariosAsignables: Pick<Usuario, 'id' | 'nombre'>[];
  asignadoPorDefectoId: string;
  onClose: () => void;
  onConvertirTarea: (input: {
    titulo: string;
    prioridad: Tarea['prioridad'];
    descripcion: string;
    fecha_planificada: string;
    asignado_a: string;
  }) => Promise<void>;
  onConvertirEvento: (input: {
    titulo: string;
    tipo: TipoEvento;
    fecha_dia: string;
    hora_inicio: string;
    hora_fin: string;
  }) => Promise<void>;
};

export function ModalConvertirNota({
  open,
  nota,
  hoyYmd,
  usuariosAsignables,
  asignadoPorDefectoId,
  onClose,
  onConvertirTarea,
  onConvertirEvento,
}: Props) {
  const sugerencia = useMemo(() => {
    if (!nota) return { titulo: '', descripcion: '' };
    return {
      titulo: tituloDesdeNota(nota.contenido),
      descripcion: descripcionDesdeNota(nota.contenido),
    };
  }, [nota]);

  const [tab, setTab] = useState<'tarea' | 'evento'>('tarea');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [prioridad, setPrioridad] = useState<Tarea['prioridad']>('media');
  const [fecha, setFecha] = useState(hoyYmd);
  const [asignadoId, setAsignadoId] = useState(asignadoPorDefectoId);
  const [tipoEv, setTipoEv] = useState<TipoEvento>('reunion');
  const [horaIni, setHoraIni] = useState('09:00');
  const [horaFin, setHoraFin] = useState('10:00');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !nota) return;
    setTab('tarea');
    setTitulo(sugerencia.titulo);
    setDescripcion(sugerencia.descripcion);
    setPrioridad('media');
    setFecha(hoyYmd);
    setAsignadoId(asignadoPorDefectoId);
    setTipoEv('reunion');
    setHoraIni('09:00');
    setHoraFin('10:00');
  }, [open, nota, sugerencia.titulo, sugerencia.descripcion, hoyYmd, asignadoPorDefectoId]);

  async function submitTarea() {
    if (!titulo.trim()) return;
    setBusy(true);
    try {
      await onConvertirTarea({
        titulo: titulo.trim(),
        prioridad,
        descripcion: descripcion.trim(),
        fecha_planificada: fecha,
        asignado_a: asignadoId.trim() || asignadoPorDefectoId,
      });
      onClose();
    } catch (err) {
      console.error('[ModalConvertirNota.tarea]', err);
      toast.error('No se pudo convertir la nota en tarea.');
    } finally {
      setBusy(false);
    }
  }

  async function submitEvento() {
    if (!titulo.trim()) return;
    setBusy(true);
    try {
      await onConvertirEvento({
        titulo: titulo.trim(),
        tipo: tipoEv,
        fecha_dia: fecha,
        hora_inicio: horaIni,
        hora_fin: horaFin,
      });
      onClose();
    } catch (err) {
      console.error('[ModalConvertirNota.evento]', err);
      toast.error('No se pudo convertir la nota en evento.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Convertir nota"
      size="md"
      analyticsId="modal-convertir-nota"
      bodyClassName="mc-modal-form"
      footerClassName="mc-modal-footer--stack"
      footer={(
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tab === 'tarea' ? (
            <button
              type="button"
              className="mc-btn-modal-primary"
              disabled={busy || !titulo.trim() || !fecha}
              onClick={() => void submitTarea()}
            >
              {busy ? 'Guardando…' : 'Crear tarea'}
            </button>
          ) : (
            <button
              type="button"
              className="mc-btn-modal-primary"
              disabled={busy || !titulo.trim() || !fecha || horaFin <= horaIni}
              onClick={() => void submitEvento()}
            >
              {busy ? 'Guardando…' : 'Crear evento'}
            </button>
          )}
          <CancelButton onClick={onClose} disabled={busy} />
        </div>
      )}
    >
      <div className="flex flex-col gap-4">
        {nota && (
          <p className="m-0 rounded border border-[var(--mc-color-border)] bg-[var(--mc-color-bg-secondary)] px-2 py-1.5 text-[11px] text-[var(--mc-color-text-secondary)]">
            {nota.contenido.length > 160 ? `${nota.contenido.slice(0, 160)}…` : nota.contenido}
          </p>
        )}

        <div className="mc-modal-form-tabs">
          <button
            type="button"
            className={tab === 'tarea' ? 'mc-modal-form-tabs__active' : ''}
            onClick={() => setTab('tarea')}
          >
            Tarea
          </button>
          <button
            type="button"
            className={tab === 'evento' ? 'mc-modal-form-tabs__active' : ''}
            onClick={() => setTab('evento')}
          >
            Evento
          </button>
        </div>

        <div className="mc-field">
          <label className="mc-field-label" htmlFor="conv-fecha">Fecha</label>
          <input
            id="conv-fecha"
            type="date"
            className="mc-input"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>

        <div className="mc-field">
          <label className="mc-field-label" htmlFor="conv-titulo">Título</label>
          <input
            id="conv-titulo"
            className="mc-input"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            autoFocus
          />
        </div>

        {tab === 'tarea' ? (
          <>
            <div className="mc-field">
              <label className="mc-field-label" htmlFor="conv-desc">Descripción</label>
              <textarea
                id="conv-desc"
                className="mc-input"
                style={{ minHeight: 72, resize: 'vertical' }}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </div>
            <div className="mc-field">
              <label className="mc-field-label" htmlFor="conv-prioridad">Prioridad</label>
              <select
                id="conv-prioridad"
                className="mc-input"
                value={prioridad}
                onChange={(e) => setPrioridad(e.target.value as Tarea['prioridad'])}
              >
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="critica">Crítica</option>
              </select>
            </div>
            {usuariosAsignables.length > 0 && (
              <div className="mc-field">
                <label className="mc-field-label" htmlFor="conv-asignado">Responsable</label>
                <select
                  id="conv-asignado"
                  className="mc-input"
                  value={asignadoId}
                  onChange={(e) => setAsignadoId(e.target.value)}
                >
                  {usuariosAsignables.map((u) => (
                    <option key={u.id} value={u.id}>{u.nombre}</option>
                  ))}
                </select>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="mc-field">
              <label className="mc-field-label" htmlFor="conv-tipo">Tipo</label>
              <select
                id="conv-tipo"
                className="mc-input"
                value={tipoEv}
                onChange={(e) => setTipoEv(e.target.value as TipoEvento)}
              >
                <option value="reunion">Reunión</option>
                <option value="entrega">Entrega</option>
                <option value="personal">Personal</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="mc-field">
                <label className="mc-field-label" htmlFor="conv-ini">Hora inicio</label>
                <input
                  id="conv-ini"
                  type="time"
                  className="mc-input"
                  value={horaIni}
                  onChange={(e) => setHoraIni(e.target.value)}
                />
              </div>
              <div className="mc-field">
                <label className="mc-field-label" htmlFor="conv-fin">Hora fin</label>
                <input
                  id="conv-fin"
                  type="time"
                  className="mc-input"
                  value={horaFin}
                  onChange={(e) => setHoraFin(e.target.value)}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
