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
  /** Título del objetivo vinculado (si existe). */
  objetivoTitulo?: string | null;
  readOnly?: boolean;
  onOpenDetalle?: (t: Tarea) => void;
};

export function DraggableTareaSemana({
  tarea,
  hoyYmd,
  objetivoTitulo,
  readOnly,
  onOpenDetalle,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `tarea-${tarea.id}`,
    disabled: readOnly,
  });

  const style: CSSProperties = isDragging
    ? {
        opacity: 0,
        visibility: 'hidden',
        touchAction: readOnly ? undefined : 'none',
      }
    : {
        transform: CSS.Translate.toString(transform),
        touchAction: readOnly ? undefined : 'none',
      };

  const est = estadoEfectivoTablero(tarea, hoyYmd);

  return (
    <div ref={setNodeRef} style={style} draggable={false} onDragStart={(e) => e.preventDefault()}>
      <div
        className="mc-semana-task-card"
        onClick={() => onOpenDetalle?.(tarea)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onOpenDetalle?.(tarea);
        }}
      >
        <div className="mc-semana-task-card__row-top">
          {!readOnly ? (
            <button
              type="button"
              className="mc-btn-ghost !p-0.5 shrink-0 text-[var(--mc-color-text-secondary)]"
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
          <p className="mc-semana-task-card__title">{tarea.titulo}</p>
        </div>

        <div className="mc-semana-task-card__footer">
          <span className={`mc-badge ${TAREA_BADGE[est] ?? 'mc-badge-neutral'}`} style={{ fontSize: 10 }}>
            {TAREA_LABEL[est] ?? est}
          </span>
          <span className="mc-semana-task-card__objetivo">
            {objetivoTitulo?.trim() ? objetivoTitulo : '\u00a0'}
          </span>
        </div>
      </div>
    </div>
  );
}
