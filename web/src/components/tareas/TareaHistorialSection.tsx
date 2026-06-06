import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';

import { getLogsPorTarea } from '@/api/audit';
import { TareaEstadoIndicator } from '@/components/tareas/TareaEstadoIndicator';
import type { ClaveVisualTarea, TipoAccionLog } from '@/types';

const LABEL_TIPO: Record<TipoAccionLog, string> = {
  creada: 'Creada',
  iniciada: 'Iniciada',
  reprogramada: 'Reprogramada',
  eliminada: 'Eliminada',
  estado_cambiado: 'Estado actualizado',
  prioridad_cambiada: 'Prioridad',
  editada: 'Editada',
  cancelada: 'Cancelada',
  bloqueada: 'Bloqueada',
  desbloqueada: 'Desbloqueada',
  completada: 'Completada',
};

const LOG_A_ESTADO: Partial<Record<TipoAccionLog, ClaveVisualTarea>> = {
  reprogramada: 'reprogramada',
  desbloqueada: 'pendiente',
  completada: 'completada',
  cancelada: 'cancelada',
  iniciada: 'en_progreso',
  creada: 'pendiente',
};

type Props = {
  tareaId: string | null;
  defaultOpen?: boolean;
};

function LogTipoBadge({ tipo }: { tipo: TipoAccionLog }) {
  const estado = LOG_A_ESTADO[tipo];
  if (estado) {
    return <TareaEstadoIndicator estado={estado} variant="pill" />;
  }
  return (
    <span className="mc-tarea-timeline__badge-neutral">
      {LABEL_TIPO[tipo] ?? tipo}
    </span>
  );
}

export function TareaHistorialSection({ tareaId, defaultOpen = true }: Props) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['tarea-logs', tareaId],
    enabled: Boolean(tareaId),
    queryFn: () => getLogsPorTarea(tareaId!),
  });

  if (!tareaId) return null;

  return (
    <details className="mc-tarea-historial" open={defaultOpen || undefined}>
      <summary className="mc-tarea-historial__summary">
        <ChevronDown size={14} aria-hidden className="mc-tarea-historial__chevron" />
        Historial de cambios
        {logs.length > 0 && (
          <span className="mc-tarea-historial__count">{logs.length}</span>
        )}
      </summary>
      <div className="mc-tarea-historial__body">
        {isLoading ? (
          <p className="mc-tarea-historial__empty">Cargando…</p>
        ) : logs.length === 0 ? (
          <p className="mc-tarea-historial__empty">Sin registros en el historial.</p>
        ) : (
          <ol className="mc-tarea-timeline">
            {logs.map((log, idx) => (
              <li key={log.id} className="mc-tarea-timeline__item">
                <span className="mc-tarea-timeline__rail" aria-hidden>
                  <span className="mc-tarea-timeline__dot" />
                  {idx < logs.length - 1 ? <span className="mc-tarea-timeline__line" /> : null}
                </span>
                <div className="mc-tarea-timeline__content">
                  <div className="mc-tarea-timeline__head">
                    <LogTipoBadge tipo={log.tipo_accion} />
                    <time className="mc-tarea-timeline__time" dateTime={log.created_at}>
                      {new Date(log.created_at).toLocaleString('es', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                  </div>
                  {log.justificacion ? (
                    <p className="mc-tarea-timeline__just">{log.justificacion}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </details>
  );
}
