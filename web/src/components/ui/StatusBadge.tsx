/**
 * StatusBadge — pill con punto + fondo suave + texto (tokens --ds-*).
 * Siempre: dot 5px + label; sin borde; solo background.
 */

export type StatusBadgeStatus =
  | 'pendiente'
  | 'en_progreso'
  | 'completada'
  | 'atrasada'
  | 'reprogramada'
  | 'reunion';

const STATUS_LABELS: Record<StatusBadgeStatus, string> = {
  pendiente:    'Pendiente',
  en_progreso:  'En progreso',
  completada:   'Completada',
  atrasada:     'Atrasada',
  reprogramada: 'Reprogramada',
  reunion:      'Reunión',
};

type Props = {
  status: StatusBadgeStatus;
  /** Sustituye el texto por defecto (el dot y el estilo siguen fijos). */
  label?: string;
  className?: string;
};

export function StatusBadge({ status, label, className }: Props) {
  const text = label ?? STATUS_LABELS[status];

  return (
    <span
      className={['ds-status-badge', `ds-status-badge--${status}`, className].filter(Boolean).join(' ')}
      role="status"
    >
      <span className="ds-status-badge__dot" aria-hidden />
      <span className="ds-status-badge__label">{text}</span>
    </span>
  );
}
