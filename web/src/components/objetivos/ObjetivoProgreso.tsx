import { nivelRiesgoObjetivo, RIESGO_CONFIG } from '@/lib/tareaUrgencia';

type BarraProps = {
  pct: number;
  fechaLimite: string | null;
  size?: 'sm' | 'md';
  totalTareas?: number;
};

export function ObjetivoBarraProgreso({ pct, fechaLimite, size = 'sm', totalTareas }: BarraProps) {
  const nivel = nivelRiesgoObjetivo(pct, fechaLimite, totalTareas);
  const h = size === 'md' ? 8 : 5;
  const bgTrack =
    nivel === 'sin_fecha'
      ? 'var(--mc-color-border)'
      : nivel === 'critico'
        ? 'var(--mc-state-atrasada-bar-soft)'
        : nivel === 'moderado'
          ? 'var(--mc-state-precaucion-bar-soft)'
          : 'var(--mc-state-completada-bar-soft)';

  return (
    <div
      className="mc-objetivo-barra"
      role="progressbar"
      aria-valuenow={Math.min(pct, 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="mc-objetivo-barra__track" style={{ height: h, background: bgTrack }}>
        <div
          className="mc-objetivo-barra__fill"
          style={{
            width: `${Math.min(pct, 100)}%`,
            height: h,
            background: RIESGO_CONFIG[nivel].barColor,
          }}
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
    <span
      className="mc-objetivo-badge-riesgo"
      style={{ background: config.bgColor, color: config.textColor }}
    >
      {config.label}
    </span>
  );
}
