import { useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, NotebookPen } from 'lucide-react';
import { agregarDias, inicioSemanaIso } from '@/lib/semanas';
import { Button } from '@/components/ui/Button';
import { SemanaCalendarPicker } from './SemanaCalendarPicker';
import { useIsMobile } from '@/hooks/useIsMobile';

const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'] as const;

function formatRangoSemana(lunes: Date, sabado: Date): string {
  const dL = lunes.getDate();
  const mL = MESES[lunes.getMonth()];
  const dS = sabado.getDate();
  const mS = MESES[sabado.getMonth()];
  const year = sabado.getFullYear();
  return lunes.getMonth() === sabado.getMonth()
    ? `${dL} – ${dS} ${mL} ${year}`
    : `${dL} ${mL} – ${dS} ${mS} ${year}`;
}

type Props = {
  lunes: Date;
  sabado: Date;
  onSemanaAnterior: () => void;
  onSemanaSiguiente: () => void;
  onSelectLunes: (lunes: Date) => void;
  onNuevaTarea: () => void;
  onNota: () => void;
};

export function MiSemanaHeader({
  lunes,
  sabado,
  onSemanaAnterior,
  onSemanaSiguiente,
  onSelectLunes,
  onNuevaTarea,
  onNota,
}: Props) {
  const [calOpen, setCalOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div className="mc-misemana-hdr__top">
      {/* Nav izquierda: SEMANA [←][fecha][→][📅] */}
      <div className="mc-misemana-hdr__nav" role="group" aria-label="Navegación de semana">
        <span className="mc-misemana-hdr__title">Semana</span>

        <button
          type="button"
          className="mc-nav-arrow-btn"
          onClick={onSemanaAnterior}
          aria-label="Semana anterior"
        >
          <ChevronLeft size={15} strokeWidth={2} aria-hidden />
        </button>

        <span className="mc-misemana-hdr__fecha" aria-live="polite">
          {formatRangoSemana(lunes, sabado)}
        </span>

        <button
          type="button"
          className="mc-nav-arrow-btn"
          onClick={onSemanaSiguiente}
          aria-label="Semana siguiente"
        >
          <ChevronRight size={15} strokeWidth={2} aria-hidden />
        </button>

        {/* Icono calendario con picker de semana */}
        <div className="mc-semana-cal-trigger">
          <button
            type="button"
            className={`mc-nav-arrow-btn${calOpen ? ' mc-nav-arrow-btn--active' : ''}`}
            onClick={() => setCalOpen((o) => !o)}
            aria-label="Seleccionar semana"
            aria-expanded={calOpen}
          >
            <CalendarDays size={14} aria-hidden />
          </button>
          {calOpen && (
            <SemanaCalendarPicker
              lunes={lunes}
              onSelectLunes={onSelectLunes}
              onClose={() => setCalOpen(false)}
            />
          )}
        </div>
      </div>

      {/* Acciones derecha: [+ Nueva tarea][Notas] */}
      <div className="mc-misemana-hdr__actions">
        <Button variant="primary" size="sm" onClick={onNuevaTarea}>
          {isMobile ? '+ Tarea' : '+ Nueva tarea'}
        </Button>
        <Button variant="secondary" size="sm" onClick={onNota} aria-label="Notas">
          <NotebookPen size={13} aria-hidden />
          {!isMobile && 'Notas'}
        </Button>
      </div>
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- utilidades de navegación coubicadas con el header que las consume
export function lunesSemanaActual(): Date {
  return inicioSemanaIso(new Date());
}

// eslint-disable-next-line react-refresh/only-export-components
export function navegarSemanaAnterior(lunes: Date): Date {
  return agregarDias(lunes, -7);
}

// eslint-disable-next-line react-refresh/only-export-components
export function navegarSemanaSiguiente(lunes: Date): Date {
  return agregarDias(lunes, 7);
}
