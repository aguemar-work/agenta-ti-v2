import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { fechaLocalDdMmYyyy } from '@/lib/fecha';
import { agregarDias, inicioSemanaIso } from '@/lib/semanas';

type Props = {
  lunes: Date;
  sabado: Date;
  onSemanaAnterior: () => void;
  onSemanaSiguiente: () => void;
  onIrHoy: () => void;
  onNuevaTarea: () => void;
  nuevaTareaLabel?: string;
  onNotas: () => void;
  notasOpen: boolean;
};

export function MiSemanaHeader({
  lunes,
  sabado,
  onSemanaAnterior,
  onSemanaSiguiente,
  onIrHoy,
  onNuevaTarea,
  nuevaTareaLabel = '+ Nueva tarea',
  onNotas,
  notasOpen,
}: Props) {
  return (
    <header className="mc-misemana-header">
      <div className="mc-misemana-header__left">
        <h1 className="mc-misemana-header__title">Mi semana</h1>
        <div className="mc-misemana-header__nav" role="group" aria-label="Navegación de semana">
          <button type="button" className="mc-nav-arrow-btn" onClick={onSemanaAnterior} aria-label="Semana anterior">
            <ChevronLeft size={18} strokeWidth={2} aria-hidden />
          </button>
          <span className="mc-misemana-header__rango">
            {fechaLocalDdMmYyyy(lunes)} – {fechaLocalDdMmYyyy(sabado)}
          </span>
          <button type="button" className="mc-misemana-header__hoy" onClick={onIrHoy}>
            Hoy
          </button>
          <button type="button" className="mc-nav-arrow-btn" onClick={onSemanaSiguiente} aria-label="Semana siguiente">
            <ChevronRight size={18} strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>

      <div className="mc-misemana-header__actions">
        <Button variant="primary" size="sm" onClick={onNuevaTarea}>
          {nuevaTareaLabel}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onNotas}
          aria-expanded={notasOpen}
          aria-controls="mc-misemana-notas-drawer"
        >
          Notas
        </Button>
      </div>
    </header>
  );
}

/** Ir al lunes de la semana que contiene hoy. */
export function lunesSemanaActual(): Date {
  return inicioSemanaIso(new Date());
}

export function navegarSemanaAnterior(lunes: Date): Date {
  return agregarDias(lunes, -7);
}

export function navegarSemanaSiguiente(lunes: Date): Date {
  return agregarDias(lunes, 7);
}
