import { MetricasChartSemanal } from '@/components/metricas/MetricasChartSemanal';
import { MetricasComparativa } from '@/components/metricas/MetricasComparativa';
import { MetricasDonutOT } from '@/components/metricas/MetricasDonutOT';
import { PlanificacionHeatmap } from '@/components/planificacion/PlanificacionHeatmap';
import { PlanificacionMobile } from '@/components/planificacion/PlanificacionMobile';
import { PlanificacionPanel } from '@/components/planificacion/PlanificacionPanel';
import { useKpisComparativa, useKpisPorSemana } from '@/hooks/useObjetivosMetricas';
import { useMetricasOT } from '@/hooks/useMetricasOT';
import { useMemo } from 'react';
import type { EstadoTarea } from '@/types';

type Miembro = { id: string; nombre: string };

type Props = {
  isDesktop: boolean;
  periodoDesde: string;
  periodoHasta: string;
  miembros: Miembro[];
  diasLab: Date[];
  cuenta: (uid: string, ymd: string) => number;
  totalDiaEquipo: (ymd: string) => number;
  conteoEstadosDiaMiembro: (uid: string, ymd: string) => Partial<Record<EstadoTarea, number>>;
  mobileMiembro: Miembro | null;
  onSelectMiembro: (m: Miembro | null) => void;
  onCeldaClick: (usuarioId: string, fecha: string, nombre: string) => void;
};

export function PlanificacionAnalisisGrid({
  isDesktop,
  periodoDesde,
  periodoHasta,
  miembros,
  diasLab,
  cuenta,
  totalDiaEquipo,
  conteoEstadosDiaMiembro,
  mobileMiembro,
  onSelectMiembro,
  onCeldaClick,
}: Props) {
  const { data: porSemana = [], isLoading: loadS } = useKpisPorSemana(periodoDesde, periodoHasta, undefined);
  const { data: comparativa = [], isLoading: loadC } = useKpisComparativa(periodoDesde, periodoHasta, true);
  const { data: otCounts, isLoading: loadOT } = useMetricasOT(periodoDesde, periodoHasta, true);

  const maxTotal = useMemo(() => Math.max(...porSemana.map((s) => s.total), 1), [porSemana]);

  return (
    <div className="mc-plan-grid-analisis" aria-label="Análisis de carga y rendimiento">
      <PlanificacionPanel
        title="Carga semanal"
        titleId="plan-heatmap-title"
        className="mc-plan-grid-analisis__carga"
        fill
      >
        {isDesktop ? (
          <PlanificacionHeatmap
            embedded
            miembros={miembros}
            diasLab={diasLab}
            cuenta={cuenta}
            totalDiaEquipo={totalDiaEquipo}
            onCeldaClick={onCeldaClick}
          />
        ) : (
          <PlanificacionMobile
            miembros={miembros}
            diasLab={diasLab}
            cuenta={cuenta}
            conteoEstadosDiaMiembro={conteoEstadosDiaMiembro}
            miembroSel={mobileMiembro}
            onSelectMiembro={onSelectMiembro}
            onCeldaClick={onCeldaClick}
          />
        )}
      </PlanificacionPanel>

      <PlanificacionPanel title="Carga comparativa" titleId="plan-comparativa-title" fill>
        <MetricasComparativa embedded comparativa={comparativa} loading={loadC} />
      </PlanificacionPanel>

      <PlanificacionPanel title="Tareas por semana" titleId="plan-chart-semana-title" fill>
        <MetricasChartSemanal embedded porSemana={porSemana} maxTotal={maxTotal} loading={loadS} />
      </PlanificacionPanel>

      <PlanificacionPanel title="OTs del período" titleId="plan-ot-periodo-title" fill>
        <MetricasDonutOT embedded counts={otCounts} loading={loadOT} />
      </PlanificacionPanel>
    </div>
  );
}
