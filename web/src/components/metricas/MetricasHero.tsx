import type { KpisPorSemana } from '@/api/objetivosMetricas';
import { bgCumplimiento, colorCumplimiento, pct } from '@/lib/metricasHelpers';

type Props = {
  cumplimiento: number | null;
  loading: boolean;
  completadas: number;
  total: number;
  porSemana: KpisPorSemana[];
};

function DeltaSemanaAnterior({ porSemana }: { porSemana: KpisPorSemana[] }) {
  if (porSemana.length < 2) return null;
  const ultima = porSemana.at(-1);
  const anterior = porSemana.at(-2);
  if (!ultima || !anterior) return null;
  const diff = pct(ultima.completadas, ultima.total) - pct(anterior.completadas, anterior.total);
  if (diff === 0) return null;
  const sube = diff > 0;
  return (
    <span
      className={[
        'mc-metricas-hero__delta',
        sube ? 'mc-metricas-hero__delta--up' : 'mc-metricas-hero__delta--down',
      ].join(' ')}
    >
      {sube ? '▲' : '▼'} {Math.abs(diff)} pp vs sem. anterior
    </span>
  );
}

export function MetricasHero({ cumplimiento, loading, completadas, total, porSemana }: Props) {
  const p = cumplimiento ?? 0;

  return (
    <section
      className="mc-metricas-hero"
      style={{
        background: loading ? 'var(--mc-color-surface)' : bgCumplimiento(p),
      }}
      aria-label="Tasa de cumplimiento del período"
    >
      <div className="mc-metricas-hero__main">
        {loading ? (
          <span className="mc-metricas-hero__value mc-metricas-hero__value--loading">—</span>
        ) : (
          <div className="mc-metricas-hero__value-row">
            <span className="mc-metricas-hero__value" style={{ color: colorCumplimiento(p) }}>
              {p}%
            </span>
            <DeltaSemanaAnterior porSemana={porSemana} />
          </div>
        )}
        <p className="mc-metricas-hero__label">Tasa de cumplimiento</p>
        {!loading && total > 0 && (
          <p className="mc-metricas-hero__sub">
            {completadas} de {total} tareas completadas en el período
          </p>
        )}
      </div>
      {!loading && total > 0 && (
        <div className="mc-metricas-hero__bar-wrap">
          <div className="mc-progress-track mc-metricas-hero__track">
            <div
              className="mc-progress-fill"
              style={{ width: `${p}%`, background: colorCumplimiento(p) }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
