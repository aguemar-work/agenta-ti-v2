import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { LogAccion } from '@/types';

type Props = {
  logs: LogAccion[];
  loading: boolean;
  error: boolean;
  pending: boolean;
  nombreMiembro: Record<string, string>;
  titulosTarea: Record<string, string>;
  onMarcarLeido: (id: string) => void;
};

function labelTipo(tipo: string): string {
  const m: Record<string, string> = {
    bloqueada: 'Bloqueo',
    cancelada: 'Cancelación',
    reprogramada: 'Reprogramación',
    eliminada: 'Eliminación',
  };
  return m[tipo] ?? tipo;
}

export function PlanificacionJustificaciones({
  logs,
  loading,
  error,
  pending,
  nombreMiembro,
  titulosTarea,
  onMarcarLeido,
}: Props) {
  return (
    <section className="mc-card mc-plan-seccion" aria-labelledby="plan-justificaciones-title">
      <h2 id="plan-justificaciones-title" className="mc-plan-seccion__title">
        Justificaciones sin leer
        {logs.length > 0 ? (
          <span className="mc-plan-seccion__count" aria-label={`${logs.length} pendientes`}>
            {logs.length}
          </span>
        ) : null}
      </h2>
      {error && (
        <p className="m-0 text-sm text-[var(--mc-color-danger)]">No se pudieron cargar las justificaciones.</p>
      )}
      {loading ? (
        <p className="m-0 text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
      ) : logs.length === 0 ? (
        <EmptyState compact title="Sin pendientes" desc="Todas las justificaciones han sido revisadas." />
      ) : (
        <ul className="mc-plan-justificaciones">
          {logs.map((log) => (
            <li key={log.id} className="mc-plan-justificaciones__item">
              <div className="mc-plan-justificaciones__head">
                <span className="mc-plan-justificaciones__tipo">{labelTipo(log.tipo_accion)}</span>
                <span className="mc-plan-justificaciones__meta">
                  {nombreMiembro[log.usuario_id] ?? '—'}
                  {' · '}
                  {new Date(log.created_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </div>
              {log.tarea_id && titulosTarea[log.tarea_id] ? (
                <p className="mc-plan-justificaciones__tarea">{titulosTarea[log.tarea_id]}</p>
              ) : null}
              <p className="mc-plan-justificaciones__texto">{log.justificacion}</p>
              <Button variant="ghost" size="xs" disabled={pending} onClick={() => onMarcarLeido(log.id)}>
                Marcar como leído
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
