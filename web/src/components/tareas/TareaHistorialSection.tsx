import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';

import { getLogsPorTarea } from '@/api/audit';
import type { TipoAccionLog } from '@/types';

const LABEL_TIPO: Record<TipoAccionLog, string> = {
  creada:             'Creada',
  iniciada:           'Iniciada',
  reprogramada:       'Reprogramada',
  eliminada:          'Eliminada',
  estado_cambiado:    'Estado',
  prioridad_cambiada: 'Prioridad',
  editada:            'Editada',
  cancelada:          'Cancelada',
  bloqueada:          'Bloqueada',
  desbloqueada:       'Desbloqueada',
  completada:         'Completada',
};

type Props = {
  tareaId: string | null;
  defaultOpen?: boolean;
};

export function TareaHistorialSection({ tareaId, defaultOpen = false }: Props) {
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
                <span className="mc-tarea-historial__tipo">
                  {LABEL_TIPO[log.tipo_accion] ?? log.tipo_accion}
                </span>
                {log.justificacion ? (
                  <p className="mc-tarea-historial__just">{log.justificacion}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
