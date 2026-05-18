import { TAREA_BADGE, TAREA_LABEL } from '@/lib/estadoConfig';
import type { EstadoTarea } from '@/types';

const ESTADOS_LEYENDA: EstadoTarea[] = [
  'pendiente',
  'en_progreso',
  'atrasada',
  'reprogramada',
  'bloqueada',
  'completada',
  'cancelada',
];

type Props = {
  /** En toolbar: sin borde superior ni fondo de pie de grilla. */
  compact?: boolean;
  className?: string;
};

/** Leyenda de estados de tarea — compacta, sin cajas. */
export function MiSemanaLeyendaEstados({ compact = false, className = '' }: Props) {
  const rootClass = [
    'mc-misemana-leyenda',
    compact ? 'mc-misemana-leyenda--compact' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      role="group"
      className={rootClass}
      aria-label="Leyenda de estados de tarea"
    >
      {ESTADOS_LEYENDA.map((estado) => (
        <span key={estado} className="mc-misemana-leyenda__item">
          <span className={`mc-badge mc-badge--dot ${TAREA_BADGE[estado]}`} aria-hidden />
          <span className="mc-misemana-leyenda__label">{TAREA_LABEL[estado]}</span>
        </span>
      ))}
    </div>
  );
}
