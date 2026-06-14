import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { MetricasChartSemanal } from '@/components/metricas/MetricasChartSemanal';
import { MetricasComparativa } from '@/components/metricas/MetricasComparativa';
import { MetricasDonutOT } from '@/components/metricas/MetricasDonutOT';
import { useKpisComparativa, useKpisRangoYSemana } from '@/hooks/useObjetivosMetricas';
import { useMetricasOT } from '@/hooks/useMetricasOT';
import { useMemo } from 'react';

type Props = {
  periodoDesde: string;
  periodoHasta: string;
};

export function PlanificacionRendimiento({ periodoDesde, periodoHasta }: Props) {
  const [abierto, setAbierto] = useState(false);

  const { data: metricasCompletas, isLoading: loadS } = useKpisRangoYSemana(periodoDesde, periodoHasta);
  const porSemana = metricasCompletas?.porSemana ?? [];
  const { data: comparativa = [], isLoading: loadC } = useKpisComparativa(periodoDesde, periodoHasta, abierto);
  const { data: otCounts, isLoading: loadOT } = useMetricasOT(periodoDesde, periodoHasta, abierto);

  const maxTotal = useMemo(() => Math.max(...porSemana.map((s) => s.total), 1), [porSemana]);

  return (
    <section className="mc-plan-rendimiento">
      <button
        type="button"
        className="mc-plan-rendimiento__toggle"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        <span className="mc-plan-seccion__title m-0">Rendimiento del equipo</span>
        <span className="text-xs text-[var(--mc-color-text-secondary)]">
          Período {periodoDesde} – {periodoHasta}
        </span>
        <ChevronDown
          size={18}
          aria-hidden
          className={['mc-plan-rendimiento__chevron', abierto ? 'mc-plan-rendimiento__chevron--open' : ''].join(' ')}
        />
      </button>

      {abierto && (
        <div className="mc-plan-rendimiento__body">
          <MetricasComparativa comparativa={comparativa} loading={loadC} />
          <div className="mc-metricas-analisis">
            <MetricasChartSemanal porSemana={porSemana} maxTotal={maxTotal} loading={loadS} />
            <MetricasDonutOT counts={otCounts} loading={loadOT} />
          </div>
        </div>
      )}
    </section>
  );
}
