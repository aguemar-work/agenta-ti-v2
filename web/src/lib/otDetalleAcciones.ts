import type { OrdenTrabajo } from '@/api/ordenTrabajo';

export type OTDetalleAcciones = {
  esJefe: boolean;
  puedeAprobar: boolean;
  puedeRechazar: boolean;
  puedeIniciar: boolean;
  puedeCompletar: boolean;
  puedeEditar: boolean;
  puedeCancelar: boolean;
  puedeImprimir: boolean;
  aprobarPending: boolean;
  onAprobar: () => void;
  onRechazar: () => void;
  onIniciar: () => void;
  onCompletar: () => void;
  onEditar: () => void;
  onCancelar: () => void;
  onImprimir: () => void;
};

type Handlers = {
  onAprobar: (id: string) => void;
  onRechazar: (ot: OrdenTrabajo) => void;
  onIniciar: (id: string) => void;
  onCompletar: (ot: OrdenTrabajo) => void;
  onEditar: (ot: OrdenTrabajo) => void;
  onCancelar: (id: string) => void;
  onImprimir: (ot: OrdenTrabajo) => void;
  aprobarPending?: boolean;
};

export function buildOTDetalleAcciones(
  ot: OrdenTrabajo,
  esJefe: boolean,
  handlers: Handlers,
): OTDetalleAcciones {
  const puedeAprobar = esJefe && ot.estado === 'pendiente';
  const puedeRechazar = esJefe && ot.estado === 'pendiente';
  const puedeIniciar = !esJefe && ot.estado === 'aprobada';
  const puedeCompletar = !esJefe && ['aprobada', 'en_ejecucion'].includes(ot.estado);
  const puedeEditar = !esJefe && ['borrador', 'pendiente'].includes(ot.estado);
  const puedeCancelar = !esJefe && ['borrador', 'pendiente'].includes(ot.estado);
  const puedeImprimir = ['aprobada', 'en_ejecucion', 'completada'].includes(ot.estado);

  return {
    esJefe,
    puedeAprobar,
    puedeRechazar,
    puedeIniciar,
    puedeCompletar,
    puedeEditar,
    puedeCancelar,
    puedeImprimir,
    aprobarPending: handlers.aprobarPending ?? false,
    onAprobar: () => handlers.onAprobar(ot.id),
    onRechazar: () => handlers.onRechazar(ot),
    onIniciar: () => handlers.onIniciar(ot.id),
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
): { aprobar: boolean; completar: boolean; cancelar: boolean } {
  return {
    aprobar: esJefe && ot.estado === 'pendiente',
    completar: !esJefe && ['aprobada', 'en_ejecucion'].includes(ot.estado),
    cancelar:
      (!esJefe && ['borrador', 'pendiente'].includes(ot.estado)) ||
      (esJefe && ot.estado === 'pendiente'),
  };
}
