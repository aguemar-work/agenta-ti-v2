/**
 * lib/tareaUrgencia.ts
 *
 * Utilidades para calcular alertas visuales basadas en tiempo:
 *   - urgenciaHoraria: estado visual de una tarea según la hora del día (vista HOY)
 *   - nivelRiesgoObjetivo: nivel de alerta de un objetivo según % de avance y fecha límite
 */

import type { NivelRiesgoObjetivo, PrioridadTarea, UrgenciaHoraria } from '@/types';
import {
  HORA_PRECAUCION,
  HORA_URGENTE,
  HORA_VENCIDA,
  PESO_PRIORIDAD,
  UMBRAL_OBJETIVO_ACEPTABLE,
  UMBRAL_OBJETIVO_CRITICO,
  UMBRAL_OBJETIVO_MODERADO,
} from '@/lib/constants';

// ---------------------------------------------------------------------------
// Urgencia horaria de una tarea (vista HOY)
//
// Solo aplica a tareas pendientes/en_progreso del día actual.
// Si ya está completada o cancelada → 'normal'
// (su propio estado ya comunica el problema).
// ---------------------------------------------------------------------------

/**
 * Calcula la urgencia horaria de una tarea según la hora actual.
 *
 * @param horaActual - Hora del día en formato 24h (0–23). Por defecto usa la hora local.
 */
export function urgenciaHoraria(
  estado: string,
  horaActual?: number,
): UrgenciaHoraria {
  // Solo aplica a tareas activas sin problema ya conocido
  if (!['pendiente', 'en_progreso'].includes(estado)) return 'normal';

  const hora = horaActual ?? new Date().getHours();

  if (hora >= HORA_VENCIDA)    return 'vencida_hoy';
  if (hora >= HORA_URGENTE)    return 'urgente';
  if (hora >= HORA_PRECAUCION) return 'precaucion';
  return 'normal';
}

// ---------------------------------------------------------------------------
// Clases CSS por urgencia (para aplicar en la tarjeta de tarea)
// ---------------------------------------------------------------------------

export const URGENCIA_CARD_CLASS: Record<UrgenciaHoraria, string> = {
  normal:      '',
  precaucion:  'task-card--precaucion',
  urgente:     'task-card--urgente',
  vencida_hoy: 'task-card--vencida-hoy',
};

// URGENCIA_LABEL vive en lib/estadoConfig.ts — fuente única de verdad.
// Importar desde allí: import { URGENCIA_LABEL } from '@/lib/estadoConfig';

// ---------------------------------------------------------------------------
// Nivel de riesgo de un objetivo
// ---------------------------------------------------------------------------

export interface TareaResumenProgreso {
  estado: string;
  prioridad: PrioridadTarea;
}

/**
 * Calcula el porcentaje de avance ponderado de un objetivo.
 *
 * Fórmula:
 *   avance = sum(puntos de tareas completadas) / sum(puntos de todas las tareas) × 100
 *
 * Tareas canceladas se excluyen del denominador (no penalizan ni suman).
 */
export function calcularPorcentajeObjetivo(tareas: TareaResumenProgreso[]): number {
  const activas = tareas.filter((t) => t.estado !== 'cancelada');
  if (activas.length === 0) return 0;

  const totalPuntos = activas.reduce((acc, t) => acc + PESO_PRIORIDAD[t.prioridad], 0);
  if (totalPuntos === 0) return 0;

  const puntosCompletados = activas
    .filter((t) => t.estado === 'completada')
    .reduce((acc, t) => acc + PESO_PRIORIDAD[t.prioridad], 0);

  return Math.round((puntosCompletados / totalPuntos) * 100);
}

/**
 * Determina el nivel de riesgo de un objetivo según su % de avance y fecha límite.
 *
 * Regla: si NO tiene fecha_limite → 'sin_fecha' (no se muestra badge de urgencia).
 * Si tiene fecha_limite y ya pasó → se evalúa igual (el objetivo está vencido).
 */
export function nivelRiesgoObjetivo(
  porcentaje: number,
  fechaLimite: string | null,
  totalTareas?: number,
): NivelRiesgoObjetivo {
  if (!fechaLimite) return 'sin_fecha';
  // Sin tareas vinculadas aún — no hay riesgo calculable, no mostrar badge
  if (totalTareas !== undefined && totalTareas === 0) return 'sin_fecha';

  if (porcentaje < UMBRAL_OBJETIVO_CRITICO)   return 'critico';
  if (porcentaje < UMBRAL_OBJETIVO_MODERADO)  return 'moderado';
  if (porcentaje < UMBRAL_OBJETIVO_ACEPTABLE) return 'aceptable';
  return 'en_ritmo';
}

// ---------------------------------------------------------------------------
// Configuración visual por nivel de riesgo
// ---------------------------------------------------------------------------

export const RIESGO_CONFIG: Record<NivelRiesgoObjetivo, {
  label:      string;
  badgeClass: string;
  textColor:  string;
  bgColor:    string;
  barColor:   string;
}> = {
  critico: {
    label:      'Crítico',
    badgeClass: 'mc-badge-danger',
    textColor:  'var(--mc-state-atrasada-meta)',
    bgColor:    'var(--mc-state-atrasada-bg)',
    barColor:   'var(--mc-state-atrasada-border)',
  },
  moderado: {
    label:      'Moderado',
    badgeClass: 'mc-badge-warning',
    textColor:  'var(--mc-state-precaucion-border)',
    bgColor:    'var(--mc-state-precaucion-bg-soft)',
    barColor:   'var(--mc-state-precaucion-border)',
  },
  aceptable: {
    label:      'Aceptable',
    badgeClass: 'mc-badge-success',
    textColor:  'var(--mc-state-completada-fg)',
    bgColor:    'var(--mc-state-completada-bg)',
    barColor:   'var(--mc-state-completada-border)',
  },
  en_ritmo: {
    label:      'En buen ritmo',
    badgeClass: 'mc-badge-success',
    textColor:  'var(--mc-state-progreso-fg)',
    bgColor:    'var(--mc-state-progreso-bg)',
    barColor:   'var(--mc-state-progreso-border)',
  },
  sin_fecha: {
    label:      '',
    badgeClass: '',
    textColor:  'var(--mc-color-text-secondary)',
    bgColor:    'transparent',
    barColor:   'var(--mc-color-neutral-soft)',
  },
};