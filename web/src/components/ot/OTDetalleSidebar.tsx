import type { OrdenTrabajo } from '@/api/ordenTrabajo';
import { OTDetalleContenido } from '@/components/ot/OTDetalleContenido';
import type { OTDetalleAcciones } from '@/lib/otDetalleAcciones';
import { labelNumeroOT } from '@/lib/otNumero';

type Props = {
  ot: OrdenTrabajo;
  hoy: string;
  acciones: OTDetalleAcciones;
  onClose: () => void;
};

export function OTDetalleSidebar({ ot, hoy, acciones, onClose }: Props) {
  return (
    <aside className="mc-ot-sidebar" role="complementary" aria-label="Detalle de orden de trabajo">
      <header className="mc-ot-sidebar__header">
        <div className="min-w-0 flex-1">
          <p className="mc-ot-sidebar__numero">{labelNumeroOT(ot.numero)}</p>
          <p className="mc-ot-sidebar__titulo">{ot.tipo_trabajo?.nombre ?? ot.descripcion}</p>
        </div>
        <button type="button" className="mc-modal-close" onClick={onClose} aria-label="Cerrar panel">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </header>
      <div className="mc-ot-sidebar__body">
        <OTDetalleContenido ot={ot} hoy={hoy} acciones={acciones} />
      </div>
    </aside>
  );
}
