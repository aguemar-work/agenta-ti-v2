import { AlertCircle } from 'lucide-react';

import type { Tarea } from '@/types';

type Props = {
  incidencia: Tarea;
  hoyYmd: string;
  asignadoNombre?: string | null;
  readOnly?: boolean;
  onOpen?: () => void;
};

export function IncidenciaRow({ incidencia, hoyYmd, asignadoNombre, readOnly, onOpen }: Props) {
  const ymd = incidencia.fecha_planificada ?? '';
  const esPasado = ymd < hoyYmd;
  const soloLectura = readOnly || esPasado;
  const meta = [asignadoNombre, incidencia.prioridad !== 'media' ? incidencia.prioridad : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <button
      type="button"
      className="mc-incidencia-row w-full text-left"
      onClick={onOpen}
      disabled={!onOpen}
      aria-label={`Incidencia: ${incidencia.titulo}${soloLectura ? ' (solo lectura)' : ''}`}
    >
      <AlertCircle size={12} className="mc-incidencia-row__icon shrink-0" aria-hidden />
      <span className="mc-incidencia-row__titulo truncate">{incidencia.titulo}</span>
      {meta ? (
        <span className="mc-incidencia-row__meta shrink-0">{meta}</span>
      ) : null}
    </button>
  );
}
