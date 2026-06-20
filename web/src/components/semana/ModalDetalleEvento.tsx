import { useState } from 'react';
import { Calendar, Package2, Trash2, User, Users } from 'lucide-react';
import { toast } from 'sonner';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { ActualizarEventoInput } from '@/api/semana';
import type { Evento, TipoEvento } from '@/types';

const TIPO_LABEL: Record<TipoEvento, string> = {
  reunion:  'Reunión',
  entrega:  'Entrega',
  personal: 'Personal',
  otro:     'Otro',
};

const TIPO_ICON = {
  reunion:  Users,
  entrega:  Package2,
  personal: User,
  otro:     Calendar,
} as const;

function formatFechaHora(fechaInicio: string, fechaFin: string): string {
  const inicio = new Date(fechaInicio);
  const fin    = new Date(fechaFin);
  const fecha  = inicio.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' });
  const hIni   = inicio.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  const hFin   = fin.toLocaleTimeString('es',   { hour: '2-digit', minute: '2-digit' });
  return `${fecha}, ${hIni} – ${hFin}`;
}

function isoToFechaLocal(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isoToHoraLocal(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

type Vista = 'detalle' | 'editar' | 'confirmar_eliminar';

type Props = {
  open: boolean;
  evento: Evento | null;
  onClose: () => void;
  onActualizar: (input: ActualizarEventoInput) => Promise<void>;
  onEliminar: (eventoId: string) => Promise<void>;
};

export function ModalDetalleEvento({ open, evento, onClose, onActualizar, onEliminar }: Props) {
  const [vista,   setVista]   = useState<Vista>('detalle');
  const [saving,  setSaving]  = useState(false);
  const [titulo,  setTitulo]  = useState('');
  const [tipo,    setTipo]    = useState<TipoEvento>('otro');
  const [fechaDia, setFechaDia]     = useState('');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFin,    setHoraFin]    = useState('');

  function abrirEdicion() {
    if (!evento) return;
    setTitulo(evento.titulo);
    setTipo(evento.tipo);
    setFechaDia(isoToFechaLocal(evento.fecha_inicio));
    setHoraInicio(isoToHoraLocal(evento.fecha_inicio));
    setHoraFin(isoToHoraLocal(evento.fecha_fin));
    setVista('editar');
  }

  function handleClose() {
    setVista('detalle');
    onClose();
  }

  async function handleGuardar() {
    if (!evento || !titulo.trim() || !fechaDia || !horaInicio || !horaFin) return;
    setSaving(true);
    try {
      await onActualizar({ eventoId: evento.id, titulo, tipo, fecha_dia: fechaDia, hora_inicio: horaInicio, hora_fin: horaFin });
      toast.success('Evento actualizado');
      setVista('detalle');
    } catch {
      toast.error('No se pudo actualizar el evento');
    } finally {
      setSaving(false);
    }
  }

  async function handleEliminar() {
    if (!evento) return;
    setSaving(true);
    try {
      await onEliminar(evento.id);
      toast.success('Evento eliminado');
      handleClose();
    } catch {
      toast.error('No se pudo eliminar el evento');
    } finally {
      setSaving(false);
    }
  }

  if (!evento) return null;

  const Icon       = TIPO_ICON[evento.tipo] ?? Calendar;
  const modalTitle =
    vista === 'confirmar_eliminar' ? 'Eliminar evento'
    : vista === 'editar'           ? 'Editar evento'
    : evento.titulo;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={modalTitle}
      analyticsId="modal-detalle-evento"
      size="sm"
      footer={
        vista === 'detalle' ? (
          <div className="flex w-full items-center justify-between gap-2">
            <Button
              variant="danger"
              size="sm"
              onClick={() => setVista('confirmar_eliminar')}
            >
              <Trash2 size={13} aria-hidden />
              Eliminar
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleClose}>Cerrar</Button>
              <Button variant="secondary" onClick={abrirEdicion}>Editar</Button>
            </div>
          </div>
        ) : vista === 'editar' ? (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setVista('detalle')}>Cancelar</Button>
            <Button variant="primary" loading={saving} onClick={() => void handleGuardar()}>
              Guardar
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setVista('detalle')}>Cancelar</Button>
            <Button variant="danger" loading={saving} onClick={() => void handleEliminar()}>
              Eliminar
            </Button>
          </div>
        )
      }
    >
      {vista === 'detalle' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--mc-radius-md)] bg-[var(--mc-color-bg-secondary)]">
              <Icon size={16} aria-hidden className="text-[var(--mc-color-text-secondary)]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--mc-color-text)]">
                {TIPO_LABEL[evento.tipo]}
              </p>
              <p className="text-xs text-[var(--mc-color-text-secondary)]">
                {formatFechaHora(evento.fecha_inicio, evento.fecha_fin)}
              </p>
              {evento.es_recurrente && (
                <p className="mt-1 text-xs text-[var(--mc-color-text-secondary)]">↻ Recurrente</p>
              )}
            </div>
          </div>
        </div>
      )}

      {vista === 'editar' && (
        <div className="flex flex-col gap-3">
          <div className="mc-field">
            <label className="mc-field-label" htmlFor="ev-titulo">Título</label>
            <input
              id="ev-titulo"
              type="text"
              className="mc-input"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              autoFocus
            />
          </div>
          <div className="mc-field">
            <label className="mc-field-label" htmlFor="ev-tipo">Tipo</label>
            <select
              id="ev-tipo"
              className="mc-input"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoEvento)}
            >
              {(Object.keys(TIPO_LABEL) as TipoEvento[]).map((t) => (
                <option key={t} value={t}>{TIPO_LABEL[t]}</option>
              ))}
            </select>
          </div>
          <div className="mc-field">
            <label className="mc-field-label" htmlFor="ev-fecha">Fecha</label>
            <input
              id="ev-fecha"
              type="date"
              className="mc-input"
              value={fechaDia}
              onChange={(e) => setFechaDia(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="mc-field">
              <label className="mc-field-label" htmlFor="ev-hora-inicio">Inicio</label>
              <input
                id="ev-hora-inicio"
                type="time"
                className="mc-input"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
              />
            </div>
            <div className="mc-field">
              <label className="mc-field-label" htmlFor="ev-hora-fin">Fin</label>
              <input
                id="ev-hora-fin"
                type="time"
                className="mc-input"
                value={horaFin}
                onChange={(e) => setHoraFin(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {vista === 'confirmar_eliminar' && (
        <p className="text-sm text-[var(--mc-color-text)]">
          ¿Eliminar <strong>"{evento.titulo}"</strong>? Esta acción no se puede deshacer.
        </p>
      )}
    </Modal>
  );
}
