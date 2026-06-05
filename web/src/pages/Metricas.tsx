import { useMemo } from 'react';
import { useKpisComparativa, useKpisPorSemana, useKpisRango, useObjetivosProgreso } from '@/hooks/useObjetivosMetricas';
import { useMetricasOT } from '@/hooks/useMetricasOT';
import { useUsuariosActivos } from '@/hooks/useUsuarios';
import { MetricasHero } from '@/components/metricas/MetricasHero';
import { MetricasResumen } from '@/components/metricas/MetricasResumen';
import { MetricasChartSemanal } from '@/components/metricas/MetricasChartSemanal';
import { MetricasDonutOT } from '@/components/metricas/MetricasDonutOT';
import { MetricasComparativa } from '@/components/metricas/MetricasComparativa';
import { MetricasObjetivos } from '@/components/metricas/MetricasObjetivos';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { fechaLocalYmd } from '@/lib/fecha';
import { pct } from '@/lib/metricasHelpers';
import { useAuthStore } from '@/store/authStore';
import { useFilterSearchParams } from '@/lib/useFilterSearchParams';

function defaultDesde() {
  const d = new Date();
  d.setDate(d.getDate() - 28);
  return fechaLocalYmd(d);
}

const METRICAS_FILTER_DEFAULT = {
  desde: defaultDesde(),
  hasta: fechaLocalYmd(new Date()),
  m: '',
} as const;

export function Metricas() {
  const usuario = useAuthStore((s) => s.usuario);
  const esJefe = usuario?.rol === 'jefe';

  const [filtros, setFiltro] = useFilterSearchParams(METRICAS_FILTER_DEFAULT);
  const desde = filtros.desde;
  const hasta = filtros.hasta;
  const miembroFiltro = esJefe ? (filtros.m ? filtros.m : undefined) : usuario?.id;

  const { data: usuariosLista = [] } = useUsuariosActivos();
  const nombres = Object.fromEntries(usuariosLista.map((u) => [u.id, u.nombre]));
  const uid = esJefe ? miembroFiltro : usuario?.id;

  const { data: kpis, isLoading: loadK } = useKpisRango(desde, hasta, uid);
  const { data: porSemana = [], isLoading: loadS } = useKpisPorSemana(desde, hasta, uid);
  const { data: comparativa = [], isLoading: loadC } = useKpisComparativa(desde, hasta, esJefe);
  const { data: objetivos = [], isLoading: loadObj } = useObjetivosProgreso();
  const { data: otCounts, isLoading: loadOT } = useMetricasOT(desde, hasta, esJefe);

  const maxTotal = useMemo(() => Math.max(...porSemana.map((s) => s.total), 1), [porSemana]);
  const cumplimiento = kpis ? pct(kpis.completadas, kpis.total) : null;

  const miembrosBajoRendimiento = useMemo(
    () =>
      comparativa.filter((m) => {
        const tot = m.completadas + m.atrasadas + m.reprogramadas;
        return tot > 0 && pct(m.completadas, tot) < 50;
      }).length,
    [comparativa],
  );

  if (!usuario) return null;

  const subtitulo =
    esJefe && miembrosBajoRendimiento > 0
      ? `${miembrosBajoRendimiento} miembro${miembrosBajoRendimiento > 1 ? 's' : ''} con cumplimiento bajo · comparativa semanal del equipo`
      : 'Cumplimiento ponderado, evolución semanal y objetivos del período';

  return (
    <div className={`${APP_PAGE_CLASS} mc-metricas-page`}>
      <PageHeader title="Métricas" subtitle={subtitulo} />

      <FilterBar>
        <FilterBar.Date id="metricas-desde" label="Desde" value={desde} onChange={(v) => setFiltro('desde', v)} />
        <FilterBar.Date id="metricas-hasta" label="Hasta" value={hasta} onChange={(v) => setFiltro('hasta', v)} />
        {esJefe && (
          <FilterBar.Select
            id="metricas-miembro"
            label="Miembro"
            value={miembroFiltro ?? ''}
            onChange={(v) => setFiltro('m', v)}
            options={[
              { value: '', label: 'Todos' },
              ...Object.entries(nombres).map(([id, nombre]) => ({ value: id, label: nombre })),
            ]}
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
