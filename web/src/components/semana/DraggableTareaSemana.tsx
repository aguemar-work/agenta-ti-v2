import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { CSSProperties } from 'react';

import type { OrdenTrabajo } from '@/api/ordenTrabajo';
import { TareaEstadoIndicator } from '@/components/tareas/TareaEstadoIndicator';
import { ESTADO_OT_LABEL } from '@/lib/otConfig';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import type { Tarea } from '@/types';

type Props = {
  tarea: Tarea;
  hoyYmd: string;
  ot?: OrdenTrabajo | null;
  readOnly?: boolean;
  onOpenDetalle?: (t: Tarea) => void;
  onOtClick?: (ot: OrdenTrabajo) => void;
};

/** Tarjeta en grilla semanal: título + estado (+ chip OT si aplica). */
export function DraggableTareaSemana({
  tarea,
  hoyYmd,
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
  const lineThrough = est === 'completada' || est === 'cancelada';
  const descripcionTip = tarea.descripcion?.trim() || undefined;

  return (
    <div ref={setNodeRef} style={style} draggable={false} onDragStart={(e) => e.preventDefault()}>
      <div
        className={[
          'mc-semana-task-card',
          'mc-semana-task-card--stacked',
          lineThrough ? 'mc-semana-task-card--done' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => onOpenDetalle?.(tarea)}
        role="button"
        tabIndex={0}
        title={descripcionTip}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onOpenDetalle?.(tarea);
        }}
      >
        {!dragBloqueado ? (
          <button
            type="button"
            className="mc-semana-task-card__grip"
            aria-label="Arrastrar tarea"
            {...listeners}
            {...attributes}
            style={{ touchAction: 'none' }}
            draggable={false}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={14} aria-hidden />
          </button>
        ) : (
          <span className="mc-semana-task-card__grip mc-semana-task-card__grip--muted" aria-hidden>
            <GripVertical size={14} />
          </span>
        )}

        <div className="mc-semana-task-card__body">
          <p
            className={`mc-semana-task-card__title ${lineThrough ? 'line-through opacity-60' : ''}`}
          >
            {tarea.titulo}
          </p>
          <div className="mc-semana-task-card__meta">
            <TareaEstadoIndicator estado={est} variant="pill" />
            {ot &&
              (onOtClick ? (
                <button
                  type="button"
                  className="mc-chip mc-chip--ot"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOtClick(ot);
                  }}
                  title={`OT ${ot.numero}: ${ESTADO_OT_LABEL[ot.estado]}`}
                >
                  OT · {ESTADO_OT_LABEL[ot.estado]}
                </button>
              ) : (
                <span className="mc-chip mc-chip--ot" title={`OT ${ot.numero}`}>
                  OT · {ESTADO_OT_LABEL[ot.estado]}
                </span>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
