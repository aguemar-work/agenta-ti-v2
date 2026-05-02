/**
 * lib/estadoConfig.ts
 * Fuente única de verdad para labels, badges y estilos de estado.
 */

import type { EstadoObjetivo, EstadoTarea, UrgenciaHoraria } from '@/types';

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
// Urgencia horaria — clases CSS inline para la tarjeta de tarea
// Estas clases deben existir en el CSS global (sprint4.css o tokens.css)
// ---------------------------------------------------------------------------
export const URGENCIA_BORDER: Record<UrgenciaHoraria, string> = {
  normal:      '',
  precaucion:  'border-[#EF9F27]',
  urgente:     'border-[#E24B4A]',
  vencida_hoy: 'border-[#A32D2D]',
};

export const URGENCIA_BG: Record<UrgenciaHoraria, string> = {
  normal:      '',
  precaucion:  '',
  urgente:     'bg-[#FCEBEB]',
  vencida_hoy: 'bg-[#E24B4A]',
};

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