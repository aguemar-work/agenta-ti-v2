import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { CSSProperties } from 'react';

import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import type { Tarea } from '@/types';

type Props = {
  tarea: Tarea;
  hoyYmd: string;
  canDrag: boolean;
  esJefe: boolean;
  asignadoNombre?: string;
  onOpenDetalle?: () => void;
  onIniciar?: () => void;
  onCompletar?: () => void;
  onBloquear?: () => void;
  onDesbloquear?: () => void;
};

const badgeClass: Record<string, string> = {
  pendiente: 'mc-badge-neutral',
  en_progreso: 'mc-badge-info',
  atrasada: 'mc-badge-danger',
  bloqueada: 'mc-badge-warning',
  completada: 'mc-badge-success',
  reprogramada: 'mc-badge-neutral',
};

const badgeLabel: Record<string, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  atrasada: 'Atrasada',
  bloqueada: 'Bloqueada',
  completada: 'Completada',
  reprogramada: 'Reprogramada',
};

export function DraggableTareaTablero({
  tarea,
  hoyYmd,
  canDrag,
  esJefe,
  asignadoNombre,
  onOpenDetalle,
  onIniciar,
  onCompletar,
  onBloquear,
  onDesbloquear,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `kanban-${tarea.id}`,
    disabled: !canDrag,
  });

  const style: CSSProperties = isDragging
    ? { opacity: 0, visibility: 'hidden', touchAction: 'none' }
    : { transform: CSS.Translate.toString(transform), touchAction: canDrag ? 'none' : undefined };
  const est = estadoEfectivoTablero(tarea, hoyYmd);
  const atrasadaBar = est === 'atrasada' ? 'border-l-2 border-[var(--mc-color-danger)]' : '';
  const bloqueadaBar = est === 'bloqueada' ? 'border-l-2 border-[var(--mc-color-warning)]' : '';

  return (
    <div ref={setNodeRef} style={style} draggable={false}>
      <div className={`mc-card !p-3 flex flex-col gap-2 ${atrasadaBar} ${bloqueadaBar}`.trim()}>
        <div className="flex items-start gap-2">
          {canDrag ? (
            <button
              type="button"
              className="mc-btn-ghost !p-0.5 mt-0.5 shrink-0 text-[var(--mc-color-text-secondary)]"
              aria-label="Arrastrar"
              {...listeners}
              {...attributes}
              style={{ touchAction: 'none' }}
              draggable={false}
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical size={14} />
            </button>
          ) : null}
          <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpenDetalle}>
            <p className="text-xs font-medium text-[var(--mc-color-text)] leading-snug line-clamp-2">{tarea.titulo}</p>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={`mc-badge ${badgeClass[est] ?? 'mc-badge-neutral'} text-[10px]`}>{badgeLabel[est] ?? est}</span>
          {asignadoNombre ? <span className="text-[10px] text-[var(--mc-color-text-secondary)]">{asignadoNombre}</span> : null}
        </div>

        {est !== 'completada' && est !== 'cancelada' ? (
          <div className="flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
            {(est === 'pendiente' || est === 'atrasada' || est === 'reprogramada') && onIniciar ? (
              <button type="button" className="mc-btn !px-3 !py-1.5 text-xs" onClick={onIniciar}>
                Iniciar
              </button>
            ) : null}
            {est === 'en_progreso' && onCompletar ? (
              <button type="button" className="mc-btn !px-3 !py-1.5 text-xs" onClick={onCompletar}>
                Completar
              </button>
            ) : null}
            {est !== 'bloqueada' && onBloquear ? (
              <button
                type="button"
                className="mc-btn-secondary !px-3 !py-1.5 text-xs !text-[var(--mc-color-warning)]"
                onClick={onBloquear}
              >
                Bloquear
              </button>
            ) : null}
            {est === 'bloqueada' && esJefe && onDesbloquear ? (
              <button
                type="button"
                className="mc-btn-secondary !px-3 !py-1.5 text-xs !text-[var(--mc-color-accent)]"
                onClick={onDesbloquear}
              >
                Desbloquear
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
