/**
 * components/semana/RecurrenciaForm.tsx
 *
 * Subcomponente reutilizable para configurar la regla de recurrencia de un evento.
 * Se muestra dentro de ModalMiSemana y ModalConvertirNota cuando el usuario
 * activa el toggle "Recurrente".
 */

import type { DiaSemana } from '@/api/recurrencia';

export type RecurrenciaConfig = {
  dias_semana: DiaSemana[];
  fecha_fin: string;    // '' = sin fecha fin
  meses: number;        // períodos a generar (1, 2 o 3)
};

const DIAS: { value: DiaSemana; label: string; short: string }[] = [
  { value: 1, label: 'Lunes',     short: 'L' },
  { value: 2, label: 'Martes',    short: 'M' },
  { value: 3, label: 'Miércoles', short: 'X' },
  { value: 4, label: 'Jueves',    short: 'J' },
  { value: 5, label: 'Viernes',   short: 'V' },
  { value: 6, label: 'Sábado',    short: 'S' },
];

type Props = {
  value: RecurrenciaConfig;
  onChange: (v: RecurrenciaConfig) => void;
  /** Día desde el que aplica la serie (YYYY-MM-DD) — valida fecha_fin ≥ inicio (V2). */
  fechaInicio?: string;
};

export function RecurrenciaForm({ value, onChange, fechaInicio }: Props) {
  const fechaFinInvalida = Boolean(
    fechaInicio && value.fecha_fin && value.fecha_fin < fechaInicio,
  );
  function toggleDia(dia: DiaSemana) {
    const next = value.dias_semana.includes(dia)
      ? value.dias_semana.filter((d) => d !== dia)
      : [...value.dias_semana, dia].sort((a, b) => a - b) as DiaSemana[];
    onChange({ ...value, dias_semana: next });
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-[var(--mc-color-accent)] bg-[color-mix(in_srgb,var(--mc-color-accent)_5%,transparent)] p-3"
    >
      {/* Días */}
      <div className="mc-field !mb-0">
        <label className="mc-field-label">Días de la semana</label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {DIAS.map((d) => {
            const active = value.dias_semana.includes(d.value);
            return (
              <button
                key={d.value}
                type="button"
                title={d.label}
                onClick={() => toggleDia(d.value)}
                className={[
                  'w-8 h-8 rounded-full text-xs font-semibold transition-colors',
                  active
                    ? 'bg-[var(--mc-color-accent)] text-white'
                    : 'bg-[var(--mc-color-bg-secondary)] text-[var(--mc-color-text-secondary)] hover:bg-[var(--mc-color-surface-hover)]',
                ].join(' ')}
                aria-pressed={active}
                aria-label={d.label}
              >
                {d.short}
              </button>
            );
          })}
        </div>
        {value.dias_semana.length === 0 && (
          <p className="mt-1 text-[10px] text-[var(--mc-color-danger)]">
            Selecciona al menos un día.
          </p>
        )}
      </div>

      {/* Período a generar */}
      <div className="mc-field !mb-0">
        <label className="mc-field-label" htmlFor="rec-meses">Generar instancias para</label>
        <select
          id="rec-meses"
          className="mc-input !w-auto"
          value={value.meses}
          onChange={(e) => onChange({ ...value, meses: Number(e.target.value) })}
        >
          <option value={1}>Este mes</option>
          <option value={2}>Los próximos 2 meses</option>
          <option value={3}>Los próximos 3 meses</option>
        </select>
        <p className="mt-1 text-[10px] text-[var(--mc-color-text-secondary)]">
          Puedes generar más meses después desde la vista de recurrencias.
        </p>
      </div>

      {/* Fecha fin opcional */}
      <div className="mc-field !mb-0">
        <label className="mc-field-label" htmlFor="rec-fin">
          Fecha de fin
          <span className="ml-1 font-normal text-[var(--mc-color-text-secondary)]">(opcional)</span>
        </label>
        <input
          id="rec-fin"
          type="date"
          className="mc-input !w-auto"
          value={value.fecha_fin}
          onChange={(e) => onChange({ ...value, fecha_fin: e.target.value })}
        />
        {fechaFinInvalida ? (
          <p className="mt-1 text-[10px] text-[var(--mc-color-danger)]">
            La fecha de fin no puede ser anterior a la fecha de inicio.
          </p>
        ) : !value.fecha_fin ? (
          <p className="mt-1 text-[10px] text-[var(--mc-color-text-secondary)]">
            Sin fecha fin — se repite indefinidamente (mes a mes).
          </p>
        ) : null}
      </div>
    </div>
  );
}