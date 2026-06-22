import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { agregarDias, inicioSemanaIso } from '@/lib/semanas';

const MESES_LARGO = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
] as const;

const DIAS_HDR = ['L','M','X','J','V','S','D'];

type Props = {
  lunes: Date;
  onSelectLunes: (lunes: Date) => void;
  onClose: () => void;
};

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type SemanaRow = [Date, Date, Date, Date, Date, Date, Date];

function calcularSemanas(mes: Date): SemanaRow[] {
  const primerDia = new Date(mes.getFullYear(), mes.getMonth(), 1);
  const ultimoDia = new Date(mes.getFullYear(), mes.getMonth() + 1, 0);

  const dow1 = primerDia.getDay() === 0 ? 7 : primerDia.getDay();
  const primerLunes = new Date(primerDia);
  primerLunes.setDate(primerDia.getDate() - (dow1 - 1));

  const dowN = ultimoDia.getDay() === 0 ? 7 : ultimoDia.getDay();
  const ultimoDomingo = new Date(ultimoDia);
  ultimoDomingo.setDate(ultimoDia.getDate() + (7 - dowN));

  const semanas: SemanaRow[] = [];
  let cur = new Date(primerLunes);
  while (cur <= ultimoDomingo) {
    const semana = [] as unknown as SemanaRow;
    for (let j = 0; j < 7; j++) {
      semana[j] = new Date(cur);
      cur = agregarDias(cur, 1);
    }
    semanas.push(semana);
  }
  return semanas;
}

export function SemanaCalendarPicker({ lunes, onSelectLunes, onClose }: Props) {
  const [mes, setMes] = useState(() => new Date(lunes.getFullYear(), lunes.getMonth(), 1));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);

  function irHoy() {
    onSelectLunes(inicioSemanaIso(new Date()));
    onClose();
  }

  function seleccionarSemana(lunesFila: Date) {
    onSelectLunes(lunesFila);
    onClose();
  }

  const semanas = calcularSemanas(mes);
  const lunesYmd = ymd(lunes);

  return (
    <div ref={ref} className="mc-semana-cal-picker">
      <div className="mc-semana-cal-picker__hdr">
        <button
          type="button"
          className="mc-nav-arrow-btn"
          onClick={() => setMes((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          aria-label="Mes anterior"
        >
          <ChevronLeft size={13} aria-hidden />
        </button>
        <span className="mc-semana-cal-picker__mes">
          {MESES_LARGO[mes.getMonth()]} {mes.getFullYear()}
        </span>
        <button
          type="button"
          className="mc-nav-arrow-btn"
          onClick={() => setMes((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          aria-label="Mes siguiente"
        >
          <ChevronRight size={13} aria-hidden />
        </button>
      </div>

      <button type="button" className="mc-semana-cal-picker__hoy-btn" onClick={irHoy}>
        Hoy
      </button>

      <div className="mc-semana-cal-picker__dias-hdr">
        {DIAS_HDR.map((d) => <span key={d}>{d}</span>)}
      </div>

      <div className="mc-semana-cal-picker__semanas">
        {semanas.map((semana, i) => {
          const esSel = ymd(semana[0]) === lunesYmd;
          return (
            <div
              key={i}
              className={`mc-semana-cal-picker__semana-row${esSel ? ' mc-semana-cal-picker__semana-row--sel' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => seleccionarSemana(semana[0])}
              onKeyDown={(e) => e.key === 'Enter' && seleccionarSemana(semana[0])}
              aria-label={`Semana del ${semana[0].getDate()} al ${semana[6].getDate()}`}
              aria-pressed={esSel}
            >
              {semana.map((dia, j) => (
                <span
                  key={j}
                  className={`mc-semana-cal-picker__dia${dia.getMonth() !== mes.getMonth() ? ' mc-semana-cal-picker__dia--otro-mes' : ''}`}
                >
                  {dia.getDate()}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
