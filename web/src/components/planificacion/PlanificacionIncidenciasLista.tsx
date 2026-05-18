import { EmptyState } from '@/components/ui/EmptyState';
import { TareaEstadoIndicator } from '@/components/tareas/TareaEstadoIndicator';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import type { Tarea } from '@/types';

type Props = {
  incidencias: Tarea[];
  bloqueadas: Tarea[];
  loading: boolean;
  hoyYmd: string;
  nombreMiembro: Record<string, string>;
};

export function PlanificacionIncidenciasLista({ incidencias, bloqueadas, loading, hoyYmd, nombreMiembro }: Props) {
  const items = [
    ...incidencias.map((t) => ({ t, tipo: 'imprevisto' as const })),
    ...bloqueadas.map((t) => ({ t, tipo: 'bloqueada' as const })),
  ];

  return (
    <section className="mc-card mc-plan-seccion" aria-labelledby="plan-incidencias-title">
      <h2 id="plan-incidencias-title" className="mc-plan-seccion__title">
        Incidencias registradas
      </h2>
      {loading ? (
        <p className="m-0 text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
      ) : items.length === 0 ? (
        <EmptyState compact title="Sin incidencias esta semana" desc="No hay imprevistos ni bloqueos registrados." />
      ) : (
        <ul className="mc-plan-feed">
          {items.map(({ t, tipo }) => {
            const est = estadoEfectivoTablero(t, hoyYmd);
            return (
              <li key={`${tipo}-${t.id}`} className="mc-plan-feed__item">
                <div className="mc-plan-feed__meta">
                  <span className="mc-plan-feed__autor">{nombreMiembro[t.asignado_a] ?? '—'}</span>
                  <span className="mc-plan-feed__tag">
                    {tipo === 'imprevisto' ? 'Imprevisto' : 'Bloqueada'}
                  </span>
                </div>
                <p className="mc-plan-feed__texto">{t.titulo}</p>
                <TareaEstadoIndicator estado={est} variant="pill" plural />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
