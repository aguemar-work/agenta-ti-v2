import { ESTADO_OT_LABEL } from '@/lib/otConfig';
import { tareaVenceHoy } from '@/lib/venceHoy';
import type { OrdenTrabajo } from '@/api/ordenTrabajo';
import type { Tarea } from '@/types';

type Props = {
  tarea: Tarea;
  hoyYmd: string;
  ot?: OrdenTrabajo | null;
  onOtClick?: (ot: OrdenTrabajo) => void;
};

export function TareaMetaChips({ tarea, hoyYmd, ot, onOtClick }: Props) {
  return (
    <>
      {tareaVenceHoy(tarea, hoyYmd) && (
        <span className="mc-chip mc-chip--vence-hoy">Vence hoy</span>
      )}
      {ot && (
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
      )}
    </>
  );
}
