import { MetricasHero } from '@/components/metricas/MetricasHero';
import { MetricasResumen } from '@/components/metricas/MetricasResumen';
import { MetricasChartSemanal } from '@/components/metricas/MetricasChartSemanal';
import { MetricasDonutOT } from '@/components/metricas/MetricasDonutOT';
import { MetricasComparativa } from '@/components/metricas/MetricasComparativa';
import { MetricasObjetivos } from '@/components/metricas/MetricasObjetivos';
import { useMetricasPage } from '@/hooks/useMetricasPage';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';

export function Metricas() {
  const {
    usuario,
    esJefe,
    filtros,
    setFiltro,
    kpis,
    porSemana,
    comparativa,
    objetivos,
    otCounts,
    loadK,
    loadS,
    loadC,
    loadObj,
    loadOT,
    maxTotal,
    cumplimiento,
    subtitulo,
    opcionesMiembro,
  } = useMetricasPage();

  if (!usuario) return null;

  return (
    <div className={`${APP_PAGE_CLASS} mc-metricas-page`}>
      <PageHeader title="Métricas" subtitle={subtitulo} />

      <FilterBar>
        <FilterBar.Date
          id="metricas-desde"
          label="Desde"
          value={filtros.desde}
          onChange={(v) => setFiltro('desde', v)}
        />
        <FilterBar.Date
          id="metricas-hasta"
          label="Hasta"
          value={filtros.hasta}
          onChange={(v) => setFiltro('hasta', v)}
        />
        {esJefe && (
          <FilterBar.Select
            id="metricas-miembro"
            label="Miembro"
            value={filtros.miembroFiltro ?? ''}
            onChange={(v) => setFiltro('m', v)}
            options={opcionesMiembro}
            minWidth={180}
          />
        )}
      </FilterBar>

      <MetricasHero
        cumplimiento={cumplimiento}
        loading={loadK}
        completadas={kpis?.completadas ?? 0}
        total={kpis?.total ?? 0}
        porSemana={porSemana}
      />

      <MetricasResumen kpis={kpis} loading={loadK} />

      <div className="mc-metricas-analisis">
        <MetricasChartSemanal porSemana={porSemana} maxTotal={maxTotal} loading={loadS} />
        {esJefe && <MetricasDonutOT counts={otCounts} loading={loadOT} />}
      </div>

      {esJefe && <MetricasComparativa comparativa={comparativa} loading={loadC} />}

      {esJefe && <MetricasObjetivos objetivos={objetivos} loading={loadObj} />}
    </div>
  );
}
