import type { OrdenTrabajo } from '@/api/ordenTrabajo';
import { ESTADO_OT_BADGE, ESTADO_OT_LABEL } from '@/lib/otConfig';
import { otVencida } from '@/lib/otHelpers';

const GRID_COLS = 'minmax(128px, 150px) 1fr 96px';

type Props = {
  ot: OrdenTrabajo;
  hoy: string;
  selected: boolean;
  onSelect: () => void;
};

export function OTTablaFila({ ot, hoy, selected, onSelect }: Props) {
  const esUrgente = ot.prioridad === 'urgente';
  const vencida = otVencida(ot, hoy);

  return (
    <button
      type="button"
      className={[
        'mc-ot-row mc-list-row',
        selected ? 'mc-list-row--selected' : '',
      ].filter(Boolean).join(' ')}
      style={{ gridTemplateColumns: GRID_COLS }}
      onClick={onSelect}
    >
      <div className="mc-ot-row__numero">
        <span className="mc-ot-row__numero-text">{ot.numero}</span>
        <span className={`mc-badge ${ESTADO_OT_BADGE[ot.estado]}`} style={{ fontSize: 9 }}>
          {ESTADO_OT_LABEL[ot.estado]}
        </span>
      </div>

      <div className="min-w-0 text-left">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] font-medium text-[var(--mc-color-text)]">
            {ot.tipo_trabajo?.nombre ?? ot.descripcion}
          </span>
          {esUrgente && (
            <span className="mc-badge mc-badge-danger shrink-0" style={{ fontSize: 9 }}>
              Urgente
            </span>
          )}
        </div>
        {ot.tipo_trabajo?.nombre && (
          <p className="m-0 truncate text-[11px] text-[var(--mc-color-text-secondary)]">{ot.descripcion}</p>
        )}
      </div>

      <div className="text-left">
        <span className={`text-xs ${vencida ? 'font-semibold text-[var(--mc-color-danger)]' : 'text-[var(--mc-color-text-secondary)]'}`}>
          {ot.fecha_estimada}
        </span>
        {vencida && (
          <span className="block text-[10px] text-[var(--mc-color-danger)]">Vencida</span>
        )}
      </div>
    </button>
  );
}

export const OT_TABLA_GRID_COLS = GRID_COLS;
