/**
 * lib/estadoConfig.ts
 *
 * FUENTE ÚNICA de verdad para labels, badges, clases CSS y colores
 * de estado. Todos los componentes que renderizan una tarea leen de aquí.
 *
 * Regla: NINGÚN componente de UI debe tener hex sueltos para estados
 * de tarea. Usar STATE_TOKENS o las constantes TAREA_* / URGENCIA_*.
 */

import type { EstadoObjetivo, EstadoTarea, UrgenciaHoraria } from '@/types';

// ---------------------------------------------------------------------------
// STATE_TOKENS — colores de estado vía CSS vars
// Referencia: tokens.css sección "Estado de tarea"
// ---------------------------------------------------------------------------

export interface EstadoTokens {
  bg:     string;   // fondo del elemento
  fg:     string;   // texto principal
  border: string;   // borde izquierdo de acento
  meta:   string;   // texto secundario / meta info
}

export interface UrgenciaTokens {
  bg:      string;
  fg:      string;
  border:  string;
  badgeBg: string;
  badgeFg: string;
}

/**
 * Colores por estado de tarea. Usar en lugar de hex inline.
 *
 * Ejemplo:
 *   const t = STATE_TOKENS[tarea.estado];
 *   style={{ background: t.bg, color: t.fg, borderLeft: `3px solid ${t.border}` }}
 */
export const STATE_TOKENS: Record<EstadoTarea, EstadoTokens> = {
  atrasada: {
    bg:     'var(--mc-state-atrasada-bg)',
    fg:     'var(--mc-state-atrasada-fg)',
    border: 'var(--mc-state-atrasada-border)',
    meta:   'var(--mc-state-atrasada-meta)',
  },
  bloqueada: {
    bg:     'var(--mc-state-bloqueada-bg)',
    fg:     'var(--mc-state-bloqueada-fg)',
    border: 'var(--mc-state-bloqueada-border)',
    meta:   'var(--mc-state-bloqueada-meta)',
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
    bg:     'transparent',
    fg:     'var(--mc-color-text)',
    border: 'transparent',
    meta:   'var(--mc-color-text-secondary)',
  },
  cancelada: {
    bg:     'transparent',
    fg:     'var(--mc-color-text-secondary)',
    border: 'transparent',
    meta:   'var(--mc-color-text-placeholder)',
  },
};

/**
 * Colores por urgencia horaria (vista HOY, Kanban).
 * Solo aplica a estados pendiente / en_progreso.
 */
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
// Tarea — badge class
// ---------------------------------------------------------------------------
export const TAREA_BADGE: Record<EstadoTarea, string> = {
  pendiente:    'mc-badge-neutral',
  en_progreso:  'mc-badge-info',
  completada:   'mc-badge-success',
  bloqueada:    'mc-badge-warning',
  atrasada:     'mc-badge-danger',
  reprogramada: 'mc-badge-neutral',
  cancelada:    'mc-badge-neutral',
};

// ---------------------------------------------------------------------------
// Tarea — label legible
// ---------------------------------------------------------------------------
export const TAREA_LABEL: Record<EstadoTarea, string> = {
  pendiente:    'Pendiente',
  en_progreso:  'En progreso',
  completada:   'Completada',
  bloqueada:    'Bloqueada',
  atrasada:     'Atrasada',
  reprogramada: 'Reprogramada',
  cancelada:    'Cancelada',
};

// ---------------------------------------------------------------------------
// Tarea — label en plural
// ---------------------------------------------------------------------------
export const TAREA_LABEL_PLURAL: Record<EstadoTarea, string> = {
  pendiente:    'pendientes',
  en_progreso:  'en progreso',
  completada:   'completadas',
  bloqueada:    'bloqueadas',
  atrasada:     'atrasadas',
  reprogramada: 'reprogramadas',
  cancelada:    'canceladas',
};

// ---------------------------------------------------------------------------
// Tarea — pill con color inline (tablas, Planificación)
// Estas clases Tailwind son necesarias porque el componente pill se renderiza
// en contextos sin acceso directo a style={{}}. Mantener en sync con tokens.
// ---------------------------------------------------------------------------
export const TAREA_PILL: Record<EstadoTarea, string> = {
  pendiente:    'bg-[#F1EFE8] text-[#5F5E5A]',
  en_progreso:  'bg-[#E6F1FB] text-[#185FA5]',
  completada:   'bg-[#EAF3DE] text-[#27500A]',
  bloqueada:    'bg-[#FAEEDA] text-[#854F0B]',
  atrasada:     'bg-[#FCEBEB] text-[#A32D2D]',
  reprogramada: 'bg-[#EEEDFE] text-[#3C3489]',
  cancelada:    'bg-[#F1F1F1] text-[#6B6B6B]',
};

// ---------------------------------------------------------------------------
// Objetivo — badge class
// ---------------------------------------------------------------------------
export const OBJETIVO_BADGE: Record<EstadoObjetivo, string> = {
  activo:     'mc-badge-accent',
  completado: 'mc-badge-success',
  cancelado:  'mc-badge-neutral',
};

// ---------------------------------------------------------------------------
// Objetivo — label legible
// ---------------------------------------------------------------------------
export const OBJETIVO_LABEL: Record<EstadoObjetivo, string> = {
  activo:     'Activo',
  completado: 'Completado',
  cancelado:  'Cancelado',
};

// ---------------------------------------------------------------------------
// Urgencia horaria — clases y labels
// Estas constantes quedan para compatibilidad; la lógica de color
// debe leer de URGENCIA_TOKENS en lugar de URGENCIA_BORDER/BG.
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