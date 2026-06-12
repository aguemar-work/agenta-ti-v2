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

export function PlanificacionCeldaSidebar({ nombre, fecha, tareas, loading, hoyYmd, onClose }: Props) {
  return (
    <aside className="mc-ot-sidebar" role="complementary" aria-label="Tareas del día">
      <header className="mc-ot-sidebar__header">
        <div className="min-w-0 flex-1">
          <Breadcrumb
            items={[
              { label: 'Planificación' },
              { label: nombre },
              { label: fechaLocalDdMmYyyy(new Date(fecha + 'T12:00:00')), current: true },
            ]}
          />
          <p className="mc-ot-sidebar__titulo">{nombre}</p>
        </div>
        <button type="button" className="mc-modal-close" onClick={onClose} aria-label="Cerrar panel">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </header>
      <div className="mc-ot-sidebar__body">
        <p className="m-0 text-xs text-[var(--mc-color-text-secondary)]">
          {loading ? 'Cargando…' : `${tareas.length} ${tareas.length === 1 ? 'tarea' : 'tareas'} activas`}
        </p>
        {loading ? null : tareas.length === 0 ? (
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
    </aside>
  );
}
