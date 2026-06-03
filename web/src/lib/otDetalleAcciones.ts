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

/** Alineado con RPCs sgtd_iniciar_ejecucion_ot / sgtd_completar_ot (creador o jefe). */
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
  const puedeIniciar = puedeEjecutar && ot.estado === 'aprobada';
  /** RPC exige estado en_ejecucion — no mostrar en aprobada. */
  const puedeCompletar = puedeEjecutar && ot.estado === 'en_ejecucion';
  const puedeEditar = esCreador && ['borrador', 'pendiente'].includes(ot.estado);
  const puedeCancelar = esCreador && ['borrador', 'pendiente'].includes(ot.estado);
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
  usuarioId: string | undefined,
): { aprobar: boolean; completar: boolean; cancelar: boolean } {
  const esCreador = Boolean(usuarioId && ot.creado_por === usuarioId);
  const puedeEjecutar = esJefe || esCreador;
  return {
    aprobar: esJefe && ot.estado === 'pendiente',
    completar: puedeEjecutar && ot.estado === 'en_ejecucion',
    cancelar:
      (esCreador && ['borrador', 'pendiente'].includes(ot.estado)) ||
      (esJefe && ot.estado === 'pendiente'),
  };
}
