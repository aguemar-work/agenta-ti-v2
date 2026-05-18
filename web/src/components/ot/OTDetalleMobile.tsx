import type { OrdenTrabajo } from '@/api/ordenTrabajo';
import { OTDetalleContenido } from '@/components/ot/OTDetalleContenido';
import type { OTDetalleAcciones } from '@/lib/otDetalleAcciones';

type Props = {
  ot: OrdenTrabajo;
  hoy: string;
  acciones: OTDetalleAcciones;
  onClose: () => void;
};

export function OTDetalleMobile({ ot, hoy, acciones, onClose }: Props) {
  return (
    <div className="mc-ot-detalle-mobile" role="dialog" aria-modal="true" aria-label="Detalle de orden de trabajo">
      <header className="mc-ot-detalle-mobile__header">
        <button type="button" className="mc-btn-ghost mc-btn-sm" onClick={onClose}>
          ← Volver
        </button>
        <h2 className="mc-ot-detalle-mobile__title">{ot.numero}</h2>
      </header>
      <div className="mc-ot-detalle-mobile__body">
        <OTDetalleContenido ot={ot} hoy={hoy} acciones={acciones} />
      </div>
    </div>
  );
}
