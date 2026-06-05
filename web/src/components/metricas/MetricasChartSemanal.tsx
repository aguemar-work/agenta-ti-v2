import type { KpisPorSemana } from '@/api/objetivosMetricas';
import { colorCumplimiento, pct } from '@/lib/metricasHelpers';

const COLORES: Record<string, string> = {
  completadas: 'var(--mc-state-completada-fg)',
  atrasadas: 'var(--mc-state-atrasada-border)',
  reprogramadas: 'var(--mc-state-reprogramada-border)',
  en_progreso: 'var(--mc-state-progreso-border)',
  pendientes: 'var(--mc-color-neutral-soft)',
};

const LEYENDA = [
  { key: 'completadas', label: 'Completadas' },
  { key: 'en_progreso', label: 'En progreso' },
  { key: 'pendientes', label: 'Pendientes' },
  { key: 'atrasadas', label: 'Atrasadas' },
  { key: 'reprogramadas', label: 'Reprogramadas' },
] as const;

type Props = {
  porSemana: KpisPorSemana[];
  maxTotal: number;
  loading: boolean;
  embedded?: boolean;
};

export function MetricasChartSemanal({ porSemana, maxTotal, loading, embedded = false }: Props) {
  const leyenda = (
    <div className="mc-metricas-chart__leyenda">
      {LEYENDA.map(({ key, label }) => (
        <span key={key} className="mc-metricas-chart__leyenda-item">
          <span className="mc-metricas-chart__swatch" style={{ background: COLORES[key] }} aria-hidden />
          {label}
        </span>
      ))}
    </div>
  );

  const body = loading ? (
    <p className="text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
  ) : porSemana.length === 0 ? (
    <p className="text-sm text-[var(--mc-color-text-secondary)]">Sin datos en el rango seleccionado.</p>
  ) : (
    <div className="mc-metricas-chart__rows">
      {porSemana.map((s) => {
        const tasaSem = pct(s.completadas, s.total);
        return (
          <div key={s.semanaISO} className="mc-metricas-chart__row">
            <span className="mc-metricas-chart__semana">{s.semana}</span>
            <div
              className="mc-metricas-chart__bar"
              role="img"
              aria-label={`Semana ${s.semana}: ${s.total} tareas, ${tasaSem}% cumplimiento`}
            >
              {LEYENDA.map(({ key }) => {
                const val = s[key as keyof typeof s] as number;
                if (!val) return null;
                const w = (val / maxTotal) * 100;
                return (
                  <div
                    key={key}
                    className="mc-metricas-chart__segment"
                    style={{ width: `${w}%`, background: COLORES[key] }}
                    title={`${val} ${key}`}
                  >
                    {w > 8 ? <span className="mc-chart-segment-value">{val}</span> : null}
                  </div>
                );
              })}
              <div className="mc-metricas-chart__segment mc-metricas-chart__segment--fill" />
            </div>
            <div className="mc-metricas-chart__totals">
              <span className="tabular-nums font-medium">{s.total}</span>
              <span className="tabular-nums font-semibold" style={{ color: colorCumplimiento(tasaSem) }}>
                {tasaSem}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );

  const className = embedded ? 'mc-metricas-chart mc-metricas-embedded' : 'mc-card mc-metricas-chart';

  const content = (
    <>
      <div className="mc-metricas-chart__head">
        {!embedded ? <h2 className="mc-metricas-section-title">Tareas por semana</h2> : null}
        {leyenda}
      </div>
      {body}
    </>
  );

  if (embedded) {
    return <div className={className}>{content}</div>;
  }
  return <section className={className}>{content}</section>;
}
