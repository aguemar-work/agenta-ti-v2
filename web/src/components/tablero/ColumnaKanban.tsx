import { useDroppable } from '@dnd-kit/core';
import type { ReactNode } from 'react';

import type { ColumnaTableroId } from '@/api/tablero';

const titulos: Record<ColumnaTableroId, string> = {
  pendiente: 'Por hacer',
  en_progreso: 'En progreso',
  bloqueada: 'BLOQUEADO',
  completada: 'Completado',
};

const emptyIcon: Record<ColumnaTableroId, string> = {
  pendiente: '📋',
  en_progreso: '⚡',
  bloqueada: '🔒',
  completada: '✓',
};

const emptyText: Record<ColumnaTableroId, string> = {
  pendiente: 'Sin tareas pendientes',
  en_progreso: 'Nada en progreso',
  bloqueada: 'Sin tareas bloqueadas',
  completada: 'Sin tareas completadas',
};

type Props = {
  columna: ColumnaTableroId;
  count: number;
  children: ReactNode;
  /** Hueco punteado donde aterrizará la tarjeta al arrastrar sobre esta columna. */
  showPlaceholder?: boolean;
};

export function ColumnaKanban({ columna, count, children, showPlaceholder }: Props) {
  const id = `col:${columna}`;
  const { setNodeRef, isOver } = useDroppable({ id });
  const isEmpty = count === 0 && !showPlaceholder;

  return (
    <div className="mc-kanban-col">
      <div className="mc-kanban-col-head flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--mc-color-text-secondary)]">
          {titulos[columna]}
        </span>
        <span className="rounded-full bg-[var(--mc-color-bg-secondary)] px-2 py-0.5 text-xs font-medium text-[var(--mc-color-text-secondary)]">
          {count}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`mc-kanban-col-body min-h-[180px] ${isOver ? 'mc-drop-target-active' : ''}`.trim()}
      >
        {showPlaceholder ? <div className="mc-drag-placeholder" aria-hidden /> : null}
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <span className="text-2xl opacity-30">{emptyIcon[columna]}</span>
            <p className="text-xs text-[var(--mc-color-text-secondary)]">{emptyText[columna]}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
