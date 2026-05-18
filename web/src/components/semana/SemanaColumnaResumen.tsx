import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import type { Tarea } from '@/types';

type Props = {
  tareas: Tarea[];
  hoyYmd: string;
  incidenciasCount?: number;
};

/** Pie de columna: pendientes, completadas e incidencias del día. */
export function SemanaColumnaResumen({ tareas, hoyYmd, incidenciasCount = 0 }: Props) {
  let pendientes = 0;
  let completadas = 0;

  for (const t of tareas) {
    const est = estadoEfectivoTablero(t, hoyYmd);
    if (est === 'completada' || est === 'cancelada') completadas++;
    else pendientes++;
  }

  if (tareas.length === 0 && incidenciasCount === 0) {
    return (
      <p className="mc-semana-col-resumen" role="status">
        Sin tareas
      </p>
    );
  }

  const partes: string[] = [];
  partes.push(`${pendientes} pend.`);
  partes.push(`${completadas} compl.`);
  if (incidenciasCount > 0) {
    partes.push(`${incidenciasCount} incid.`);
  }

  return (
    <p className="mc-semana-col-resumen" role="status">
      {partes.join(' · ')}
    </p>
  );
}
