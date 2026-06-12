import type { EstadoOT } from '@/api/ordenTrabajo';
import { OTFlujoEstados } from '@/components/ot/OTFlujoEstados';
import { MiSemanaStatsInline } from '@/components/semana/MiSemanaStatsInline';
import { FilterBar } from '@/components/ui/FilterBar';
import type { FiltroEstadoOT } from '@/hooks/useOrdenesTrabajoPage';

type StatItem = {
  key: string;
  label: string;
  value: number;
  active?: boolean;
  disabled?: boolean;
  onClick?: (() => void) | undefined;
};

type PillOption = { value: FiltroEstadoOT; label: string; badge?: number };

type Props = {
  statsItems: StatItem[];
  filtroActivoLabel: string | null;
  onLimpiarFiltro: () => void;
  filtroPillsValue: FiltroEstadoOT;
  onFiltroPillsChange: (v: FiltroEstadoOT) => void;
  pillOptions: PillOption[];
  filtroEspecificoValue: string;
  onFiltroEspecificoChange: (v: string) => void;
  estadosEspecificos: { value: EstadoOT; label: string }[];
  estadoFlujoDestacado?: EstadoOT | null;
};

export function OTToolbar({
  statsItems,
  filtroActivoLabel,
  onLimpiarFiltro,
  filtroPillsValue,
  onFiltroPillsChange,
  pillOptions,
  filtroEspecificoValue,
  onFiltroEspecificoChange,
  estadosEspecificos,
  estadoFlujoDestacado = null,
}: Props) {
  return (
    <div className="mc-misemana-toolbar">
      <div className="mc-misemana-toolbar__left">
        <MiSemanaStatsInline items={statsItems} ariaLabel="Resumen de órdenes de trabajo" />
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
      <div className="mc-misemana-toolbar__right mc-ot-toolbar__right">
        <FilterBar.Pills
          groupLabel="Filtrar órdenes de trabajo por estado"
          value={pillOptions.some((p) => p.value === filtroPillsValue) ? filtroPillsValue : 'todos'}
          onChange={(v) => onFiltroPillsChange(v as FiltroEstadoOT)}
          options={pillOptions}
        />
        <FilterBar.Select
          id="ot-filtro-estado"
          label="Estado"
          value={filtroEspecificoValue}
          onChange={onFiltroEspecificoChange}
          minWidth={130}
          options={[
            { value: '', label: '— Todos —' },
            ...estadosEspecificos.map(({ value, label }) => ({ value, label })),
          ]}
        />
        <OTFlujoEstados compact estadoDestacado={estadoFlujoDestacado} className="mc-misemana-toolbar__leyenda" />
      </div>
    </div>
  );
}
