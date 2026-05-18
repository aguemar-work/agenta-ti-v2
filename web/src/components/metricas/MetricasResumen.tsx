import type { KpisRango } from '@/api/objetivosMetricas';

type Item = { key: string; label: string; value: number };

type Props = {
  kpis: KpisRango | undefined;
  loading: boolean;
};

export function MetricasResumen({ kpis, loading }: Props) {
  const items: Item[] = [
    { key: 'total', label: 'Total', value: kpis?.total ?? 0 },
    { key: 'completadas', label: 'Completadas', value: kpis?.completadas ?? 0 },
    { key: 'atrasadas', label: 'Atrasadas', value: kpis?.atrasadas ?? 0 },
    { key: 'en_progreso', label: 'En progreso', value: kpis?.en_progreso ?? 0 },
    { key: 'bloqueadas', label: 'Bloqueadas', value: kpis?.bloqueadas ?? 0 },
    { key: 'reprogramadas', label: 'Reprogramadas', value: kpis?.reprogramadas ?? 0 },
    { key: 'incidencias', label: 'Incidencias', value: kpis?.incidencias ?? 0 },
  ];

  return (
    <div className="mc-metricas-resumen" role="group" aria-label="Resumen del período">
      {items.map((item) => (
        <div key={item.key} className="mc-metricas-resumen__item">
          <span className="mc-metricas-resumen__value tabular-nums">
            {loading ? '—' : item.value}
          </span>
          <span className="mc-metricas-resumen__label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
