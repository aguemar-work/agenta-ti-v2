import type { Dispatch, SetStateAction } from 'react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { LogActividadItem } from '@/api/audit';
import type { FiltrosHistorialLog } from '@/api/audit';
import type { LogAccion } from '@/types';

type Props = {
  open: boolean;
  onClose: () => void;
  actividad: LogActividadItem[];
  loadActividad: boolean;
  mostrarHistorial: boolean;
  setMostrarHistorial: Dispatch<SetStateAction<boolean>>;
  histLogs: LogAccion[];
  histTotal: number;
  histTotalPaginas: number;
  loadHist: boolean;
  histPagina: number;
  setHistPagina: (fn: (p: number) => number) => void;
  histUsuarioId: string;
  setHistUsuarioId: (v: string) => void;
  histTipoAccion: FiltrosHistorialLog['tipoAccion'];
  setHistTipoAccion: (v: FiltrosHistorialLog['tipoAccion']) => void;
  todosUsuarios: { id: string; nombre: string }[];
  resetHistFiltros: () => void;
};

export function PlanificacionHistorialCompleto({
  open,
  onClose,
  actividad,
  loadActividad,
  mostrarHistorial,
  setMostrarHistorial,
  histLogs,
  histTotal,
  histTotalPaginas,
  loadHist,
  histPagina,
  setHistPagina,
  histUsuarioId,
  setHistUsuarioId,
  histTipoAccion,
  setHistTipoAccion,
  todosUsuarios,
  resetHistFiltros,
}: Props) {
  if (!open) return null;

  return (
    <section id="plan-historial" className="mc-card mc-plan-panel mc-plan-panel--fill" aria-labelledby="plan-historial-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="plan-historial-title" className="mc-plan-seccion__title m-0">
          Actividad del equipo
        </h2>
        <Button variant="ghost" size="xs" onClick={onClose}>
          Cerrar
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <Button
          variant={!mostrarHistorial ? 'secondary' : 'ghost'}
          size="xs"
          onClick={() => {
            setMostrarHistorial(false);
            resetHistFiltros();
          }}
        >
          Reciente (semana)
        </Button>
        <Button
          variant={mostrarHistorial ? 'secondary' : 'ghost'}
          size="xs"
          onClick={() => {
            setMostrarHistorial(true);
            resetHistFiltros();
          }}
        >
          Historial completo
        </Button>
      </div>

      {!mostrarHistorial ? (
        loadActividad ? (
          <p className="text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
        ) : actividad.length === 0 ? (
          <EmptyState compact title="Sin actividad" />
        ) : (
          <ul className="mc-plan-feed">
            {actividad.map((item) => (
              <li key={item.id} className="mc-plan-feed__item">
                <div className="mc-plan-feed__meta">
                  <span className="mc-plan-feed__autor">{item.usuario_nombre}</span>
                  <span className="mc-plan-feed__hora">
                    {new Date(item.created_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
                <p className="mc-plan-feed__texto">
                  {item.tipo_accion}
                  {item.tarea_titulo ? `: ${item.tarea_titulo}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <select
              className="mc-input !w-auto text-xs"
              value={histUsuarioId}
              onChange={(e) => {
                setHistUsuarioId(e.target.value);
                setHistPagina(() => 0);
              }}
            >
              <option value="todos">Todos</option>
              {todosUsuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
            <select
              className="mc-input !w-auto text-xs"
              value={histTipoAccion}
              onChange={(e) => {
                setHistTipoAccion(e.target.value as FiltrosHistorialLog['tipoAccion']);
                setHistPagina(() => 0);
              }}
            >
              <option value="todos">Todos los tipos</option>
              <option value="reprogramada">Reprogramada</option>
              <option value="cancelada">Cancelación</option>
              <option value="bloqueada">Bloqueada</option>
              <option value="completada">Completada</option>
            </select>
          </div>
          {loadHist ? (
            <p className="text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
          ) : histLogs.length === 0 ? (
            <EmptyState compact title="Sin registros" />
          ) : (
            <ul className="mc-plan-feed">
              {histLogs.map((log) => (
                <li key={log.id} className="mc-plan-feed__item">
                  <div className="mc-plan-feed__meta">
                    <span className="mc-plan-feed__autor">
                      {todosUsuarios.find((u) => u.id === log.usuario_id)?.nombre ?? '—'}
                    </span>
                    <span className="mc-plan-feed__hora">
                      {new Date(log.created_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                  <p className="mc-plan-feed__texto">{log.justificacion ?? log.tipo_accion}</p>
                </li>
              ))}
            </ul>
          )}
          {histTotalPaginas > 1 && (
            <div className="flex items-center justify-between text-xs text-[var(--mc-color-text-secondary)]">
              <span>
                {histTotal} registros · {histPagina + 1}/{histTotalPaginas}
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" size="xs" disabled={histPagina === 0} onClick={() => setHistPagina((p) => p - 1)}>
                  Anterior
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={histPagina >= histTotalPaginas - 1}
                  onClick={() => setHistPagina((p) => p + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
