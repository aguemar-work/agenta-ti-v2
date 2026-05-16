/**
 * Badge/pill de estado de tarea: texto + icono (no solo color) para daltonismo.
 */
import {
  AlertTriangle,
  Ban,
  CalendarClock,
  CheckCircle2,
  Circle,
  Lock,
  PlayCircle,
  type LucideIcon,
} from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

import { TAREA_BADGE, TAREA_LABEL, TAREA_LABEL_PLURAL, TAREA_PILL } from '@/lib/estadoConfig';
import type { EstadoTarea } from '@/types';

const TAREA_ESTADO_ICON: Record<EstadoTarea, LucideIcon> = {
  pendiente:    Circle,
  en_progreso:  PlayCircle,
  completada:   CheckCircle2,
  bloqueada:    Lock,
  atrasada:     AlertTriangle,
  reprogramada: CalendarClock,
  cancelada:    Ban,
};

type Props = {
  estado: EstadoTarea;
  variant?: 'badge' | 'pill';
  /** Usar etiqueta en plural (tablas de planificación). */
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
