import { MiSemanaStatsInline } from '@/components/semana/MiSemanaStatsInline';

type Resumen = {
  atrasadas: number;
  otsPendientes: number;
  incidenciasActivas: number;
  justificacionesSinLeer: number;
};

type Props = {
  resumen: Resumen;
};

export function PlanificacionAlertas({ resumen }: Props) {
  const items = [
    { key: 'atrasadas', label: 'Atrasadas', value: resumen.atrasadas },
    { key: 'ots', label: 'OT pendientes', value: resumen.otsPendientes },
    { key: 'incidencias', label: 'Incidencias', value: resumen.incidenciasActivas },
    { key: 'justificaciones', label: 'Sin leer', value: resumen.justificacionesSinLeer },
  ];

  return (
    <section aria-label="Alertas del equipo">
      <MiSemanaStatsInline readOnly ariaLabel="Alertas del equipo" items={items} />
    </section>
  );
}
