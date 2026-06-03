import type { ReactNode } from 'react';

type Props = {
  title: ReactNode;
  titleId?: string;
  children: ReactNode;
  className?: string;
  alerta?: boolean;
  /** Altura mínima uniforme en grillas de análisis/operativa */
  fill?: boolean;
};

/** Contenedor mc-card unificado para bloques de Planificación. */
export function PlanificacionPanel({
  title,
  titleId,
  children,
  className = '',
  alerta = false,
  fill = false,
}: Props) {
  return (
    <section
      className={[
        'mc-card',
        'mc-plan-panel',
        alerta ? 'mc-plan-panel--alerta' : '',
        fill ? 'mc-plan-panel--fill' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-labelledby={titleId}
    >
      <h2 id={titleId} className="mc-plan-panel__title">
        {title}
      </h2>
      <div className="mc-plan-panel__body">{children}</div>
    </section>
  );
}
