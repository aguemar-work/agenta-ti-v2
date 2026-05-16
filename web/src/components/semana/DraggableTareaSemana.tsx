import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { CSSProperties } from 'react';

import type { OrdenTrabajo } from '@/api/ordenTrabajo';
import { TareaEstadoIndicator } from '@/components/tareas/TareaEstadoIndicator';
import { TareaMetaChips } from '@/components/tareas/TareaMetaChips';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import type { Tarea } from '@/types';

type Props = {
  tarea: Tarea;
  hoyYmd: string;
  compact?: boolean;
  objetivoTitulo?: string | null;
  ot?: OrdenTrabajo | null;
  readOnly?: boolean;
  onOpenDetalle?: (t: Tarea) => void;
  onOtClick?: (ot: OrdenTrabajo) => void;
};

export function DraggableTareaSemana({
  tarea,
  hoyYmd,
  compact = false,
  objetivoTitulo,
  ot,
  readOnly,
  onOpenDetalle,
  onOtClick,
}: Props) {
  const dragBloqueado =
    readOnly || tarea.estado === 'completada' || tarea.estado === 'cancelada';

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `tarea-${tarea.id}`,
    disabled: dragBloqueado,
  });

  const style: CSSProperties = isDragging
    ? {
        opacity: 0,
        visibility: 'hidden',
        touchAction: dragBloqueado ? undefined : 'none',
      }
    : {
        transform: CSS.Translate.toString(transform),
        touchAction: dragBloqueado ? undefined : 'none',
      };

  const est = estadoEfectivoTablero(tarea, hoyYmd);

  if (compact) {
    return (
      <div ref={setNodeRef} style={style} draggable={false} onDragStart={(e) => e.preventDefault()}>
        <div
          className="mc-semana-task-card mc-semana-task-card--compact"
          onClick={() => onOpenDetalle?.(tarea)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onOpenDetalle?.(tarea);
          }}
        >
          {!dragBloqueado ? (
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
              <GripVertical size={14} aria-hidden />
            </button>
          ) : dragBloqueado && !readOnly ? (
            <span
              className="shrink-0 text-[var(--mc-color-text-secondary)] opacity-40"
              title="No se puede mover una tarea completada o cancelada"
              aria-hidden
            >
              <GripVertical size={14} />
            </span>
          ) : null}
          <p className="mc-semana-task-card__title flex-1 truncate">{tarea.titulo}</p>
          <TareaEstadoIndicator estado={est} style={{ fontSize: 10 }} />
          <TareaMetaChips tarea={tarea} hoyYmd={hoyYmd} ot={ot ?? null} {...(onOtClick ? { onOtClick } : {})} />
        </div>
      </div>
    );
  }

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
          {!dragBloqueado ? (
            <button
              type="button"
              className="mc-btn-ghost !p-0.5 shrink-0 text-[var(--mc-color-text-secondary)]"
              aria-label="Arrastrar tarea"
              {...listeners}
              {...attributes}
              style={{ touchAction: 'none', cursor: 'grab' }}
              draggable={false}
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical size={14} aria-hidden />
            </button>
          ) : dragBloqueado && !readOnly ? (
            <span
              className="shrink-0 cursor-not-allowed text-[var(--mc-color-text-secondary)] opacity-40"
              title="No se puede mover una tarea completada o cancelada"
              aria-hidden
            >
              <GripVertical size={14} />
            </span>
          ) : null}
          <p className="mc-semana-task-card__title">{tarea.titulo}</p>
        </div>

        <div className="mc-semana-task-card__footer">
          <TareaEstadoIndicator estado={est} style={{ fontSize: 10 }} />
          <span className="mc-semana-task-card__objetivo">
            {objetivoTitulo?.trim() ? objetivoTitulo : '\u00a0'}
          </span>
          <TareaMetaChips tarea={tarea} hoyYmd={hoyYmd} ot={ot ?? null} {...(onOtClick ? { onOtClick } : {})} />
        </div>
      </div>
    </div>
  );
}
