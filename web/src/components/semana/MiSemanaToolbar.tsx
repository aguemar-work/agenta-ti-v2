import { MiSemanaStatsInline } from '@/components/semana/MiSemanaStatsInline';

type StatItem = {
  key: string;
  label: string;
  value: number;
  active?: boolean;
  disabled?: boolean;
  onClick?: (() => void) | undefined;
};

type Props = {
  statsItems: StatItem[];
  filtroActivoLabel: string | null;
  onLimpiarFiltro: () => void;
};

export function MiSemanaToolbar({ statsItems, filtroActivoLabel, onLimpiarFiltro }: Props) {
  return (
    <div className="mc-misemana-toolbar">
      <div className="mc-misemana-toolbar__left">
        <MiSemanaStatsInline items={statsItems} compact />
        {filtroActivoLabel && (
          <div className="mc-misemana-toolbar__filtro" role="status" aria-live="polite">
            <span className="text-xs text-[var(--mc-color-text-secondary)]">
              Filtro: <strong className="text-[var(--mc-color-text)]">{filtroActivoLabel}</strong>
            </span>
            <button type="button" className="mc-btn-ghost mc-btn-xs" onClick={onLimpiarFiltro}>
              Limpiar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
