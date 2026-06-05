import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { JustificacionField } from '@/components/ui/JustificacionField';
import { EmptyState } from '@/components/ui/EmptyState';
import { PlanificacionPanel } from '@/components/planificacion/PlanificacionPanel';
import { MIN_JUSTIFICACION_CHARS } from '@/lib/constants';
import { inicialesNombre } from '@/lib/metricasHelpers';
import type { LogAccion } from '@/types';

const MAX_VISIBLE = 12;

type Props = {
  logs: LogAccion[];
  loading: boolean;
  error: boolean;
  busyAceptar: boolean;
  busyDevolver: boolean;
  nombreMiembro: Record<string, string>;
  titulosTarea: Record<string, string>;
  onAceptar: (logId: string) => void;
  onDevolver: (logId: string, notaJefe: string) => void;
};

function labelTipo(tipo: string): string {
  const m: Record<string, string> = {
    bloqueada: 'Bloqueo',
    cancelada: 'Cancelación',
    reprogramada: 'Reprogramación',
    eliminada: 'Eliminación',
  };
  return m[tipo] ?? tipo;
}

/** Título de tarea: mapa vivo, join o snapshot en valor_anterior (logs huérfanos pre-034). */
function tituloTareaDesdeLog(
  log: LogAccion,
  titulosTarea: Record<string, string>,
): string | null {
  if (log.tarea_id && titulosTarea[log.tarea_id]) return titulosTarea[log.tarea_id]!;
  const va = log.valor_anterior as { titulo?: string } | null;
  const snap = va?.titulo?.trim();
  return snap || null;
}

export function PlanificacionJustificaciones({
  logs,
  loading,
  error,
  busyAceptar,
  busyDevolver,
  nombreMiembro,
  titulosTarea,
  onAceptar,
  onDevolver,
}: Props) {
  const [devolverLogId, setDevolverLogId] = useState<string | null>(null);
  const [notaDevolver, setNotaDevolver] = useState('');

  const notaOk = notaDevolver.trim().length >= MIN_JUSTIFICACION_CHARS;
  const busy = busyAceptar || busyDevolver;
  const visible = logs.slice(0, MAX_VISIBLE);
  const hayMas = logs.length > MAX_VISIBLE;

  function cerrarDevolverInline() {
    setDevolverLogId(null);
    setNotaDevolver('');
  }

  function confirmarDevolver(logId: string) {
    if (!notaOk) return;
    onDevolver(logId, notaDevolver.trim());
    cerrarDevolverInline();
  }

  const titulo = (
    <>
      Justificaciones del equipo
      {logs.length > 0 ? (
        <span className="mc-plan-panel__count" aria-label={`${logs.length} pendientes`}>
          {logs.length}
        </span>
      ) : null}
    </>
  );

  return (
    <PlanificacionPanel
      title={titulo}
      titleId="plan-justificaciones-title"
      alerta={logs.length > 0}
      fill
      className="mc-plan-grid-operativa__revision"
    >
      {logs.length > 0 ? (
        <p className="mc-plan-panel__hint m-0">
          Solo reprogramaciones, cancelaciones y eliminaciones con motivo. Las tareas completadas no
          pasan por aquí — revisa el resumen al cerrar cada tarea.
        </p>
      ) : null}
      {error && (
        <p className="m-0 text-sm text-[var(--mc-color-danger)]">No se pudieron cargar las justificaciones.</p>
      )}
      {loading ? (
        <p className="m-0 text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
      ) : logs.length === 0 ? (
        <EmptyState
          compact
          title="Sin justificaciones pendientes"
          desc="Cuando un miembro reprograme, cancele o elimine una tarea, aparecerá aquí para revisar el motivo."
        />
      ) : (
        <>
          <ul className="mc-plan-revision-list">
            {visible.map((log) => {
              const enDevolver = devolverLogId === log.id;
              const sinTarea = !log.tarea_id;
              const nombre = nombreMiembro[log.usuario_id] ?? '—';

              return (
                <li key={log.id} className="mc-plan-revision-card">
                  <div className="mc-plan-revision-card__top">
                    <span className="mc-metricas-avatar" aria-hidden>
                      {inicialesNombre(nombre)}
                    </span>
                    <div className="mc-plan-revision-card__meta">
                      <div className="mc-plan-revision-card__row">
                        <span className="mc-badge mc-badge-secondary">{labelTipo(log.tipo_accion)}</span>
                        <span className="mc-plan-revision-card__autor">{nombre}</span>
                        <time className="mc-plan-revision-card__hora" dateTime={log.created_at}>
                          {new Date(log.created_at).toLocaleString('es', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </time>
                      </div>
                      {(() => {
                        const titulo = tituloTareaDesdeLog(log, titulosTarea);
                        return titulo ? (
                          <p className="mc-plan-revision-card__tarea">{titulo}</p>
                        ) : null;
                      })()}
                    </div>
                  </div>

                  <blockquote className="mc-plan-revision-card__cita">{log.justificacion}</blockquote>

                  {enDevolver ? (
                    <div className="mc-plan-revision-card__devolver">
                      <JustificacionField
                        label="Nota para el miembro"
                        value={notaDevolver}
                        onChange={setNotaDevolver}
                        placeholder="Indica por qué devuelves la tarea y qué debe revisar…"
                        disabled={busy}
                        autoFocus
                      />
                      <div className="mc-plan-revision-card__acciones">
                        <Button
                          variant="primary"
                          size="xs"
                          disabled={!notaOk || busyDevolver}
                          onClick={() => confirmarDevolver(log.id)}
                        >
                          {busyDevolver ? 'Guardando…' : 'Confirmar devolución'}
                        </Button>
                        <Button variant="ghost" size="xs" disabled={busy} onClick={cerrarDevolverInline}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mc-plan-revision-card__acciones">
                      <Button variant="secondary" size="xs" disabled={busy} onClick={() => onAceptar(log.id)}>
                        {busyAceptar ? '…' : 'Marcar como revisado'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        disabled={busy || sinTarea}
                        title={sinTarea ? 'Sin tarea vinculada' : undefined}
                        onClick={() => {
                          setDevolverLogId(log.id);
                          setNotaDevolver('');
                        }}
                      >
                        Devolver
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {hayMas ? (
            <p className="mc-plan-panel__footer-note m-0">
              Mostrando {MAX_VISIBLE} de {logs.length}. Revisa las más recientes primero.
            </p>
          ) : null}
        </>
      )}
    </PlanificacionPanel>
  );
}
