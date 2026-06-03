import { useMemo } from 'react';
import type { EstadoOT } from '@/api/ordenTrabajo';
import { ESTADO_OT_LABEL } from '@/lib/otConfig';
import type { OtEstadoCount } from '@/hooks/useMetricasOT';
import { conicGradientDonut } from '@/lib/metricasHelpers';

const OT_DONUT_COLORS: Partial<Record<EstadoOT, string>> = {
  completada: 'var(--mc-color-success)',
  aprobada: 'var(--mc-color-accent)',
  pendiente: 'var(--mc-color-warning)',
  borrador: 'var(--mc-color-neutral-soft)',
  rechazada: 'var(--mc-color-danger)',
  cancelada: 'var(--mc-color-text-secondary)',
};

const OT_DONUT_ORDER: EstadoOT[] = [
  'completada',
  'aprobada',
  'pendiente',
  'borrador',
  'rechazada',
  'cancelada',
];

type Props = {
  counts: OtEstadoCount | undefined;
  loading: boolean;
  embedded?: boolean;
};

export function MetricasDonutOT({ counts, loading, embedded = false }: Props) {
  const { total, segments, gradient } = useMemo(() => {
    const c = counts ?? {};
    const totalN = Object.values(c).reduce((a, n) => a + (n ?? 0), 0);
    if (totalN === 0) {
      return { total: 0, segments: [] as { estado: EstadoOT; n: number; pct: number; color: string }[], gradient: '' };
    }
    const segments = OT_DONUT_ORDER.filter((e) => (c[e] ?? 0) > 0).map((estado) => {
      const n = c[estado] ?? 0;
      return {
        estado,
        n,
        pct: Math.round((n / totalN) * 100),
        color: OT_DONUT_COLORS[estado] ?? 'var(--mc-color-border)',
      };
    });
    const gradient = conicGradientDonut(segments.map((s) => ({ pct: s.pct, color: s.color })));
    return { total: totalN, segments, gradient };
  }, [counts]);

  const className = embedded ? 'mc-metricas-donut-ot mc-metricas-embedded' : 'mc-card mc-metricas-donut-ot';
  const content = (
    <>
      {!embedded ? <h2 className="mc-metricas-section-title">OTs del período</h2> : null}
      {loading ? (
        <p className="text-xs text-[var(--mc-color-text-secondary)]">Cargando…</p>
      ) : total === 0 ? (
        <p className="text-xs text-[var(--mc-color-text-secondary)]">Sin OTs en el rango.</p>
      ) : (
        <div className="mc-metricas-donut-ot__body">
          <div
            className="mc-metricas-donut-ot__ring"
            style={{ background: gradient }}
            role="img"
            aria-label={`${total} órdenes de trabajo`}
          >
            <div className="mc-metricas-donut-ot__hole">
              <span className="mc-metricas-donut-ot__total tabular-nums">{total}</span>
              <span className="mc-metricas-donut-ot__total-label">OTs</span>
            </div>
          </div>
          <ul className="mc-metricas-donut-ot__leyenda">
            {segments.map((s) => (
              <li key={s.estado} className="mc-metricas-donut-ot__leyenda-item">
                <span className="mc-metricas-donut-ot__dot" style={{ background: s.color }} aria-hidden />
                <span className="mc-metricas-donut-ot__leyenda-label">{ESTADO_OT_LABEL[s.estado]}</span>
                <span className="mc-metricas-donut-ot__leyenda-n tabular-nums">{s.n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );

  if (embedded) {
    return (
      <div className={className} aria-label="Órdenes de trabajo por estado">
        {content}
      </div>
    );
  }
  return (
    <section className={className} aria-label="Órdenes de trabajo por estado">
      {content}
    </section>
  );
}
