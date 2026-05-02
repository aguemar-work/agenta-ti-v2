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
  completada: 'Activa «Mostrar completadas» en los filtros para ver las tareas de los últimos 7 días.',
};

const emptySubtext: Record<ColumnaTableroId, string | null> = {
  pendiente: null,
  en_progreso: null,
  bloqueada: null,
  completada: 'Las tareas completadas se ocultan por defecto para mantener el tablero limpio.',
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
          <div className="flex flex-col items-center justify-center gap-2 py-8 px-4 text-center">
            <span className="text-2xl opacity-30">{emptyIcon[columna]}</span>
            <p className="text-xs font-medium text-[var(--mc-color-text-secondary)] leading-relaxed">{emptyText[columna]}</p>
            {emptySubtext[columna] && (
              <p className="text-[10px] text-[var(--mc-color-text-secondary)] opacity-70 leading-relaxed">{emptySubtext[columna]}</p>
            )}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}