import { FilterBar } from '@/components/ui/FilterBar';
import { MiSemanaStatsInline } from '@/components/semana/MiSemanaStatsInline';

type Resumen = {
  atrasadas: number;
  otsPendientes: number;
  incidenciasActivas: number;
  justificacionesPendientes: number;
};

type Props = {
  resumen: Resumen;
  periodoDesde: string;
  periodoHasta: string;
  onPeriodoDesde: (v: string) => void;
  onPeriodoHasta: (v: string) => void;
};

export function PlanificacionToolbar({
  resumen,
  periodoDesde,
  periodoHasta,
  onPeriodoDesde,
  onPeriodoHasta,
}: Props) {
  const items = [
    {
      key: 'atrasadas',
      label: 'Atrasadas',
      value: resumen.atrasadas,
      tone: resumen.atrasadas > 0 ? ('warning' as const) : ('default' as const),
    },
    {
      key: 'ots',
      label: 'OT pendientes',
      value: resumen.otsPendientes,
      tone: resumen.otsPendientes > 0 ? ('warning' as const) : ('default' as const),
    },
    {
      key: 'incidencias',
      label: 'Incidencias',
      value: resumen.incidenciasActivas,
      tone: resumen.incidenciasActivas > 0 ? ('default' as const) : ('default' as const),
    },
    {
      key: 'justificaciones',
      label: 'Pend. revisión',
      value: resumen.justificacionesPendientes,
      tone: resumen.justificacionesPendientes > 0 ? ('warning' as const) : ('default' as const),
    },
  ];

  return (
    <div className="mc-plan-toolbar mc-card" aria-label="Resumen operativo">
      <div className="mc-plan-toolbar__stats">
        <MiSemanaStatsInline readOnly ariaLabel="Alertas del equipo" items={items} />
      </div>
      <div className="mc-plan-toolbar__periodo" role="group" aria-label="Período de rendimiento">
        <span className="mc-plan-toolbar__periodo-label">Período rendimiento</span>
        <div className="mc-plan-toolbar__periodo-inputs">
          <FilterBar.Date id="plan-desde" label="Desde" value={periodoDesde} onChange={onPeriodoDesde} />
          <FilterBar.Date id="plan-hasta" label="Hasta" value={periodoHasta} onChange={onPeriodoHasta} />
        </div>
      </div>
    </div>
  );
}
