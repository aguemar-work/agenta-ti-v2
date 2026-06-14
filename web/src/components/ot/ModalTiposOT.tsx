import { Plus, Settings2, ToggleLeft, ToggleRight } from 'lucide-react';

import { markModalCompleted, Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { TipoTrabajoOT } from '@/api/ordenTrabajo';

type Props = {
  open: boolean;
  tiposActivos: TipoTrabajoOT[];
  tiposInactivos: TipoTrabajoOT[];
  nuevoTipoNombre: string;
  setNuevoTipoNombre: (v: string) => void;
  canCrearTipo: boolean;
  onClose: () => void;
  onCrear: () => void;
  onToggle: (input: { id: string; activo: boolean }) => void;
  isPendingToggle?: boolean;
  isPendingCrear?: boolean;
};

export function ModalTiposOT({
  open,
  tiposActivos,
  tiposInactivos,
  nuevoTipoNombre,
  setNuevoTipoNombre,
  canCrearTipo,
  onClose,
  onCrear,
  onToggle,
  isPendingToggle,
  isPendingCrear,
}: Props) {
  function handleCrear() {
    onCrear();
    markModalCompleted('modal-tipos-ot');
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tipos de trabajo"
      analyticsId="modal-tipos-ot"
      size="md"
      footer={(
        <Button variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-sm text-[var(--mc-color-text-secondary)]">
          <Settings2 size={16} aria-hidden />
          <span>{tiposActivos.length} activo{tiposActivos.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="flex gap-2">
          <input
            className="mc-input flex-1"
            value={nuevoTipoNombre}
            onChange={(e) => setNuevoTipoNombre(e.target.value.toUpperCase())}
            placeholder="Ej: REVISIÓN DE INFRAESTRUCTURA"
            onKeyDown={(e) => { if (e.key === 'Enter' && canCrearTipo) handleCrear(); }}
            maxLength={60}
          />
          <Button variant="primary" size="sm" loading={isPendingCrear} disabled={!canCrearTipo} onClick={handleCrear}>
            <Plus size={14} aria-hidden /> Agregar
          </Button>
        </div>

        <div className="flex flex-col gap-1">
          {tiposActivos.map((tipo) => (
            <div
              key={tipo.id}
              className="flex items-center justify-between rounded-[var(--mc-radius-md)] border border-[var(--mc-color-border)] bg-[var(--mc-color-surface)] px-3 py-2"
            >
              <span className="text-sm font-medium text-[var(--mc-color-text)]">{tipo.nombre}</span>
              <button
                type="button"
                className="mc-btn-ghost text-xs font-medium text-[var(--mc-color-success)]"
                onClick={() => onToggle({ id: tipo.id, activo: false })}
                disabled={isPendingToggle}
              >
                <ToggleRight size={16} aria-hidden /> Activo
              </button>
            </div>
          ))}

          {tiposInactivos.length > 0 && (
            <>
              <p className="pt-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--mc-color-text-secondary)]">
                Inactivos
              </p>
              {tiposInactivos.map((tipo) => (
                <div
                  key={tipo.id}
                  className="flex items-center justify-between rounded-[var(--mc-radius-md)] border border-[var(--mc-color-border)] bg-[var(--mc-color-bg)] px-3 py-2 opacity-60"
                >
                  <span className="text-sm text-[var(--mc-color-text-secondary)] line-through">{tipo.nombre}</span>
                  <button
                    type="button"
                    className="mc-btn-ghost text-xs text-[var(--mc-color-text-secondary)]"
                    onClick={() => onToggle({ id: tipo.id, activo: true })}
                    disabled={isPendingToggle}
                  >
                    <ToggleLeft size={16} aria-hidden /> Reactivar
                  </button>
                </div>
              ))}
            </>
          )}

          {tiposActivos.length === 0 && tiposInactivos.length === 0 && (
            <p className="text-sm text-[var(--mc-color-text-secondary)]">Sin tipos de trabajo configurados.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
