/**
 * lib/otConfig.ts
 * Configuración de presentación para Órdenes de Trabajo.
 */

import type { EstadoOT, ModalidadOT, PrioridadOT } from '@/api/ordenTrabajo';

export const ESTADO_OT_LABEL: Record<EstadoOT, string> = {
  borrador:     'Borrador',
  pendiente:    'Pendiente aprobación',
  aprobada:     'Aprobada',
  en_ejecucion: 'En ejecución',
  completada:   'Completada',
  rechazada:    'Rechazada',
  cancelada:    'Cancelada',
};

export const ESTADO_OT_BADGE: Record<EstadoOT, string> = {
  borrador:     'mc-badge-neutral',
  pendiente:    'mc-badge-warning',
  aprobada:     'mc-badge-accent',
  en_ejecucion: 'mc-badge-info',
  completada:   'mc-badge-success',
  rechazada:    'mc-badge-danger',
  cancelada:    'mc-badge-neutral',
};

export const MODALIDAD_OT_LABEL: Record<ModalidadOT, string> = {
  presencial: 'Presencial',
  remoto:     'Remoto',
  viaje:      'Viaje',
};

export const PRIORIDAD_OT_LABEL: Record<PrioridadOT, string> = {
  normal:  'Normal',
  urgente: 'Urgente',
};

export const PRIORIDAD_OT_BADGE: Record<PrioridadOT, string> = {
  normal:  'mc-badge-neutral',
  urgente: 'mc-badge-danger',
};