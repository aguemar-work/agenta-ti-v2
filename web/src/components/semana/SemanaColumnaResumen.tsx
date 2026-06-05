import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import type { Tarea } from '@/types';

type Props = {
  tareas: Tarea[];
  hoyYmd: string;
};

/** Conteo bajo el encabezado del día: N tareas · M completadas. */
export function SemanaColumnaResumen({ tareas, hoyYmd }: Props) {
  let completadas = 0;

  for (const t of tareas) {
    const est = estadoEfectivoTablero(t, hoyYmd);
    if (est === 'completada' || est === 'cancelada') completadas++;
  }

  const total = tareas.length;
  const labelTareas = total === 1 ? 'tarea' : 'tareas';
  const labelCompl = completadas === 1 ? 'completada' : 'completadas';

  return (
    <p className="mc-semana-col-conteo" role="status">
      {total} {labelTareas} · {completadas} {labelCompl}
    </p>
  );
}
