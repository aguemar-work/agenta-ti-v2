/** Camino principal del flujo formal (sin rechazo/cancelación). */
import type { EstadoOT } from '@/api/ordenTrabajo';
import { ESTADO_OT_LABEL } from '@/lib/otConfig';

export const OT_FLUJO_PRINCIPAL: EstadoOT[] = [
  'borrador',
  'pendiente',
  'aprobada',
  'completada',
];

export function etiquetaFlujoOT(estado: EstadoOT): string {
  const corto: Partial<Record<EstadoOT, string>> = {
    pendiente: 'Pendiente',
    completada: 'Completada',
  };
  return corto[estado] ?? ESTADO_OT_LABEL[estado];
}
