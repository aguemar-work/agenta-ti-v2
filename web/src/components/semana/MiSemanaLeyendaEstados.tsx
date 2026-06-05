import { TAREA_BADGE, TAREA_LABEL } from '@/lib/estadoConfig';
import type { ClaveVisualTarea } from '@/types';

const ESTADOS_LEYENDA: ClaveVisualTarea[] = [
  'pendiente',
  'en_progreso',
  'atrasada',
  'reprogramada',
  'completada',
  'cancelada',
];

type Props = {
  compact?: boolean;
  className?: string;
};

export function MiSemanaLeyendaEstados({ compact = false, className = '' }: Props) {
  const rootClass = [
    'mc-misemana-leyenda',
    compact ? 'mc-misemana-leyenda--compact' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div role="group" className={rootClass} aria-label="Leyenda de estados de tarea">
      {ESTADOS_LEYENDA.map((estado) => (
        <span key={estado} className="mc-misemana-leyenda__item">
          <span className={`mc-badge mc-badge--dot ${TAREA_BADGE[estado]}`} aria-hidden />
          <span className="mc-misemana-leyenda__label">{TAREA_LABEL[estado]}</span>
        </span>
      ))}
    </div>
  );
}
