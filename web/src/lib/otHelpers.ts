import type { OrdenTrabajo } from '@/api/ordenTrabajo';

/** Una OT está vencida si su fecha_estimada pasó y aún no está completada/cancelada/rechazada */
export function otVencida(ot: OrdenTrabajo, hoyYmd: string): boolean {
  if (['completada', 'cancelada', 'rechazada'].includes(ot.estado)) return false;
  return Boolean(ot.fecha_estimada && ot.fecha_estimada < hoyYmd);
}
