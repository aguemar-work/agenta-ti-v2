import { Search, X } from 'lucide-react';

export type FiltroRapido = 'sin_iniciar' | 'atrasada' | 'critica';

const CHIPS: { key: FiltroRapido; label: string }[] = [
  { key: 'sin_iniciar', label: 'Sin iniciar' },
  { key: 'atrasada',    label: 'Atrasadas' },
  { key: 'critica',     label: 'Críticas' },
];

type Props = {
  filtroRapido: FiltroRapido | null;
  busqueda: string;
  onToggleFiltroRapido: (key: FiltroRapido) => void;
  onLimpiarFiltro: () => void;
  onBusquedaChange: (v: string) => void;
};

export function MiSemanaToolbar({
  filtroRapido,
  busqueda,
  onToggleFiltroRapido,
  onLimpiarFiltro,
  onBusquedaChange,
}: Props) {
  const hayFiltro = Boolean(filtroRapido || busqueda);

  return (
    <div className="mc-misemana-toolbar">
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
