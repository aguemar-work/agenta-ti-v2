type StatItem = {
  key: string;
  label: string;
  value: number;
  active?: boolean;
  disabled?: boolean;
  onClick?: (() => void) | undefined;
};

type Props = {
  items: StatItem[];
  /** Etiqueta accesible del grupo; por defecto resumen de semana. */
  ariaLabel?: string;
  /** Solo lectura: sin botones interactivos. */
  readOnly?: boolean;
};

/** Contadores de estado en cabecera — sin cajas ni bordes (Meta Canvas denso). */
export function MiSemanaStatsInline({ items, ariaLabel = 'Resumen de tareas de la semana', readOnly = false }: Props) {
  return (
    <div
      className="mc-misemana-stats"
      role="group"
      aria-label={ariaLabel}
    >
      {items.map((item, i) => (
        <span key={item.key} className="mc-misemana-stats__item">
          {i > 0 ? <span className="mc-misemana-stats__sep" aria-hidden>·</span> : null}
          {readOnly ? (
            <span className="mc-misemana-stats__readonly">
              <span className="mc-misemana-stats__value tabular-nums">{item.value}</span>
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
              <span className="mc-misemana-stats__value tabular-nums">{item.value}</span>
              <span className="mc-misemana-stats__label">{item.label}</span>
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
