import { PlanificacionPanel } from '@/components/planificacion/PlanificacionPanel';
import { EmptyState } from '@/components/ui/EmptyState';
import { TareaEstadoIndicator } from '@/components/tareas/TareaEstadoIndicator';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import { inicialesNombre } from '@/lib/metricasHelpers';
import type { Tarea } from '@/types';

type Props = {
  incidencias: Tarea[];
  loading: boolean;
  hoyYmd: string;
  nombreMiembro: Record<string, string>;
};

export function PlanificacionIncidenciasLista({
  incidencias,
  loading,
  hoyYmd,
  nombreMiembro,
}: Props) {
  return (
    <PlanificacionPanel title="Incidencias registradas" titleId="plan-incidencias-title" fill>
      {loading ? (
        <p className="m-0 text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
      ) : incidencias.length === 0 ? (
        <EmptyState compact title="Sin incidencias esta semana" desc="No hay imprevistos registrados." />
      ) : (
        <ul className="mc-plan-row-list">
          {incidencias.map((t) => {
            const est = estadoEfectivoTablero(t, hoyYmd);
            const nombre = nombreMiembro[t.asignado_a] ?? '—';
            return (
              <li key={t.id} className="mc-plan-row">
                <span className="mc-metricas-avatar" aria-hidden>
                  {inicialesNombre(nombre)}
                </span>
                <div className="mc-plan-row__body">
                  <div className="mc-plan-row__meta">
                    <span className="mc-plan-row__autor">{nombre}</span>
                    <span className="mc-badge mc-badge-secondary">Imprevisto</span>
                  </div>
                  <p className="mc-plan-row__texto">{t.titulo}</p>
                  <TareaEstadoIndicator estado={est} variant="pill" plural />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PlanificacionPanel>
  );
}
