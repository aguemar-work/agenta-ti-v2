import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';

import { getLogsPorTarea } from '@/api/audit';
import { TareaEstadoIndicator } from '@/components/tareas/TareaEstadoIndicator';
import type { EstadoTarea, TipoAccionLog } from '@/types';

const LABEL_TIPO: Record<TipoAccionLog, string> = {
  creada: 'Creada',
  iniciada: 'Iniciada',
  reprogramada: 'Reprogramada',
  eliminada: 'Eliminada',
  estado_cambiado: 'Estado',
  prioridad_cambiada: 'Prioridad',
  editada: 'Editada',
  cancelada: 'Cancelada',
  bloqueada: 'Bloqueada',
  desbloqueada: 'Desbloqueada',
  completada: 'Completada',
};

/** Mapeo log → pill de estado cuando aplica el mismo diseño. */
const LOG_A_ESTADO: Partial<Record<TipoAccionLog, EstadoTarea>> = {
  reprogramada: 'reprogramada',
  bloqueada: 'bloqueada',
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

function LogTipoPill({ tipo }: { tipo: TipoAccionLog }) {
  const estado = LOG_A_ESTADO[tipo];
  if (estado) {
    return <TareaEstadoIndicator estado={estado} variant="pill" />;
  }
  return (
    <span className="mc-meta-pill mc-meta-pill--neutral">
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
          <p className="text-xs text-[var(--mc-color-text-secondary)]">Cargando…</p>
        ) : logs.length === 0 ? (
          <p className="text-xs text-[var(--mc-color-text-secondary)]">Sin registros.</p>
        ) : (
          <ul className="mc-tarea-historial__list">
            {logs.map((log) => (
              <li key={log.id} className="mc-tarea-historial__item">
                <time className="mc-tarea-historial__time" dateTime={log.created_at}>
                  {new Date(log.created_at).toLocaleString('es', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </time>
                <LogTipoPill tipo={log.tipo_accion} />
                {log.justificacion ? (
                  <p className="mc-tarea-historial__just">{log.justificacion}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {logs.length > 0 && (
          <p className="mc-tarea-historial__footer" role="status">
            Mostrando {logs.length} de {logs.length} cambios
          </p>
        )}
      </div>
    </details>
  );
}
