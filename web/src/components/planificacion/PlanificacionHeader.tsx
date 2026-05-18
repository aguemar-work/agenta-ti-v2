import { ChevronLeft, ChevronRight } from 'lucide-react';
import { FilterBar } from '@/components/ui/FilterBar';
import { fechaLocalDdMmYyyy } from '@/lib/fecha';
import { inicioSemanaIso } from '@/lib/semanas';

type Props = {
  lunes: Date;
  sabado: Date;
  onSemanaAnterior: () => void;
  onSemanaSiguiente: () => void;
  onIrHoy: () => void;
  periodoDesde: string;
  periodoHasta: string;
  onPeriodoDesde: (v: string) => void;
  onPeriodoHasta: (v: string) => void;
};

export function PlanificacionHeader({
  lunes,
  sabado,
  onSemanaAnterior,
  onSemanaSiguiente,
  onIrHoy,
  periodoDesde,
  periodoHasta,
  onPeriodoDesde,
  onPeriodoHasta,
}: Props) {
  const hoyLunes = inicioSemanaIso(new Date()).getTime() === lunes.getTime();

  return (
    <header className="mc-misemana-header mc-plan-header">
      <div className="mc-misemana-header__left">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mc-misemana-header__title m-0">Planificación del equipo</h1>
          <span className="mc-badge mc-badge-secondary text-[10px] font-semibold uppercase tracking-wide">
            Solo lectura
          </span>
        </div>
        <p className="m-0 text-sm text-[var(--mc-color-text-secondary)]">
          Carga operativa de la semana y rendimiento del período
        </p>
        <div className="mc-misemana-header__nav" role="group" aria-label="Semana operativa">
          <button type="button" className="mc-nav-arrow-btn" onClick={onSemanaAnterior} aria-label="Semana anterior">
            <ChevronLeft size={18} strokeWidth={2} aria-hidden />
          </button>
          <span className="mc-misemana-header__rango">
            {fechaLocalDdMmYyyy(lunes)} – {fechaLocalDdMmYyyy(sabado)}
          </span>
          <button type="button" className="mc-misemana-header__hoy" onClick={onIrHoy} disabled={hoyLunes}>
            Hoy
          </button>
          <button type="button" className="mc-nav-arrow-btn" onClick={onSemanaSiguiente} aria-label="Semana siguiente">
            <ChevronRight size={18} strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>
      <div className="mc-plan-header__periodo" role="group" aria-label="Período de rendimiento">
        <span className="mc-plan-header__periodo-label">Período rendimiento</span>
        <FilterBar.Date id="plan-desde" label="Desde" value={periodoDesde} onChange={onPeriodoDesde} />
        <FilterBar.Date id="plan-hasta" label="Hasta" value={periodoHasta} onChange={onPeriodoHasta} />
      </div>
    </header>
  );
}
