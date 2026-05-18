import { claseCeldaSaturacion } from '@/lib/planificacionCarga';
import { textoResumenDia } from '@/lib/planificacionResumen';
import { fechaLocalYmd } from '@/lib/fecha';
import type { EstadoTarea } from '@/types';

const DIAS_LARGO = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

type Miembro = { id: string; nombre: string };

type Props = {
  miembros: Miembro[];
  diasLab: Date[];
  cuenta: (uid: string, ymd: string) => number;
  conteoEstadosDiaMiembro: (uid: string, ymd: string) => Partial<Record<EstadoTarea, number>>;
  miembroSel: Miembro | null;
  onSelectMiembro: (m: Miembro | null) => void;
  onCeldaClick: (usuarioId: string, fecha: string, nombre: string) => void;
};

export function PlanificacionMobile({
  miembros,
  diasLab,
  cuenta,
  conteoEstadosDiaMiembro,
  miembroSel,
  onSelectMiembro,
  onCeldaClick,
}: Props) {
  if (miembroSel) {
    const totalSem = diasLab.reduce((acc, d) => acc + cuenta(miembroSel.id, fechaLocalYmd(d)), 0);
    return (
      <div className="mc-plan-mobile-miembro">
        <header className="mc-plan-mobile-miembro__header">
          <button type="button" className="mc-btn-ghost mc-btn-sm" onClick={() => onSelectMiembro(null)}>
            ← Equipo
          </button>
          <h2 className="mc-plan-mobile-miembro__title">{miembroSel.nombre}</h2>
          <span className="text-xs tabular-nums text-[var(--mc-color-text-secondary)]">{totalSem} tareas</span>
        </header>
        <ul className="mc-plan-mobile-dias">
          {diasLab.map((d, i) => {
            const ymd = fechaLocalYmd(d);
            const n = cuenta(miembroSel.id, ymd);
            return (
              <li key={ymd}>
                <button
                  type="button"
                  className={`mc-plan-mobile-dia ${claseCeldaSaturacion(n)}`}
                  onClick={() => onCeldaClick(miembroSel.id, ymd, miembroSel.nombre)}
                >
                  <span className="mc-plan-mobile-dia__label">
                    {DIAS_LARGO[i]} {d.getDate()}
                  </span>
                  <span className="mc-plan-mobile-dia__count tabular-nums">{n}</span>
                  <span className="mc-plan-mobile-dia__resumen">{textoResumenDia(conteoEstadosDiaMiembro(miembroSel.id, ymd))}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <ul className="mc-plan-mobile-lista">
      {miembros.map((u) => {
        const total = diasLab.reduce((acc, d) => acc + cuenta(u.id, fechaLocalYmd(d)), 0);
        const maxDia = Math.max(...diasLab.map((d) => cuenta(u.id, fechaLocalYmd(d))), 0);
        return (
          <li key={u.id}>
            <button
              type="button"
              className="mc-plan-mobile-lista__item"
              onClick={() => onSelectMiembro(u)}
            >
              <span className="font-medium text-[var(--mc-color-text)]">{u.nombre}</span>
              <span className="flex items-center gap-2">
                <span className={`mc-plan-celda mc-plan-celda--mini ${claseCeldaSaturacion(maxDia)}`}>{maxDia}</span>
                <span className="text-xs text-[var(--mc-color-text-secondary)]">{total} Σ</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
