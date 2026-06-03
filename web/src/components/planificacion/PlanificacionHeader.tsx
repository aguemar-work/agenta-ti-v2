import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fechaLocalDdMmYyyy } from '@/lib/fecha';
import { inicioSemanaIso } from '@/lib/semanas';

type Props = {
  lunes: Date;
  sabado: Date;
  onSemanaAnterior: () => void;
  onSemanaSiguiente: () => void;
  onIrHoy: () => void;
};

export function PlanificacionHeader({
  lunes,
  sabado,
  onSemanaAnterior,
  onSemanaSiguiente,
  onIrHoy,
}: Props) {
  const hoyLunes = inicioSemanaIso(new Date()).getTime() === lunes.getTime();

  return (
    <header className="mc-misemana-header">
      <div className="mc-misemana-header__left">
        <div className="mc-plan-header__title-row">
          <h1 className="mc-misemana-header__title m-0">Planificación del equipo</h1>
          <span className="mc-badge mc-badge-secondary mc-plan-header__badge">Solo lectura</span>
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
    </header>
  );
}
