import type { ObjetivoConProgreso } from '@/api/objetivosMetricas';
import {
  ObjetivoBadgeRiesgo,
  ObjetivoBarraProgreso,
  claseProgresoMetaNivel,
} from '@/components/objetivos/ObjetivoProgreso';
import { OBJETIVO_BADGE, OBJETIVO_LABEL } from '@/lib/estadoConfig';
import { nivelRiesgoObjetivo } from '@/lib/tareaUrgencia';
import type { EstadoObjetivo } from '@/types';

type Props = {
  objetivo: ObjetivoConProgreso;
  responsableNombre: string | null;
  selected: boolean;
  onSelect: () => void;
};

export function ObjetivoTablaFila({ objetivo: o, responsableNombre, selected, onSelect }: Props) {
  const nivel = nivelRiesgoObjetivo(o.pct, o.fecha_limite, o.total_tareas);
  const esCrit = nivel === 'critico';
  const vencido =
    Boolean(o.fecha_limite) &&
    new Date(`${o.fecha_limite}T12:00:00`) < new Date() &&
    o.estado === 'activo';

  return (
    <button
      type="button"
      className={[
        'mc-list-row mc-objetivo-row mc-objetivos-table-grid',
        selected ? 'mc-list-row--selected' : '',
        !selected && esCrit ? 'mc-list-row--atrasada' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onSelect}
    >
      <div className="mc-objetivo-row__titulo min-w-0 text-left">
        <p className="mc-objetivo-row__titulo-text">{o.titulo}</p>
        <div className="mc-objetivo-row__meta">
          <ObjetivoBadgeRiesgo pct={o.pct} fechaLimite={o.fecha_limite} totalTareas={o.total_tareas} />
          {vencido && <span className="mc-badge mc-badge-warning text-[10px]">Vencido</span>}
        </div>
      </div>

      <span className="mc-objetivo-row__cell truncate text-xs text-[var(--mc-color-text-secondary)]">
        {responsableNombre ?? '—'}
      </span>

      <span className={`mc-badge ${OBJETIVO_BADGE[o.estado as EstadoObjetivo]} text-[10px]`}>
        {OBJETIVO_LABEL[o.estado as EstadoObjetivo]}
      </span>

      <div className="mc-objetivo-row__progreso">
        <ObjetivoBarraProgreso pct={o.pct} fechaLimite={o.fecha_limite} totalTareas={o.total_tareas} />
        <span
          className={[
            'mc-objetivo-row__progreso-meta',
            claseProgresoMetaNivel(nivel),
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {o.completadas}/{o.total_tareas} · {o.pct}%
        </span>
      </div>

      <span
        className={[
          'mc-objetivo-row__cell text-xs tabular-nums',
          esCrit ? 'font-medium text-[var(--mc-state-atrasada-meta)]' : 'text-[var(--mc-color-text-secondary)]',
        ].join(' ')}
      >
        {o.fecha_limite ?? '—'}
      </span>
    </button>
  );
}
