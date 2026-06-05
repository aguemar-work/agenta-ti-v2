import type { KpisComparativaMiembro } from '@/api/objetivosMetricas';
import { colorCumplimiento, inicialesNombre, pct } from '@/lib/metricasHelpers';

type Props = {
  comparativa: KpisComparativaMiembro[];
  loading: boolean;
  embedded?: boolean;
};

export function MetricasComparativa({ comparativa, loading, embedded = false }: Props) {
  const className = embedded ? 'mc-metricas-comparativa mc-metricas-embedded' : 'mc-card mc-metricas-comparativa';

  const content = (
    <>
      {!embedded ? <h2 className="mc-metricas-section-title">Comparativa por miembro</h2> : null}
      {loading ? (
        <p className="text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
      ) : comparativa.length === 0 ? (
        <p className="text-sm text-[var(--mc-color-text-secondary)]">Sin datos.</p>
      ) : (
        <div className="mc-metricas-comparativa__scroll">
          <table className="mc-metricas-comparativa__table">
            <thead>
              <tr>
                {['Miembro', 'Compl.', 'Atr.', 'Repr.', 'Cumpl.'].map((h) => (
                  <th key={h} className="mc-metricas-comparativa__th">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparativa.map((m) => {
                const totalM = m.completadas + m.atrasadas + m.reprogramadas;
                const cumplM = pct(m.completadas, totalM);
                const esBajo = totalM > 0 && cumplM < 50;

                return (
                  <tr
                    key={m.usuarioId}
                    className={esBajo ? 'mc-metricas-comparativa__row--bajo' : undefined}
                  >
                    <td className="mc-metricas-comparativa__miembro">
                      <span className="mc-metricas-avatar" aria-hidden>
                        {inicialesNombre(m.nombre)}
                      </span>
                      <span className="mc-metricas-comparativa__nombre">
                        {m.nombre}
                        {esBajo ? <span className="mc-metricas-comparativa__alerta">bajo</span> : null}
                      </span>
                    </td>
                    <td className="mc-metricas-comparativa__num mc-metricas-comparativa__num--ok">{m.completadas}</td>
                    <td className={`mc-metricas-comparativa__num ${m.atrasadas > 0 ? 'mc-metricas-comparativa__num--danger' : ''}`}>
                      {m.atrasadas}
                    </td>
                    <td className="mc-metricas-comparativa__num">{m.reprogramadas}</td>
                    <td className="mc-metricas-comparativa__cumpl">
                      <div className="mc-metricas-comparativa__bar-track">
                        <div
                          className="mc-metricas-comparativa__bar-fill"
                          style={{ width: `${cumplM}%`, background: colorCumplimiento(cumplM) }}
                        />
                      </div>
                      <span className="tabular-nums font-semibold" style={{ color: colorCumplimiento(cumplM) }}>
                        {cumplM}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div className={className}>{content}</div>;
  }
  return <section className={className}>{content}</section>;
}
