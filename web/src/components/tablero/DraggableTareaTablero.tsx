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
  canDrag: boolean;
  asignadoNombre?: string;
  objetivoTitulo?: string | null;
  onOpenDetalle?: () => void;
  onIniciar?: () => void;
  onCompletar?: () => void;
};

export function DraggableTareaTablero({
  tarea,
  hoyYmd,
  canDrag,
  asignadoNombre,
  objetivoTitulo,
  onOpenDetalle,
  onIniciar,
  onCompletar,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `kanban-${tarea.id}`,
    disabled: !canDrag,
  });

  const translate = CSS.Translate.toString(transform);
  const style: CSSProperties = {
    transform: isDragging ? `${translate} rotate(2deg)` : translate,
    opacity: isDragging ? 0.25 : 1,
    boxShadow: isDragging ? 'var(--mc-card-shadow-drag)' : undefined,
    zIndex: isDragging ? 50 : undefined,
    position: isDragging ? 'relative' : undefined,
  };

  const est = estadoEfectivoTablero(tarea, hoyYmd);

  return (
    <div ref={setNodeRef} style={style}>
      <TaskItem
        variant="kanban"
        tarea={tarea}
        readOnly={!canDrag}
        estadoVisual={est}
        asignadoNombre={asignadoNombre}
        objetivoTitulo={objetivoTitulo}
        dragHandle={
          canDrag ? (
            <button
              type="button"
              className="mc-btn-ghost shrink-0 !p-1 text-[var(--mc-color-text-secondary)]"
              aria-label="Arrastrar tarea"
              {...listeners}
              {...attributes}
            >
              <GripVertical size={18} />
            </button>
          ) : undefined
        }
        onOpenDetalle={onOpenDetalle ? () => onOpenDetalle() : undefined}
        onIniciar={onIniciar ? () => onIniciar() : undefined}
        onCompletar={onCompletar ? () => onCompletar() : undefined}
      />
    </div>
  );
}
