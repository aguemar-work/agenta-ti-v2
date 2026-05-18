import type { EstadoOT } from '@/api/ordenTrabajo';
import { ESTADO_OT_LABEL } from '@/lib/otConfig';

/** Camino principal del flujo formal (sin rechazo/cancelación). */
export const OT_FLUJO_PRINCIPAL: EstadoOT[] = [
  'borrador',
  'pendiente',
  'aprobada',
  'en_ejecucion',
  'completada',
];

export function etiquetaFlujoOT(estado: EstadoOT): string {
  const corto: Partial<Record<EstadoOT, string>> = {
    pendiente: 'Pendiente',
    en_ejecucion: 'Ejecución',
    completada: 'Completada',
  };
  return corto[estado] ?? ESTADO_OT_LABEL[estado];
}
