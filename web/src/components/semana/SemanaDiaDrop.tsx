import { useDroppable } from '@dnd-kit/core';
import type { ReactNode } from 'react';

type Props = {
  id: string;
  children: ReactNode;
  className?: string;
  /** Hueco visual mientras se arrastra sobre la zona */
  showPlaceholder?: boolean;
};

export function SemanaDiaDrop({ id, children, className = '', showPlaceholder = false }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`mc-semana-dia-drop min-h-[100px] ${isOver ? 'mc-drop-target-active' : ''} ${className}`.trim()}
    >
      {showPlaceholder ? <div className="mc-drag-placeholder" aria-hidden /> : null}
      {children}
    </div>
  );
}
