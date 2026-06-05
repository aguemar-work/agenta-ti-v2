/**
 * lib/estadoConfig.ts
 *
 * Fuente única de labels, badges y tokens para estados de tarea (eje 1)
 * y situaciones calculadas (eje 2) en UI.
 */

import type {
  ClaveVisualTarea,
  EstadoObjetivo,
  EstadoTarea,
  PrioridadTarea,
  SituacionTarea,
  UrgenciaHoraria,
} from '@/types';

// ---------------------------------------------------------------------------
// Tokens — eje visual (estado persistido + situación calculada)
// ---------------------------------------------------------------------------

export interface EstadoTokens {
  bg:     string;
  fg:     string;
  border: string;
  meta:   string;
}

export interface UrgenciaTokens {
  bg:      string;
  fg:      string;
  border:  string;
  badgeBg: string;
  badgeFg: string;
}

export const STATE_TOKENS: Record<ClaveVisualTarea, EstadoTokens> = {
  atrasada: {
    bg:     'var(--mc-state-atrasada-bg)',
    fg:     'var(--mc-state-atrasada-fg)',
    border: 'var(--mc-state-atrasada-border)',
    meta:   'var(--mc-state-atrasada-meta)',
  },
  en_progreso: {
    bg:     'var(--mc-state-progreso-bg)',
    fg:     'var(--mc-state-progreso-fg)',
    border: 'var(--mc-state-progreso-border)',
    meta:   'var(--mc-color-text-secondary)',
  },
  completada: {
    bg:     'var(--mc-state-completada-bg)',
    fg:     'var(--mc-state-completada-fg)',
    border: 'var(--mc-state-completada-border)',
    meta:   'var(--mc-color-text-secondary)',
  },
  reprogramada: {
    bg:     'var(--mc-state-reprogramada-bg)',
    fg:     'var(--mc-state-reprogramada-fg)',
    border: 'var(--mc-state-reprogramada-border)',
    meta:   'var(--mc-color-text-secondary)',
  },
  pendiente: {
    bg:     'var(--mc-state-pendiente-bg)',
    fg:     'var(--mc-state-pendiente-fg)',
    border: 'transparent',
    meta:   'var(--mc-color-text-secondary)',
  },
  cancelada: {
    bg:     'var(--mc-state-cancelada-bg)',
    fg:     'var(--mc-state-cancelada-fg)',
    border: 'transparent',
    meta:   'var(--mc-color-text-placeholder)',
  },
};

export const URGENCIA_TOKENS: Record<UrgenciaHoraria, UrgenciaTokens> = {
  normal: {
    bg:      'transparent',
    fg:      'var(--mc-color-text)',
    border:  'transparent',
    badgeBg: 'transparent',
    badgeFg: 'transparent',
  },
  precaucion: {
    bg:      'var(--mc-state-precaucion-bg)',
    fg:      'var(--mc-state-precaucion-fg)',
    border:  'var(--mc-state-precaucion-border)',
    badgeBg: 'var(--mc-state-precaucion-badge-bg)',
    badgeFg: 'var(--mc-state-precaucion-badge-fg)',
  },
  urgente: {
    bg:      'var(--mc-state-urgente-bg)',
    fg:      'var(--mc-state-urgente-fg)',
    border:  'var(--mc-state-urgente-border)',
    badgeBg: 'var(--mc-state-urgente-badge-bg)',
    badgeFg: 'var(--mc-state-urgente-badge-fg)',
  },
  vencida_hoy: {
    bg:      'var(--mc-state-vencida-bg)',
    fg:      'var(--mc-state-vencida-fg)',
    border:  'var(--mc-state-vencida-border)',
    badgeBg: 'var(--mc-state-vencida-badge-bg)',
    badgeFg: 'var(--mc-state-vencida-badge-fg)',
  },
};

// ---------------------------------------------------------------------------
// Tarea — badge / label / pill (clave visual)
// ---------------------------------------------------------------------------

export const TAREA_BADGE: Record<ClaveVisualTarea, string> = {
  pendiente:    'mc-badge-neutral',
  en_progreso:  'mc-badge-info',
  completada:   'mc-badge-success',
  atrasada:     'mc-badge-danger',
  reprogramada: 'mc-badge-neutral',
  cancelada:    'mc-badge-neutral',
};

export const TAREA_LABEL: Record<ClaveVisualTarea, string> = {
  pendiente:    'Pendiente',
  en_progreso:  'En progreso',
  completada:   'Completada',
  atrasada:     'Atrasada',
  reprogramada: 'Reprogramada',
  cancelada:    'Cancelada',
};

export const TAREA_LABEL_PLURAL: Record<ClaveVisualTarea, string> = {
  pendiente:    'pendientes',
  en_progreso:  'en progreso',
  completada:   'completadas',
  atrasada:     'atrasadas',
  reprogramada: 'reprogramadas',
  cancelada:    'canceladas',
};

/** Eje 1 — estado persistido en BD (4 valores). */
export const ESTADO_EJECUCION_LABEL: Record<EstadoTarea, string> = {
  pendiente:    'Pendiente',
  en_progreso:  'En progreso',
  completada:   'Completada',
  cancelada:    'Cancelada',
};

/** Eje 2 — situación calculada (solo las que aportan señal en UI). */
export const SITUACION_LABEL: Record<Exclude<SituacionTarea, 'creada'>, string> = {
  atrasada:     'Atrasada',
  reprogramada: 'Reprogramada',
};

export const TAREA_PILL: Record<ClaveVisualTarea, string> = {
  pendiente:    'mc-tarea-pill mc-tarea-pill--pendiente',
  en_progreso:  'mc-tarea-pill mc-tarea-pill--en_progreso',
  completada:   'mc-tarea-pill mc-tarea-pill--completada',
  atrasada:     'mc-tarea-pill mc-tarea-pill--atrasada',
  reprogramada: 'mc-tarea-pill mc-tarea-pill--reprogramada',
  cancelada:    'mc-tarea-pill mc-tarea-pill--cancelada',
};

// ---------------------------------------------------------------------------
// Objetivo
// ---------------------------------------------------------------------------

export const OBJETIVO_BADGE: Record<EstadoObjetivo, string> = {
  activo:     'mc-badge-accent',
  completado: 'mc-badge-success',
  cancelado:  'mc-badge-neutral',
};

export const OBJETIVO_LABEL: Record<EstadoObjetivo, string> = {
  activo:     'Activo',
  completado: 'Completado',
  cancelado:  'Cancelado',
};

// ---------------------------------------------------------------------------
// Urgencia horaria
// ---------------------------------------------------------------------------

export const URGENCIA_BADGE: Record<UrgenciaHoraria, string> = {
  normal:      '',
  precaucion:  'mc-badge-warning',
  urgente:     'mc-badge-danger',
  vencida_hoy: 'mc-badge-danger',
};

export const URGENCIA_LABEL: Record<UrgenciaHoraria, string> = {
  normal:      '',
  precaucion:  'Por vencer',
  urgente:     'Urgente',
  vencida_hoy: 'Vencida hoy',
};

// ---------------------------------------------------------------------------
// Prioridad
// ---------------------------------------------------------------------------

export const PRIORIDAD_BADGE: Record<PrioridadTarea, string> = {
  critica: 'mc-badge mc-badge-prioridad-critica',
  alta:    'mc-badge mc-badge-prioridad-alta',
  media:   'mc-badge mc-badge-prioridad-media',
  baja:    'mc-badge mc-badge-prioridad-baja',
};

export const PRIORIDAD_LABEL: Record<PrioridadTarea, string> = {
  critica: 'Crítica',
  alta:    'Alta',
  media:   'Media',
  baja:    'Baja',
};
