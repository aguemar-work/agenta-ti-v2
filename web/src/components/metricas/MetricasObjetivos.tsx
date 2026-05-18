import { Link } from 'react-router-dom';
import type { ObjetivoConProgreso } from '@/api/objetivosMetricas';
import { OBJETIVO_BADGE, OBJETIVO_LABEL } from '@/lib/estadoConfig';
import type { EstadoObjetivo } from '@/types';
import { colorCumplimiento } from '@/lib/metricasHelpers';

type Props = {
  objetivos: ObjetivoConProgreso[];
  loading: boolean;
};

export function MetricasObjetivos({ objetivos, loading }: Props) {
  const activos = objetivos.filter((o) => o.estado === 'activo').slice(0, 8);

  return (
    <section className="mc-metricas-objetivos">
      <div className="mc-metricas-objetivos__head">
        <h2 className="mc-metricas-section-title">Objetivos activos</h2>
        <Link to="/objetivos" className="mc-metricas-objetivos__link">
          Ver todos →
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
      ) : activos.length === 0 ? (
        <p className="text-sm text-[var(--mc-color-text-secondary)]">Sin objetivos activos.</p>
      ) : (
        <div className="mc-metricas-objetivos__grid">
          {activos.map((o) => (
            <article key={o.id} className="mc-metricas-objetivo-card">
              <div className="mc-metricas-objetivo-card__top">
                <p className="mc-metricas-objetivo-card__titulo">{o.titulo}</p>
                <span className={`mc-badge ${OBJETIVO_BADGE[o.estado as EstadoObjetivo]}`} style={{ fontSize: 9 }}>
                  {OBJETIVO_LABEL[o.estado as EstadoObjetivo]}
                </span>
              </div>
              <div className="mc-metricas-objetivo-card__bar-track">
                <div
                  className="mc-metricas-objetivo-card__bar-fill"
                  style={{ width: `${o.pct}%`, background: colorCumplimiento(o.pct) }}
                />
              </div>
              <p className="mc-metricas-objetivo-card__meta">
                <span className="tabular-nums font-semibold" style={{ color: colorCumplimiento(o.pct) }}>
                  {o.pct}%
                </span>
                <span>
                  {o.completadas}/{o.total_tareas} tareas
                </span>
                {o.fecha_limite ? <span>· {o.fecha_limite}</span> : null}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
