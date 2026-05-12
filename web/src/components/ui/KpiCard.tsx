/**
 * components/ui/KpiCard.tsx
 *
 * KPI unificado para todo el sistema (Mi Semana, Planificación, Métricas).
 *
 * - `variant`: paleta semántica (neutral / warning / danger / success).
 * - `size`:    sm (contadores compactos), md (panel ejecutivo), lg (hero).
 * - `icon`:    Lucide opcional, se renderiza con el color de la variante.
 * - `onClick`: si está definido, la card es clickeable (hover con sombra).
 *
 * Reglas:
 * - Cero hex hardcodeados: todo desde tokens CSS.
 * - Para fondos coloreados solo cuando `value > 0` aplicar `emphasized={value > 0}`
 *   o pasar `bg` manualmente — el contenedor decide la semántica.
 */

import type { ElementType, KeyboardEvent } from 'react';

export type KpiVariant = 'neutral' | 'warning' | 'danger' | 'success' | 'info';
export type KpiSize    = 'sm' | 'md' | 'lg';

interface KpiCardProps {
  value:       number | string;
  label:       string;
  variant?:    KpiVariant;
  icon?:       ElementType;
  size?:       KpiSize;
  /** Cuando es true aplica fondo/borde tintados de la variante. */
  emphasized?: boolean;
  /** Skeleton (— como placeholder). */
  loading?:    boolean;
  /** Si está definido la card es clickeable y enfocable. */
  onClick?:    () => void;
  /** Marca la card como "seleccionada" (filtro activo). Fuerza emphasized + outline accent. */
  active?:     boolean;
  /** Texto extra junto al valor (ej. "▲ 3pp"). */
  trailing?:   React.ReactNode;
}

export const KPI_STYLES: Record<KpiVariant, { fg: string; bg: string; border: string }> = {
  neutral: {
    fg:     'var(--mc-color-text)',
    bg:     'var(--mc-color-bg-secondary)',
    border: 'var(--mc-color-border)',
  },
  warning: {
    fg:     'var(--mc-color-warning)',
    bg:     'color-mix(in srgb, var(--mc-color-warning) 8%, transparent)',
    border: 'color-mix(in srgb, var(--mc-color-warning) 30%, transparent)',
  },
  danger: {
    fg:     'var(--mc-color-danger)',
    bg:     'color-mix(in srgb, var(--mc-color-danger) 8%, transparent)',
    border: 'color-mix(in srgb, var(--mc-color-danger) 30%, transparent)',
  },
  success: {
    fg:     'var(--mc-color-success)',
    bg:     'color-mix(in srgb, var(--mc-color-success) 8%, transparent)',
    border: 'color-mix(in srgb, var(--mc-color-success) 30%, transparent)',
  },
  info: {
    fg:     'var(--mc-color-info)',
    bg:     'color-mix(in srgb, var(--mc-color-info) 8%, transparent)',
    border: 'color-mix(in srgb, var(--mc-color-info) 30%, transparent)',
  },
};

const SIZE_CLASS: Record<KpiSize, string> = {
  sm: 'mc-kpi-card--sm',
  md: 'mc-kpi-card--md',
  lg: 'mc-kpi-card--lg',
};

export function KpiCard({
  value,
  label,
  variant = 'neutral',
  icon: Icon,
  size = 'md',
  emphasized = false,
  loading = false,
  onClick,
  active = false,
  trailing,
}: KpiCardProps) {
  const s          = KPI_STYLES[variant];
  const clickable  = typeof onClick === 'function';
  const showTint   = (emphasized || active) && variant !== 'neutral';

  const cls = [
    'mc-kpi-card',
    SIZE_CLASS[size],
    clickable && 'mc-kpi-card--clickable',
    active    && 'mc-kpi-card--active',
  ].filter(Boolean).join(' ');

  function handleKey(e: KeyboardEvent<HTMLDivElement>) {
    if (!clickable) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  }

  return (
    <div
      className={cls}
      style={{
        background: showTint ? s.bg     : 'var(--mc-color-surface)',
        borderColor: showTint ? s.border : 'var(--mc-color-border)',
      }}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKey}
      aria-pressed={clickable ? active : undefined}
      aria-label={clickable ? `${label}: ${value}` : undefined}
    >
      {Icon ? (
        <Icon
          className="mc-kpi-card-icon"
          style={{ color: s.fg }}
          aria-hidden
        />
      ) : null}

      <div className="mc-kpi-card-body">
        <span
          className="mc-kpi-card-value"
          style={{ color: loading ? 'var(--mc-color-text-secondary)' : (variant === 'neutral' ? 'var(--mc-color-text)' : s.fg) }}
        >
          {loading ? '—' : value}
          {trailing}
        </span>
        <span className="mc-kpi-card-label">{label}</span>
      </div>
    </div>
  );
}
