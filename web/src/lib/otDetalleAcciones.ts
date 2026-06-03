import type { OrdenTrabajo } from '@/api/ordenTrabajo';

export type OTDetalleAcciones = {
  esJefe: boolean;
  puedeAprobar: boolean;
  puedeRechazar: boolean;
  puedeCompletar: boolean;
  puedeEditar: boolean;
  puedeCancelar: boolean;
  puedeImprimir: boolean;
  aprobarPending: boolean;
  onAprobar: () => void;
  onRechazar: () => void;
  onCompletar: () => void;
  onEditar: () => void;
  onCancelar: () => void;
  onImprimir: () => void;
};

type Handlers = {
  onAprobar: (id: string) => void;
  onRechazar: (ot: OrdenTrabajo) => void;
  onCompletar: (ot: OrdenTrabajo) => void;
  onEditar: (ot: OrdenTrabajo) => void;
  onCancelar: (id: string) => void;
  onImprimir: (ot: OrdenTrabajo) => void;
  aprobarPending?: boolean;
};

/** Alineado con RPCs sgtd_completar_ot (creador o jefe, estado aprobada). */
export function buildOTDetalleAcciones(
  ot: OrdenTrabajo,
  esJefe: boolean,
  usuarioId: string | undefined,
  handlers: Handlers,
): OTDetalleAcciones {
  const esCreador = Boolean(usuarioId && ot.creado_por === usuarioId);
  const puedeEjecutar = esJefe || esCreador;

  const puedeAprobar = esJefe && ot.estado === 'pendiente';
  const puedeRechazar = esJefe && ot.estado === 'pendiente';
  const puedeCompletar = puedeEjecutar && ot.estado === 'aprobada';
  const puedeEditar = esCreador && ['borrador', 'pendiente'].includes(ot.estado);
  const puedeCancelar = esCreador && ['borrador', 'pendiente'].includes(ot.estado);
  const puedeImprimir = ['aprobada', 'completada'].includes(ot.estado);

  return {
    esJefe,
    puedeAprobar,
    puedeRechazar,
    puedeCompletar,
    puedeEditar,
    puedeCancelar,
    puedeImprimir,
    aprobarPending: handlers.aprobarPending ?? false,
    onAprobar: () => handlers.onAprobar(ot.id),
    onRechazar: () => handlers.onRechazar(ot),
    onCompletar: () => handlers.onCompletar(ot),
    onEditar: () => handlers.onEditar(ot),
    onCancelar: () => handlers.onCancelar(ot.id),
    onImprimir: () => handlers.onImprimir(ot),
  };
}

/** Acciones expuestas en swipe móvil (subconjunto rápido). */
export function accionesSwipeOT(
  ot: OrdenTrabajo,
  esJefe: boolean,
  usuarioId: string | undefined,
): { aprobar: boolean; completar: boolean; cancelar: boolean } {
  const esCreador = Boolean(usuarioId && ot.creado_por === usuarioId);
  const puedeEjecutar = esJefe || esCreador;
  return {
    aprobar: esJefe && ot.estado === 'pendiente',
    completar: puedeEjecutar && ot.estado === 'aprobada',
    cancelar:
      (esCreador && ['borrador', 'pendiente'].includes(ot.estado)) ||
      (esJefe && ot.estado === 'pendiente'),
  };
}
