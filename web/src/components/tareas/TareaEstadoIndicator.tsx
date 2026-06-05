/**
 * Badge/pill de estado o situación de tarea (eje visual unificado).
 */
import {
  AlertTriangle,
  Ban,
  CalendarClock,
  CheckCircle2,
  Circle,
  PlayCircle,
  type LucideIcon,
} from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

import { TAREA_BADGE, TAREA_LABEL, TAREA_LABEL_PLURAL, TAREA_PILL } from '@/lib/estadoConfig';
import type { ClaveVisualTarea } from '@/types';

const TAREA_ESTADO_ICON: Record<ClaveVisualTarea, LucideIcon> = {
  pendiente:    Circle,
  en_progreso:  PlayCircle,
  completada:   CheckCircle2,
  atrasada:     AlertTriangle,
  reprogramada: CalendarClock,
  cancelada:    Ban,
};

type Props = {
  estado: ClaveVisualTarea;
  variant?: 'badge' | 'pill';
  plural?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

export function TareaEstadoIndicator({
  estado,
  variant = 'badge',
  plural = false,
  className = '',
  style,
  children,
}: Props) {
  const Icon = TAREA_ESTADO_ICON[estado];
  const label = plural ? TAREA_LABEL_PLURAL[estado] : TAREA_LABEL[estado];
  const classBase = variant === 'pill' ? TAREA_PILL[estado] : `mc-badge ${TAREA_BADGE[estado]}`;

  return (
    <span className={[classBase, 'mc-tarea-estado-indicator', className].filter(Boolean).join(' ')} style={style}>
      <Icon size={variant === 'pill' ? 11 : 12} strokeWidth={2} aria-hidden />
      <span>{children ?? label}</span>
    </span>
  );
}
