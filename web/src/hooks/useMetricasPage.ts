import { useMemo } from 'react';

import { useKpisComparativa, useKpisPorSemana, useKpisRango, useObjetivosProgreso } from '@/hooks/useObjetivosMetricas';
import { useMetricasOT } from '@/hooks/useMetricasOT';
import { useUsuariosActivos } from '@/hooks/useUsuarios';
import { fechaLocalYmd } from '@/lib/fecha';
import { pct } from '@/lib/metricasHelpers';
import { useFilterSearchParams } from '@/lib/useFilterSearchParams';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';

function defaultDesde() {
  const d = new Date();
  d.setDate(d.getDate() - 28);
  return fechaLocalYmd(d);
}

export const METRICAS_FILTER_DEFAULT = {
  desde: defaultDesde(),
  hasta: fechaLocalYmd(new Date()),
  m: '',
} as const;

export function useMetricasPage() {
  const usuario = useAuthStore((s) => s.usuario);
  const esJefe = useWorkspaceStore((s) => s.esJefe());

  const [filtros, setFiltro] = useFilterSearchParams(METRICAS_FILTER_DEFAULT);
  const desde = filtros.desde;
  const hasta = filtros.hasta;
  const miembroFiltro = esJefe ? (filtros.m ? filtros.m : undefined) : usuario?.id;

  const { data: usuariosLista = [] } = useUsuariosActivos();
  const nombres = useMemo(
    () => Object.fromEntries(usuariosLista.map((u) => [u.id, u.nombre])),
    [usuariosLista],
  );
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

  const subtitulo =
    esJefe && miembrosBajoRendimiento > 0
      ? `${miembrosBajoRendimiento} miembro${miembrosBajoRendimiento > 1 ? 's' : ''} con cumplimiento bajo · comparativa semanal del equipo`
      : 'Cumplimiento ponderado, evolución semanal y objetivos del período';

  const opcionesMiembro = useMemo(
    () => [
      { value: '', label: 'Todos' },
      ...Object.entries(nombres).map(([id, nombre]) => ({ value: id, label: nombre })),
    ],
    [nombres],
  );

  return {
    usuario,
    esJefe,
    filtros: { desde, hasta, miembroFiltro },
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
  };
}
