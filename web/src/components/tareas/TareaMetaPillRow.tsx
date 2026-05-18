import { Calendar } from 'lucide-react';

import { TareaEstadoIndicator } from '@/components/tareas/TareaEstadoIndicator';
import { fechaLocalDdMmYyyy } from '@/lib/fecha';
import { PRIORIDAD_LABEL } from '@/lib/estadoConfig';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import type { PrioridadTarea, Tarea } from '@/types';

type Props = {
  tarea: Tarea;
  hoyYmd: string;
  className?: string;
};

function PrioridadPill({ prioridad }: { prioridad: PrioridadTarea }) {
  return (
    <span className={`mc-meta-pill mc-meta-pill--prioridad-${prioridad}`}>
      {PRIORIDAD_LABEL[prioridad]}
    </span>
  );
}

function FechaPill({ ymd }: { ymd: string }) {
  return (
    <span className="mc-meta-pill mc-meta-pill--fecha">
      <Calendar size={11} strokeWidth={2} aria-hidden />
      {fechaLocalDdMmYyyy(new Date(`${ymd}T12:00:00`))}
    </span>
  );
}

/** Estado + prioridad + fecha con el mismo lenguaje visual (pills). */
export function TareaMetaPillRow({ tarea, hoyYmd, className = '' }: Props) {
  const est = estadoEfectivoTablero(tarea, hoyYmd);

  return (
    <div className={['mc-tarea-meta-pills', className].filter(Boolean).join(' ')}>
      <TareaEstadoIndicator estado={est} variant="pill" />
      <PrioridadPill prioridad={tarea.prioridad} />
      {tarea.fecha_planificada ? <FechaPill ymd={tarea.fecha_planificada} /> : null}
    </div>
  );
}
