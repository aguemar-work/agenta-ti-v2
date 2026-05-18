import { PESO_PRIORIDAD } from '@/lib/constants';
import { PRIORIDAD_LABEL } from '@/lib/estadoConfig';
import { calcularPorcentajeObjetivo } from '@/lib/tareaUrgencia';
import type { PrioridadTarea, Tarea } from '@/types';

export const FORMULA_PROGRESO_OBJETIVO =
  'Progreso = Σ(puntos tareas completadas) / Σ(puntos tareas no canceladas) × 100. Puntos: alta = 3, media = 2, baja = 1.';

export type FilaPuntosObjetivo = {
  tareaId: string;
  titulo: string;
  prioridad: PrioridadTarea;
  puntos: number;
  completada: boolean;
};

export function breakdownPuntosObjetivo(tareas: Tarea[]) {
  const activas = tareas.filter((t) => t.estado !== 'cancelada');
  const filas: FilaPuntosObjetivo[] = activas.map((t) => ({
    tareaId:    t.id,
    titulo:     t.titulo,
    prioridad:  t.prioridad,
    puntos:     PESO_PRIORIDAD[t.prioridad],
    completada: t.estado === 'completada',
  }));
  const totalPuntos = filas.reduce((acc, f) => acc + f.puntos, 0);
  const puntosCompletados = filas.filter((f) => f.completada).reduce((acc, f) => acc + f.puntos, 0);
  const pct = calcularPorcentajeObjetivo(
    activas.map((t) => ({ estado: t.estado, prioridad: t.prioridad })),
  );
  return { filas, totalPuntos, puntosCompletados, pct };
}

export function etiquetaPuntosPrioridad(p: PrioridadTarea): string {
  return `${PRIORIDAD_LABEL[p]} (${PESO_PRIORIDAD[p]} pt)`;
}
