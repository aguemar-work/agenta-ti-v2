/** Ruta de planificación con foco en alertas SLA (mig. 029). */
export const PLANIFICACION_SLA_VISTA = 'sla';

export function planificacionSlaPath(): string {
  return `/planificacion?vista=${PLANIFICACION_SLA_VISTA}`;
}
