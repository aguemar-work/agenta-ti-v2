import { useDroppable } from '@dnd-kit/core';
import type { ReactNode } from 'react';

import type { ColumnaTableroId } from '@/api/tablero';

const titulos: Record<ColumnaTableroId, string> = {
  pendiente: 'POR HACER',
  en_progreso: 'EN PROGRESO',
  bloqueada: 'BLOQUEADO',
  completada: 'COMPLETADO',
};

type Props = {
  columna: ColumnaTableroId;
  children: ReactNode;
  /** Hueco punteado donde aterrizará la tarjeta al arrastrar sobre esta columna. */
  showPlaceholder?: boolean;
};

export function ColumnaKanban({ columna, children, showPlaceholder }: Props) {
  const id = `col:${columna}`;
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="mc-kanban-col">
      <div className="mc-kanban-col-head">{titulos[columna]}</div>
      <div
        ref={setNodeRef}
        className={`mc-kanban-col-body ${isOver ? 'mc-drop-target-active' : ''}`.trim()}
      >
        {showPlaceholder ? <div className="mc-drag-placeholder" aria-hidden /> : null}
        {children}
      </div>
    </div>
  );
}
