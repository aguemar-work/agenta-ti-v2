/**
 * lib/estadoConfig.ts
 * Fuente única de verdad para labels, badges y estilos de estado.
 * Resuelve hallazgo 1.4: mapas duplicados en ≥5 archivos.
 *
 * Uso:
 *   import { TAREA_BADGE, TAREA_LABEL, OBJETIVO_BADGE, OBJETIVO_LABEL } from '@/lib/estadoConfig';
 *
 *   <span className={`mc-badge ${TAREA_BADGE[estado]}`}>{TAREA_LABEL[estado]}</span>
 */

import type { EstadoObjetivo, EstadoTarea } from '@/types';

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
// Tarea — label en plural (para resúmenes, ej: Planificación)
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
// Tarea — pill con color inline (para tablas con fondo propio, ej: Planificación)
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