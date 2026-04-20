import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { CSSProperties } from 'react';

import { TaskItem } from '@/components/tareas/TaskItem';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import type { Tarea } from '@/types';

type Props = {
  tarea: Tarea;
  hoyYmd: string;
  readOnly?: boolean;
  onOpenDetalle?: (t: Tarea) => void;
  onEditar?: (t: Tarea) => void;
  onEliminar?: (t: Tarea) => void;
  onCompletar?: (t: Tarea) => void;
  onIniciar?: (t: Tarea) => void;
};

export function DraggableTareaSemana({
  tarea,
  hoyYmd,
  readOnly,
  onOpenDetalle,
  onEditar,
  onEliminar,
  onCompletar,
  onIniciar,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `tarea-${tarea.id}`,
    disabled: readOnly,
  });

  const translate = CSS.Translate.toString(transform);
  const style: CSSProperties = {
    transform: isDragging ? `${translate} rotate(2deg)` : translate,
    opacity: isDragging ? 0.25 : 1,
    boxShadow: isDragging
      ? '0 18px 44px -8px rgba(0, 0, 0, 0.28), 0 8px 16px -6px rgba(0, 0, 0, 0.16)'
      : undefined,
    zIndex: isDragging ? 40 : undefined,
    position: isDragging ? 'relative' : undefined,
    touchAction: readOnly ? undefined : 'none',
  };

  const est = estadoEfectivoTablero(tarea, hoyYmd);

  return (
    <div ref={setNodeRef} style={style}>
      <TaskItem
        variant="week"
        tarea={tarea}
        readOnly={readOnly}
        estadoVisual={est}
        dragHandle={
          !readOnly ? (
            <button
              type="button"
              className="mc-btn-ghost !p-1 text-[var(--mc-color-text-secondary)]"
              aria-label="Arrastrar tarea"
              {...listeners}
              {...attributes}
            >
              <GripVertical size={16} />
            </button>
          ) : undefined
        }
        onOpenDetalle={onOpenDetalle}
        onEditar={onEditar}
        onEliminar={onEliminar}
        onCompletar={onCompletar}
        onIniciar={onIniciar}
      />
    </div>
  );
}
