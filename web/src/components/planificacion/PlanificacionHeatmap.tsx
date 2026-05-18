import { claseCeldaSaturacion, LEYENDA_SATURACION } from '@/lib/planificacionCarga';
import { fechaLocalYmd } from '@/lib/fecha';

const DIAS_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

type Miembro = { id: string; nombre: string };

type Props = {
  miembros: Miembro[];
  diasLab: Date[];
  cuenta: (uid: string, ymd: string) => number;
  totalDiaEquipo: (ymd: string) => number;
  onCeldaClick: (usuarioId: string, fecha: string, nombre: string) => void;
};

export function PlanificacionHeatmap({
  miembros,
  diasLab,
  cuenta,
  totalDiaEquipo,
  onCeldaClick,
}: Props) {
  return (
    <section className="mc-plan-heatmap" aria-label="Carga de trabajo por miembro">
      <div className="mc-plan-heatmap__leyenda">
        {LEYENDA_SATURACION.map(({ rango, label, clase }) => (
          <span key={rango} className="mc-plan-heatmap__leyenda-item">
            <span className={`mc-plan-heatmap__leyenda-muestra ${clase}`} aria-hidden />
            {label}
          </span>
        ))}
      </div>

      <div className="planificacion-carga-scroll mc-card !p-0 overflow-hidden">
        <table className="planificacion-carga-table w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--mc-color-border)]">
              <th className="planificacion-celda-miembro mc-plan-table-head">Miembro</th>
              {diasLab.map((d, i) => (
                <th key={fechaLocalYmd(d)} className="mc-plan-table-head p-2">
                  {DIAS_CORTO[i]} {d.getDate()}
                </th>
              ))}
              <th className="mc-plan-table-head p-2">Σ</th>
            </tr>
          </thead>
          <tbody>
            {miembros.map((u) => {
              const totalSem = diasLab.reduce((acc, d) => acc + cuenta(u.id, fechaLocalYmd(d)), 0);
              return (
                <tr key={u.id} className="border-b border-[var(--mc-color-border)]">
                  <td className="planificacion-celda-miembro p-2 font-medium text-[var(--mc-color-text)]">
                    {u.nombre}
                  </td>
                  {diasLab.map((d) => {
                    const ymd = fechaLocalYmd(d);
                    const n = cuenta(u.id, ymd);
                    return (
                      <td key={ymd} className="p-1.5">
                        <button
                          type="button"
                          className={`planificacion-celda-btn mc-plan-celda ${claseCeldaSaturacion(n)}`}
                          onClick={() => onCeldaClick(u.id, ymd, u.nombre)}
                          aria-label={`${u.nombre}, ${ymd}: ${n} tareas`}
                        >
                          {n}
                        </button>
                      </td>
                    );
                  })}
                  <td className="p-2 text-center text-xs font-medium tabular-nums text-[var(--mc-color-text-secondary)]">
                    {totalSem}
                  </td>
                </tr>
              );
            })}

            <tr className="planificacion-fila-resumen border-t border-[var(--mc-color-border)]">
              <td className="planificacion-celda-miembro p-2 text-[10px] font-medium uppercase tracking-wide text-[var(--mc-color-text-secondary)]">
                Equipo
              </td>
              {diasLab.map((d) => {
                const ymd = fechaLocalYmd(d);
                const total = totalDiaEquipo(ymd);
                return (
                  <td key={ymd} className="p-2 text-center">
                    <span className="mc-plan-resumen-dia tabular-nums font-semibold text-[var(--mc-color-text)]">
                      {total}
                    </span>
                  </td>
                );
              })}
              <td className="p-2" />
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
