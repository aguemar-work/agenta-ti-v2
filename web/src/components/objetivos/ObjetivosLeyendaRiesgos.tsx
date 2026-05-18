import { RIESGO_CONFIG } from '@/lib/tareaUrgencia';
import type { NivelRiesgoObjetivo } from '@/types';

const NIVELES: { key: NivelRiesgoObjetivo; label: string }[] = [
  { key: 'en_ritmo',  label: 'En ritmo' },
  { key: 'aceptable', label: 'Aceptable' },
  { key: 'moderado',  label: 'Moderado' },
  { key: 'critico',   label: 'Crítico' },
  { key: 'sin_fecha', label: 'Sin fecha' },
];

type Props = {
  compact?: boolean;
  className?: string;
};

export function ObjetivosLeyendaRiesgos({ compact = false, className = '' }: Props) {
  const rootClass = [
    'mc-objetivos-leyenda',
    compact ? 'mc-objetivos-leyenda--compact' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div role="group" className={rootClass} aria-label="Leyenda de riesgo de objetivos">
      {NIVELES.map(({ key, label }) => {
        const c = RIESGO_CONFIG[key];
        return (
          <span key={key} className="mc-objetivos-leyenda__item">
            <span
              className="mc-objetivos-leyenda__dot"
              style={{ background: key === 'sin_fecha' ? 'var(--mc-color-border)' : c.barColor }}
              aria-hidden
            />
            <span>{label}</span>
          </span>
        );
      })}
    </div>
  );
}
