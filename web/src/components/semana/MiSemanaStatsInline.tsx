type StatItem = {
  key: string;
  label: string;
  value: number;
  active?: boolean;
  disabled?: boolean;
  onClick?: (() => void) | undefined;
  /** Énfasis del valor (p. ej. alertas en Planificación). */
  tone?: 'default' | 'warning' | 'danger';
};

type Props = {
  items: StatItem[];
  /** Etiqueta accesible del grupo; por defecto resumen de semana. */
  ariaLabel?: string;
  /** Solo lectura: sin botones interactivos. */
  readOnly?: boolean;
  /** Una línea densa: sin separadores, espaciado entre pares. */
  compact?: boolean;
};

/** Contadores de estado en cabecera — sin cajas ni bordes (Materen Canvas denso). */
export function MiSemanaStatsInline({
  items,
  ariaLabel = 'Resumen de tareas de la semana',
  readOnly = false,
  compact = false,
}: Props) {
  return (
    <div
      className={['mc-misemana-stats', compact ? 'mc-misemana-stats--compact' : ''].filter(Boolean).join(' ')}
      role="group"
      aria-label={ariaLabel}
    >
      {items.map((item) => (
        <span key={item.key} className="mc-misemana-stats__item">
          {readOnly ? (
            <span className="mc-misemana-stats__readonly">
              <span
                className={[
                  'mc-misemana-stats__value',
                  'tabular-nums',
                  item.tone === 'warning' ? 'mc-misemana-stats__value--warning' : '',
                  item.tone === 'danger' ? 'mc-misemana-stats__value--danger' : '',
                ].filter(Boolean).join(' ')}
              >
                {item.value}
              </span>
              <span className="mc-misemana-stats__label">{item.label}</span>
            </span>
          ) : (
            <button
              type="button"
              className={[
                'mc-misemana-stats__btn',
                item.active ? 'mc-misemana-stats__btn--active' : '',
                item.disabled ? 'mc-misemana-stats__btn--disabled' : '',
              ].filter(Boolean).join(' ')}
              disabled={item.disabled}
              aria-pressed={item.active}
              onClick={item.disabled ? undefined : item.onClick}
            >
              <span
                className={[
                  'mc-misemana-stats__value',
                  'tabular-nums',
                  item.tone === 'warning' ? 'mc-misemana-stats__value--warning' : '',
                  item.tone === 'danger' ? 'mc-misemana-stats__value--danger' : '',
                ].filter(Boolean).join(' ')}
              >
                {item.value}
              </span>
              <span className="mc-misemana-stats__label">{item.label}</span>
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
