import type { EstadoTarea, Tarea } from '@/types';

/**
 * Estado visual para columnas Kanban.
 *
 * La fecha vencida solo degrada tareas aún accionables como pendientes. Si una
 * tarea ya fue iniciada o bloqueada, el tablero debe respetar ese estado para
 * que se mueva a su columna operativa.
 */
export function estadoEfectivoTablero(tarea: Tarea, hoyYmd: string): EstadoTarea {
  if (
    tarea.tipo === 'planificada' &&
    tarea.fecha_planificada &&
    tarea.fecha_planificada < hoyYmd &&
    tarea.estado === 'pendiente'
  ) {
    return 'atrasada';
  }

  return tarea.estado;
}
