import type { OrdenTrabajo } from '@/api/ordenTrabajo';
import { ESTADO_OT_BADGE, ESTADO_OT_LABEL } from '@/lib/otConfig';
import { otVencida } from '@/lib/otHelpers';

type Props = {
  ot: OrdenTrabajo;
  hoy: string;
  selected: boolean;
  onSelect: () => void;
};

export function OTListaMobileItem({ ot, hoy, selected, onSelect }: Props) {
  const vencida = otVencida(ot, hoy);
  const esUrgente = ot.prioridad === 'urgente';

  return (
    <button
      type="button"
      className={[
        'mc-ot-swipe__content',
        'mc-ot-mobile-row',
        selected ? 'mc-ot-swipe__content--selected' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onSelect}
    >
      <div className="mc-ot-mobile-row__top">
        <span className="mc-ot-mobile-row__numero">{ot.numero}</span>
        <span className={`mc-badge ${ESTADO_OT_BADGE[ot.estado]}`} style={{ fontSize: 9 }}>
          {ESTADO_OT_LABEL[ot.estado]}
        </span>
      </div>
      <p className="mc-ot-mobile-row__titulo">{ot.tipo_trabajo?.nombre ?? ot.descripcion}</p>
      <div className="mc-ot-mobile-row__meta">
        {esUrgente && (
          <span className="mc-badge mc-badge-danger" style={{ fontSize: 9 }}>
            Urgente
          </span>
        )}
        <span className={vencida ? 'mc-ot-mobile-row__fecha--vencida' : ''}>{ot.fecha_estimada}</span>
      </div>
    </button>
  );
}
