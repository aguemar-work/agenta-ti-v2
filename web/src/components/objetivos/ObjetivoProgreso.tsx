import { nivelRiesgoObjetivo, RIESGO_CONFIG } from '@/lib/tareaUrgencia';
import type { NivelRiesgoObjetivo } from '@/types';

type BarraProps = {
  pct: number;
  fechaLimite: string | null;
  size?: 'sm' | 'md';
  totalTareas?: number;
};

function claseNivel(nivel: NivelRiesgoObjetivo, base: string): string {
  return `${base} ${base}--${nivel}`;
}

export function ObjetivoBarraProgreso({ pct, fechaLimite, size = 'sm', totalTareas }: BarraProps) {
  const nivel = nivelRiesgoObjetivo(pct, fechaLimite, totalTareas);
  const h = size === 'md' ? 8 : 5;

  return (
    <div
      className="mc-objetivo-barra"
      role="progressbar"
      aria-valuenow={Math.min(pct, 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={claseNivel(nivel, 'mc-objetivo-barra__track')}
        style={{ height: h }}
      >
        <div
          className={claseNivel(nivel, 'mc-objetivo-barra__fill')}
          style={{ width: `${Math.min(pct, 100)}%`, height: h }}
        />
      </div>
    </div>
  );
}

export function ObjetivoBadgeRiesgo({ pct, fechaLimite, totalTareas }: BarraProps) {
  const nivel = nivelRiesgoObjetivo(pct, fechaLimite, totalTareas);
  const config = RIESGO_CONFIG[nivel];
  if (nivel === 'sin_fecha' || nivel === 'en_ritmo') return null;

  return (
    <span className={claseNivel(nivel, 'mc-objetivo-badge-riesgo')}>
      {config.label}
    </span>
  );
}

/** Clase de color para meta de progreso (p. ej. fila de tabla o detalle). */
export function claseProgresoMetaNivel(nivel: NivelRiesgoObjetivo): string {
  if (nivel === 'critico' || nivel === 'moderado' || nivel === 'aceptable') {
    return `mc-objetivo-row__progreso-meta--${nivel}`;
  }
  return '';
}
