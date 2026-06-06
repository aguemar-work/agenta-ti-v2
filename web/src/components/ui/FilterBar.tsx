/**
 * components/ui/FilterBar.tsx
 *
 * Barra de filtros consistente para todas las vistas.
 * Tres variantes de ítem:
 *
 *   <FilterBar.Select>  — dropdown con label accesible
 *   <FilterBar.Pills>   — grupo de botones pill (opción única)
 *   <FilterBar.Date>    — input de fecha con label
 *   <FilterBar.Action>  — botón de acción dentro del contexto de filtros
 *
 * Uso:
 *   <FilterBar>
 *     <FilterBar.Select
 *       id="f-usuario"
 *       label="Usuario"
 *       value={usuarioFiltro}
 *       onChange={(v) => setUsuarioFiltro(v)}
 *       options={[{ value: 'todos', label: 'Todos' }, ...]}
 *     />
 *     <FilterBar.Pills
 *       value={estadoFiltro}
 *       onChange={setEstadoFiltro}
 *       options={[{ value: 'todos', label: 'Todos' }, ...]}
 *     />
 *   </FilterBar>
 */

import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Contenedor raíz
// ---------------------------------------------------------------------------

type FilterBarProps = {
  children: ReactNode;
};

export function FilterBar({ children }: FilterBarProps) {
  return (
    <div className="mc-filter-bar">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FilterBar.Select — dropdown
// ---------------------------------------------------------------------------

type SelectOption = { value: string; label: string };

type FilterSelectProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  minWidth?: number;
};

FilterBar.Select = function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  disabled = false,
  minWidth = 150,
}: FilterSelectProps) {
  const widthClass =
    minWidth <= 120 ? 'mc-filter-select--w120' : minWidth >= 180 ? 'mc-filter-select--w180' : 'mc-filter-select--w150';
  return (
    <label className="mc-filter-item" htmlFor={id}>
      <span className="mc-filter-label">{label}</span>
      <select
        id={id}
        className={['mc-filter-select', widthClass].join(' ')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
};

// ---------------------------------------------------------------------------
// FilterBar.Pills — grupo de botones pill
// ---------------------------------------------------------------------------

type PillOption = { value: string; label: string; badge?: number };

type FilterPillsProps = {
  value: string;
  onChange: (value: string) => void;
  options: PillOption[];
};

FilterBar.Pills = function FilterPills({ value, onChange, options }: FilterPillsProps) {
  return (
    <div className="mc-filter-pills" role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`mc-filter-pill${value === o.value ? ' mc-filter-pill--active' : ''}`}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
        >
          {o.label}
          {o.badge !== undefined && o.badge > 0 && (
            <span className="mc-filter-pill-badge">{o.badge}</span>
          )}
        </button>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// FilterBar.Date — input de fecha
// ---------------------------------------------------------------------------

type FilterDateProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
};

FilterBar.Date = function FilterDate({ id, label, value, onChange }: FilterDateProps) {
  return (
    <label className="mc-filter-item" htmlFor={id}>
      <span className="mc-filter-label">{label}</span>
      <input
        id={id}
        type="date"
        className="mc-filter-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
};

// ---------------------------------------------------------------------------
// FilterBar.Action — botón dentro de la barra
// ---------------------------------------------------------------------------

type FilterActionProps = {
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  variant?: 'default' | 'toggle';
  title?: string;
};

FilterBar.Action = function FilterAction({
  children,
  onClick,
  active = false,
  variant = 'default',
  title,
}: FilterActionProps) {
  return (
    <button
      type="button"
      title={title}
      className={[
        'mc-filter-action',
        active ? 'mc-filter-action--active' : '',
        variant === 'toggle' ? 'mc-filter-action--toggle' : '',
      ].filter(Boolean).join(' ')}
      onClick={onClick}
      aria-pressed={variant === 'toggle' ? active : undefined}
    >
      {children}
    </button>
  );
};