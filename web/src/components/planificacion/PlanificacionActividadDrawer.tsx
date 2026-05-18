import { useState, type Dispatch, type SetStateAction } from 'react';
import { AlertTriangle, CheckCircle, Clock, History, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { LogActividadItem } from '@/api/audit';
import type { FiltrosHistorialLog } from '@/api/audit';
import type { LogAccion, Tarea, TipoAccionLog } from '@/types';
import type { EstadoTarea } from '@/types';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import { TareaEstadoIndicator } from '@/components/tareas/TareaEstadoIndicator';

function labelTipoLog(t: TipoAccionLog): string {
  const m: Record<TipoAccionLog, string> = {
    creada: 'Creada',
    iniciada: 'Iniciada',
    reprogramada: 'Reprogramada',
    eliminada: 'Eliminada',
    estado_cambiado: 'Cambio de estado',
    prioridad_cambiada: 'Prioridad',
    editada: 'Editada',
    cancelada: 'Cancelación',
    bloqueada: 'Bloqueada',
    desbloqueada: 'Desbloqueada',
    completada: 'Completada',
  };
  return m[t] ?? t;
}

type Props = {
  open: boolean;
  onClose: () => void;
  actividad: LogActividadItem[];
  loadActividad: boolean;
  incidencias: Tarea[];
  loadInc: boolean;
  hoyYmd: string;
  nombreMiembro: Record<string, string>;
  logsPend: LogAccion[];
  loadLogs: boolean;
  errLogs: boolean;
  mutLeerLogPending: boolean;
  onMarcarLeido: (id: string) => void;
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

export function PlanificacionActividadDrawer({
  open,
  onClose,
  actividad,
  loadActividad,
  incidencias,
  loadInc,
  hoyYmd,
  nombreMiembro,
  logsPend,
  loadLogs,
  errLogs,
  mutLeerLogPending,
  onMarcarLeido,
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
  const [seccion, setSeccion] = useState<'actividad' | 'logs' | 'incidencias'>('actividad');

  if (!open) return null;

  return (
    <>
      <div className="mc-drawer-overlay" onClick={onClose} aria-hidden />
      <aside
        className="mc-drawer-panel mc-drawer-panel--planificacion"
        role="dialog"
        aria-modal="true"
        aria-label="Actividad del equipo"
      >
        <header className="mc-drawer-panel-header">
          <h2 className="mc-drawer-panel-title">Actividad del equipo</h2>
          <button type="button" className="mc-modal-close" onClick={onClose} aria-label="Cerrar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div className="mc-plan-drawer-tabs" role="tablist">
          {(
            [
              { id: 'actividad' as const, label: 'Actividad', count: actividad.length },
              { id: 'logs' as const, label: 'Justificaciones', count: logsPend.length },
              { id: 'incidencias' as const, label: 'Incidencias', count: incidencias.length },
            ] as const
          ).map(({ id, label, count }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={seccion === id}
              className={['mc-plan-drawer-tabs__btn', seccion === id ? 'mc-plan-drawer-tabs__btn--active' : ''].filter(Boolean).join(' ')}
              onClick={() => setSeccion(id)}
            >
              {label}
              {count > 0 ? <span className="mc-plan-drawer-tabs__badge">{count}</span> : null}
            </button>
          ))}
        </div>

        <div className="mc-drawer-panel-body mc-plan-drawer-body">
          {seccion === 'actividad' && (
            <>
              {loadActividad ? (
                <p className="text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
              ) : actividad.length === 0 ? (
                <EmptyState compact title="Sin actividad esta semana" />
              ) : (
                <div className="mc-plan-drawer-list">
                  {actividad.map((item) => {
                    const esCompletada = item.tipo_accion === 'editada' && item.justificacion !== null;
                    const esReprogramada = item.tipo_accion === 'reprogramada';
                    const esCancelada = item.tipo_accion === 'cancelada';
                    const icon = esCompletada ? (
                      <CheckCircle size={14} className="shrink-0 text-[var(--mc-color-success)]" aria-hidden />
                    ) : esReprogramada ? (
                      <Clock size={14} className="shrink-0 text-[var(--mc-color-text-secondary)]" aria-hidden />
                    ) : esCancelada ? (
                      <XCircle size={14} className="shrink-0 text-[var(--mc-color-danger)]" aria-hidden />
                    ) : (
                      <AlertTriangle size={14} className="shrink-0 text-[var(--mc-color-warning)]" aria-hidden />
                    );
                    const accionLabel = esCompletada ? 'completó' : esReprogramada ? 'reprogramó' : esCancelada ? 'canceló' : 'registró';
                    return (
                      <div key={item.id} className="mc-plan-drawer-list__item">
                        {icon}
                        <div className="min-w-0 flex-1">
                          <p className="m-0 text-xs text-[var(--mc-color-text)]">
                            <strong>{item.usuario_nombre}</strong> {accionLabel}
                            {item.tarea_titulo ? ` · ${item.tarea_titulo}` : ''}
                          </p>
                          {item.justificacion ? (
                            <p className="m-0 mt-1 text-xs text-[var(--mc-color-text-secondary)]">{item.justificacion}</p>
                          ) : null}
                          <p className="m-0 mt-1 text-[10px] text-[var(--mc-color-text-secondary)]">
                            {new Date(item.created_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {seccion === 'incidencias' && (
            <>
              {loadInc ? (
                <p className="text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
              ) : incidencias.length === 0 ? (
                <EmptyState compact title="Sin incidencias esta semana" />
              ) : (
                <div className="mc-plan-drawer-list">
                  {incidencias.map((t) => {
                    const est = estadoEfectivoTablero(t, hoyYmd) as EstadoTarea;
                    return (
                      <div key={t.id} className="mc-plan-drawer-list__item mc-plan-drawer-list__item--stack">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium">{nombreMiembro[t.asignado_a] ?? '—'}</span>
                          <TareaEstadoIndicator estado={est} variant="pill" plural />
                        </div>
                        <p className="m-0 text-sm text-[var(--mc-color-text)]">{t.titulo}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {seccion === 'logs' && (
            <>
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-xs text-[var(--mc-color-text-secondary)]">
                  {mostrarHistorial ? 'Historial completo' : 'Pendientes de lectura'}
                </span>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => { setMostrarHistorial(!mostrarHistorial); resetHistFiltros(); }}
                >
                  <History size={12} aria-hidden />
                  {mostrarHistorial ? 'Ver pendientes' : 'Ver historial'}
                </Button>
              </div>

              {!mostrarHistorial && (
                <>
                  {errLogs && <p className="text-sm text-[var(--mc-color-danger)]">Error al cargar.</p>}
                  {loadLogs ? (
                    <p className="text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
                  ) : logsPend.length === 0 ? (
                    <EmptyState compact title="Sin pendientes" />
                  ) : (
                    <div className="mc-plan-drawer-list">
                      {logsPend.map((log) => (
                        <div key={log.id} className="mc-plan-drawer-list__item mc-plan-drawer-list__item--stack">
                          <span className="text-[10px] text-[var(--mc-color-text-secondary)]">
                            {new Date(log.created_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
                            {' · '}
                            {labelTipoLog(log.tipo_accion)}
                          </span>
                          <p className="m-0 text-xs text-[var(--mc-color-text)]">{log.justificacion ?? '—'}</p>
                          <Button variant="secondary" size="xs" disabled={mutLeerLogPending} onClick={() => onMarcarLeido(log.id)}>
                            Marcar leído
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {mostrarHistorial && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2">
                    <select
                      className="mc-input !w-auto text-xs"
                      value={histUsuarioId}
                      onChange={(e) => { setHistUsuarioId(e.target.value); setHistPagina(() => 0); }}
                    >
                      <option value="todos">Todos</option>
                      {todosUsuarios.map((u) => (
                        <option key={u.id} value={u.id}>{u.nombre}</option>
                      ))}
                    </select>
                    <select
                      className="mc-input !w-auto text-xs"
                      value={histTipoAccion}
                      onChange={(e) => { setHistTipoAccion(e.target.value as FiltrosHistorialLog['tipoAccion']); setHistPagina(() => 0); }}
                    >
                      <option value="todos">Todos los tipos</option>
                      <option value="reprogramada">Reprogramada</option>
                      <option value="cancelada">Cancelación</option>
                      <option value="estado_cambiado">Cambio estado</option>
                    </select>
                  </div>
                  {loadHist ? (
                    <p className="text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
                  ) : histLogs.length === 0 ? (
                    <EmptyState compact title="Sin registros" />
                  ) : (
                    <div className="mc-plan-drawer-list">
                      {histLogs.map((log) => (
                        <div key={log.id} className="mc-plan-drawer-list__item mc-plan-drawer-list__item--stack">
                          <span className="text-xs font-medium">
                            {todosUsuarios.find((u) => u.id === log.usuario_id)?.nombre ?? '—'}
                          </span>
                          <p className="m-0 text-xs text-[var(--mc-color-text)]">{log.justificacion ?? '—'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {histTotalPaginas > 1 && (
                    <div className="flex items-center justify-between text-xs text-[var(--mc-color-text-secondary)]">
                      <span>{histTotal} registros · {histPagina + 1}/{histTotalPaginas}</span>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="xs" disabled={histPagina === 0} onClick={() => setHistPagina((p) => p - 1)}>‹</Button>
                        <Button variant="ghost" size="xs" disabled={histPagina >= histTotalPaginas - 1} onClick={() => setHistPagina((p) => p + 1)}>›</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}
