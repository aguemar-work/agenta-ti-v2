import type { LogActividadItem } from '@/api/audit';
import { EmptyState } from '@/components/ui/EmptyState';

const MAX_VISIBLE = 7;

function labelActividad(tipo: string): string {
  const m: Record<string, string> = {
    completada: 'Completó tarea',
    bloqueada: 'Bloqueó tarea',
    reprogramada: 'Reprogramó tarea',
    cancelada: 'Canceló tarea',
    desbloqueada: 'Desbloqueó tarea',
  };
  return m[tipo] ?? 'Actividad';
}

type Props = {
  actividad: LogActividadItem[];
  loading: boolean;
  onVerToda: () => void;
};

export function PlanificacionActividadReciente({ actividad, loading, onVerToda }: Props) {
  const visible = actividad.slice(0, MAX_VISIBLE);

  return (
    <section className="mc-card mc-plan-seccion" aria-labelledby="plan-actividad-title">
      <h2 id="plan-actividad-title" className="mc-plan-seccion__title">
        Actividad del equipo
      </h2>
      {loading ? (
        <p className="m-0 text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
      ) : visible.length === 0 ? (
        <EmptyState compact title="Sin actividad reciente" desc="No hay acciones registradas esta semana." />
      ) : (
        <ul className="mc-plan-feed">
          {visible.map((item) => (
            <li key={item.id} className="mc-plan-feed__item">
              <div className="mc-plan-feed__meta">
                <span className="mc-plan-feed__autor">{item.usuario_nombre}</span>
                <span className="mc-plan-feed__hora">
                  {new Date(item.created_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </div>
              <p className="mc-plan-feed__texto">
                {labelActividad(item.tipo_accion)}
                {item.tarea_titulo ? `: ${item.tarea_titulo}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
      {actividad.length > 0 && (
        <button type="button" className="mc-plan-seccion__link" onClick={onVerToda}>
          Ver toda la actividad
          <span aria-hidden> →</span>
        </button>
      )}
    </section>
  );
}
