import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
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
    <PageHeader
      title="Planificación del equipo"
      titleAddon={<span className="mc-badge mc-badge-secondary">Solo lectura</span>}
      subtitle={`${fechaLocalDdMmYyyy(lunes)} – ${fechaLocalDdMmYyyy(sabado)}`}
      detail="Carga operativa de la semana y rendimiento del período"
      left={
        <div className="mc-misemana-header__nav" role="group" aria-label="Semana operativa">
          <button type="button" className="mc-nav-arrow-btn" onClick={onSemanaAnterior} aria-label="Semana anterior">
            <ChevronLeft size={18} strokeWidth={2} aria-hidden />
          </button>
          <button type="button" className="mc-misemana-header__hoy" onClick={onIrHoy} disabled={hoyLunes}>
            Hoy
          </button>
          <button type="button" className="mc-nav-arrow-btn" onClick={onSemanaSiguiente} aria-label="Semana siguiente">
            <ChevronRight size={18} strokeWidth={2} aria-hidden />
          </button>
        </div>
      }
    />
  );
}
