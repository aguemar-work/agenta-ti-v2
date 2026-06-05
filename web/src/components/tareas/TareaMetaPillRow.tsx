import { Calendar } from 'lucide-react';

import { TareaEstadoIndicator } from '@/components/tareas/TareaEstadoIndicator';
import { fechaLocalDdMmYyyy } from '@/lib/fecha';
import { ESTADO_EJECUCION_LABEL, PRIORIDAD_LABEL } from '@/lib/estadoConfig';
import { claveVisualTarea, situacionEfectiva } from '@/lib/tableroEstado';
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

/** Dos ejes (situación + estado) + prioridad + fecha en detalle de tarea. */
export function TareaMetaPillRow({ tarea, hoyYmd, className = '' }: Props) {
  const terminal = tarea.estado === 'completada' || tarea.estado === 'cancelada';
  const sit = situacionEfectiva(tarea, hoyYmd);
  const muestraSituacion = !terminal && (sit === 'atrasada' || sit === 'reprogramada');

  return (
    <div className={['mc-tarea-meta-pills', className].filter(Boolean).join(' ')}>
      {muestraSituacion && sit && (
        <TareaEstadoIndicator estado={sit} variant="pill" />
      )}
      {!terminal && (
        <span className="mc-meta-pill mc-meta-pill--estado-ejecucion">
          {ESTADO_EJECUCION_LABEL[tarea.estado]}
        </span>
      )}
      {terminal && <TareaEstadoIndicator estado={claveVisualTarea(tarea, hoyYmd)} variant="pill" />}
      <PrioridadPill prioridad={tarea.prioridad} />
      {tarea.fecha_planificada ? <FechaPill ymd={tarea.fecha_planificada} /> : null}
    </div>
  );
}
