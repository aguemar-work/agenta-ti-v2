import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { CSSProperties } from 'react';

import { TAREA_BADGE, TAREA_LABEL } from '@/lib/estadoConfig';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import type { Tarea } from '@/types';

type Props = {
  tarea: Tarea;
  hoyYmd: string;
  readOnly?: boolean;
  onOpenDetalle?: (t: Tarea) => void;
};

export function DraggableTareaSemana({
  tarea,
  hoyYmd,
  readOnly,
  onOpenDetalle,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `tarea-${tarea.id}`,
    disabled: readOnly,
  });

  const style: CSSProperties = isDragging
    ? {
        // Sin transform mientras se arrastra: evita salto/flicker del original.
        opacity: 0,
        visibility: 'hidden',
        touchAction: readOnly ? undefined : 'none',
      }
    : {
        transform: CSS.Translate.toString(transform),
        touchAction: readOnly ? undefined : 'none',
      };

  const est = estadoEfectivoTablero(tarea, hoyYmd);
  const atrasadaBar = est === 'atrasada' ? 'border-l-2 border-[var(--mc-color-danger)]' : '';
  const bloqueadaBar = est === 'bloqueada' ? 'border-l-2 border-[var(--mc-color-warning)]' : '';

  return (
    <div ref={setNodeRef} style={style} draggable={false} onDragStart={(e) => e.preventDefault()}>
      <div
        className={`mc-card !p-2 flex items-start gap-2 cursor-pointer hover:border-[var(--mc-color-border-hover)] ${atrasadaBar} ${bloqueadaBar}`.trim()}
        onClick={() => onOpenDetalle?.(tarea)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onOpenDetalle?.(tarea);
        }}
      >
        {!readOnly ? (
          <button
            type="button"
            className="mc-btn-ghost !p-0.5 mt-0.5 shrink-0 text-[var(--mc-color-text-secondary)]"
            aria-label="Arrastrar tarea"
            {...listeners}
            {...attributes}
            style={{ touchAction: 'none' }}
            draggable={false}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={14} />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[var(--mc-color-text)] leading-snug mb-1 line-clamp-2">{tarea.titulo}</p>
          <span className={`mc-badge ${TAREA_BADGE[est] ?? 'mc-badge-neutral'} text-[10px]`}>{TAREA_LABEL[est] ?? est}</span>
        </div>
      </div>
    </div>
  );
}
