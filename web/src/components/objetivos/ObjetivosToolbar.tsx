import { ObjetivosLeyendaRiesgos } from '@/components/objetivos/ObjetivosLeyendaRiesgos';
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

export function ObjetivosToolbar({ statsItems, filtroActivoLabel, onLimpiarFiltro }: Props) {
  return (
    <div className="mc-misemana-toolbar">
      <div className="mc-misemana-toolbar__left">
        <MiSemanaStatsInline items={statsItems} />
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
      <div className="mc-misemana-toolbar__right">
        <ObjetivosLeyendaRiesgos compact className="mc-misemana-toolbar__leyenda" />
      </div>
    </div>
  );
}
