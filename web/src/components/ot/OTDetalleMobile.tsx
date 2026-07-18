import { useRef } from 'react';

import type { OrdenTrabajo } from '@/api/ordenTrabajo';
import { OTDetalleContenido } from '@/components/ot/OTDetalleContenido';
import { useDialogA11y } from '@/hooks/useDialogA11y';
import type { OTDetalleAcciones } from '@/lib/otDetalleAcciones';
import { labelNumeroOT } from '@/lib/otNumero';

type Props = {
  ot: OrdenTrabajo;
  hoy: string;
  acciones: OTDetalleAcciones;
  onClose: () => void;
};

export function OTDetalleMobile({ ot, hoy, acciones, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Siempre montado con open=true: el padre lo monta/desmonta condicionalmente.
  useDialogA11y(true, onClose, panelRef);

  return (
    <div ref={panelRef} className="mc-ot-detalle-mobile" role="dialog" aria-modal="true" aria-label="Detalle de orden de trabajo" tabIndex={-1}>
      <header className="mc-ot-detalle-mobile__header">
        <button type="button" className="mc-btn-ghost mc-btn-sm" onClick={onClose}>
          ← Volver
        </button>
        <h2 className="mc-ot-detalle-mobile__title">{labelNumeroOT(ot.numero)}</h2>
      </header>
      <div className="mc-ot-detalle-mobile__body">
        <OTDetalleContenido ot={ot} hoy={hoy} acciones={acciones} />
      </div>
    </div>
  );
}
