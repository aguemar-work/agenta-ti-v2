import type { LogActividadItem } from '@/api/audit';
import { PlanificacionPanel } from '@/components/planificacion/PlanificacionPanel';
import { EmptyState } from '@/components/ui/EmptyState';
import { labelLogActividadFeed } from '@/lib/logAccionLabels';
import { inicialesNombre } from '@/lib/metricasHelpers';

const MAX_VISIBLE = 7;

type Props = {
  actividad: LogActividadItem[];
  loading: boolean;
  onVerToda: () => void;
};

export function PlanificacionActividadReciente({ actividad, loading, onVerToda }: Props) {
  const visible = actividad.slice(0, MAX_VISIBLE);

  return (
    <PlanificacionPanel title="Actividad del equipo" titleId="plan-actividad-title" fill>
      {loading ? (
        <p className="m-0 text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
      ) : visible.length === 0 ? (
        <EmptyState compact title="Sin actividad reciente" desc="No hay acciones registradas esta semana." />
      ) : (
        <ul className="mc-plan-row-list">
          {visible.map((item) => (
            <li key={item.id} className="mc-plan-row">
              <span className="mc-metricas-avatar" aria-hidden>
                {inicialesNombre(item.usuario_nombre)}
              </span>
              <div className="mc-plan-row__body">
                <div className="mc-plan-row__meta">
                  <span className="mc-plan-row__autor">{item.usuario_nombre}</span>
                  <time className="mc-plan-row__hora" dateTime={item.created_at}>
                    {new Date(item.created_at).toLocaleString('es', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </time>
                </div>
                <p className="mc-plan-row__texto">
                  {labelLogActividadFeed(item.tipo_accion)}
                  {item.tarea_titulo ? `: ${item.tarea_titulo}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {actividad.length > 0 && (
        <button type="button" className="mc-plan-panel__link" onClick={onVerToda}>
          Ver toda la actividad
          <span aria-hidden> →</span>
        </button>
      )}
    </PlanificacionPanel>
  );
}
