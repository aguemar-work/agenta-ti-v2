import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState } from '@/components/ui/EmptyState';
import { fechaLocalDdMmYyyy } from '@/lib/fecha';
import { TareaEstadoIndicator } from '@/components/tareas/TareaEstadoIndicator';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import type { Tarea } from '@/types';

type Props = {
  nombre: string;
  fecha: string;
  tareas: Tarea[];
  loading: boolean;
  hoyYmd: string;
  onClose: () => void;
};

export function PlanificacionCeldaMobile({ nombre, fecha, tareas, loading, hoyYmd, onClose }: Props) {
  return (
    <div className="mc-ot-detalle-mobile" role="dialog" aria-modal="true" aria-label="Tareas del día">
      <header className="mc-ot-detalle-mobile__header">
        <button type="button" className="mc-btn-ghost mc-btn-sm" onClick={onClose}>
          ← Volver
        </button>
        <div className="min-w-0 flex-1">
          <Breadcrumb
            items={[
              { label: 'Planificación' },
              { label: nombre },
              { label: fechaLocalDdMmYyyy(new Date(fecha + 'T12:00:00')), current: true },
            ]}
          />
          <h2 className="mc-ot-detalle-mobile__title m-0">{nombre}</h2>
        </div>
      </header>
      <div className="mc-ot-detalle-mobile__body">
        {loading ? (
          <p className="text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
        ) : tareas.length === 0 ? (
          <EmptyState compact title="Sin tareas planificadas" />
        ) : (
          <ul className="mc-plan-celda-lista">
            {tareas.map((t) => {
              const est = estadoEfectivoTablero(t, hoyYmd);
              return (
                <li key={t.id} className="mc-plan-celda-lista__item">
                  <p className="mc-plan-celda-lista__titulo">{t.titulo}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <TareaEstadoIndicator estado={est} variant="pill" plural />
                    <span className="text-[10px] capitalize text-[var(--mc-color-text-secondary)]">
                      {t.prioridad}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
