import { Search, X } from 'lucide-react';

import { MiSemanaStatsInline } from '@/components/semana/MiSemanaStatsInline';

export type FiltroRapido = 'sin_iniciar' | 'atrasada' | 'critica';

const CHIPS: { key: FiltroRapido; label: string }[] = [
  { key: 'sin_iniciar', label: 'Sin iniciar' },
  { key: 'atrasada',    label: 'Atrasadas' },
  { key: 'critica',     label: 'Críticas' },
];

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
  filtroRapido: FiltroRapido | null;
  busqueda: string;
  onToggleFiltroRapido: (key: FiltroRapido) => void;
  onLimpiarFiltro: () => void;
  onBusquedaChange: (v: string) => void;
};

export function MiSemanaToolbar({
  statsItems,
  filtroActivoLabel,
  filtroRapido,
  busqueda,
  onToggleFiltroRapido,
  onLimpiarFiltro,
  onBusquedaChange,
}: Props) {
  const hayFiltro = Boolean(filtroActivoLabel || filtroRapido || busqueda);

  return (
    <div className="mc-misemana-toolbar">
      {/* Fila 1: stats + etiqueta filtro activo */}
      <div className="mc-misemana-toolbar__row">
        <div className="mc-misemana-toolbar__left">
          <MiSemanaStatsInline items={statsItems} compact />
          {filtroActivoLabel && (
            <div className="mc-misemana-toolbar__filtro" role="status" aria-live="polite">
              <span className="text-xs text-[var(--mc-color-text-secondary)]">
                Filtro: <strong className="text-[var(--mc-color-text)]">{filtroActivoLabel}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Fila 2: chip bar de filtros rápidos */}
      <div className="mc-misemana-toolbar__chips" role="group" aria-label="Filtros rápidos">
        <button
          type="button"
          className={`mc-misemana-chip${!hayFiltro ? ' mc-misemana-chip--active' : ''}`}
          onClick={onLimpiarFiltro}
          aria-pressed={!hayFiltro}
        >
          Todos
        </button>

        {CHIPS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`mc-misemana-chip${filtroRapido === key ? ' mc-misemana-chip--active' : ''}`}
            onClick={() => onToggleFiltroRapido(key)}
            aria-pressed={filtroRapido === key}
          >
            {label}
          </button>
        ))}

        {hayFiltro && (
          <button
            type="button"
            className="mc-misemana-chip mc-misemana-chip--clear"
            onClick={onLimpiarFiltro}
            aria-label="Quitar filtros"
          >
            ✕ Limpiar
          </button>
        )}

        {/* Búsqueda por texto */}
        <div className="mc-misemana-busqueda">
          <Search size={12} className="mc-misemana-busqueda__icon" aria-hidden />
          <input
            type="search"
            className="mc-misemana-busqueda__input"
            placeholder="Buscar tarea…"
            value={busqueda}
            onChange={(e) => onBusquedaChange(e.target.value)}
            aria-label="Buscar tareas por título"
          />
          {busqueda && (
            <button
              type="button"
              className="mc-misemana-busqueda__clear"
              onClick={() => onBusquedaChange('')}
              aria-label="Limpiar búsqueda"
            >
              <X size={11} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
