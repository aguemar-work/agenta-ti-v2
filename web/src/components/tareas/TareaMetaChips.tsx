import { ESTADO_OT_LABEL } from '@/lib/otConfig';
import type { OrdenTrabajo } from '@/api/ordenTrabajo';

type Props = {
  ot?: OrdenTrabajo | null;
  onOtClick?: (ot: OrdenTrabajo) => void;
};

/** Chips de vínculo en card (solo OT; vencimiento va en la línea de situación). */
export function TareaMetaChips({ ot, onOtClick }: Props) {
  if (!ot) return null;

  return (
    <button
      type="button"
      className="mc-chip mc-chip--ot"
      onClick={(e) => {
        e.stopPropagation();
        onOtClick?.(ot);
      }}
      title={`OT ${ot.numero}: ${ESTADO_OT_LABEL[ot.estado]}`}
    >
      OT · {ESTADO_OT_LABEL[ot.estado]}
    </button>
  );
}
