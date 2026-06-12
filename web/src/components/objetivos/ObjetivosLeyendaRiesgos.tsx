import type { NivelRiesgoObjetivo } from '@/types';

const NIVELES: { key: NivelRiesgoObjetivo; label: string }[] = [
  { key: 'en_ritmo', label: 'En ritmo' },
  { key: 'aceptable', label: 'Aceptable' },
  { key: 'moderado', label: 'Moderado' },
  { key: 'critico', label: 'Crítico' },
  { key: 'sin_fecha', label: 'Sin fecha' },
];

type Props = {
  className?: string;
};

export function ObjetivosLeyendaRiesgos({ className = '' }: Props) {
  const rootClass = ['mc-objetivos-leyenda', className].filter(Boolean).join(' ');

  return (
    <div role="group" className={rootClass} aria-label="Leyenda de riesgo de objetivos">
      {NIVELES.map(({ key, label }) => (
        <span key={key} className="mc-objetivos-leyenda__item">
          <span
            className={`mc-objetivos-leyenda__dot mc-objetivos-leyenda__dot--${key}`}
            aria-hidden
          />
          <span>{label}</span>
        </span>
      ))}
    </div>
  );
}
