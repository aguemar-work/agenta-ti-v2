import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ModalDesbloquear } from '@/components/tareas/ModalDesbloquear';
import { usePlanificacionPage } from '@/hooks/usePlanificacionPage';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { fechaLocalDdMmYyyy, fechaLocalYmd } from '@/lib/fecha';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import { TAREA_LABEL_PLURAL, TAREA_PILL } from '@/lib/estadoConfig';
import { agregarDias } from '@/lib/semanas';
import type { EstadoTarea, LogAccion, TipoAccionLog } from '@/types';

// ---------------------------------------------------------------------------
// Configuración de presentación (sin lógica de negocio)
// ---------------------------------------------------------------------------
const DIAS_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const ESTADOS: EstadoTarea[] = ['pendiente', 'en_progreso', 'atrasada', 'bloqueada', 'completada', 'reprogramada'];

const LEYENDA_CARGA = [
  { color: '#EAF3DE', label: '1–2 tareas' },
  { color: '#FAEEDA', label: '3–4 tareas' },
  { color: '#FCEBEB', label: '5+ tareas' },
];

function celdaClass(n: number): string {
  if (n === 0) return 'bg-[var(--mc-color-bg-secondary)] text-[var(--mc-color-text-secondary)]';
  if (n <= 2)  return 'bg-[#EAF3DE] text-[#27500A]';
  if (n <= 4)  return 'bg-[#FAEEDA] text-[#854F0B]';
  return 'bg-[#FCEBEB] text-[#A32D2D]';
}

function labelTipoLog(t: TipoAccionLog): string {
  const m: Record<TipoAccionLog, string> = {
    creada:             'Creada',
    reprogramada:       'Reprogramada',
    eliminada:          'Eliminada',
    estado_cambiado:    'Cambio de estado',
    prioridad_cambiada: 'Prioridad',
    editada:            'Editada',
    cancelada:          'Cancelación',
  };
  return m[t] ?? t;
}

// ---------------------------------------------------------------------------

export function Planificacion() {
  const {
    usuario,
    lunes, setLunes, sabado, diasLab, numSem, fechaLunes, hoyYmd,
    miembros, detalle, logsPend, loadLogs, errLogs,
    conteoSemana, mutLeerLog,
    modal,           setModal,
    desbloquearTarea,setDesbloquearTarea,
    devolverTarea,
    motivoDevolver,  setMotivoDevolver,
    motivoDevolverOk,motivoDevolverLen,
    busyDevolver,    MIN_MOTIVO,
    cuenta, conteoEstadosDia,
    confirmarDesbloqueo, confirmarDevolver,
    abrirDevolver, cerrarDevolver,
  } = usePlanificacionPage();

  if (!usuario) return null;

  return (
    <div className={APP_PAGE_CLASS}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="mc-page-header">
        <div>
          <h1 className="mc-page-title">Planificación</h1>
          <h2 className="mc-page-subtitle">
            Semana {numSem} · {fechaLocalDdMmYyyy(lunes)} — {fechaLocalDdMmYyyy(sabado)}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setLunes((d) => agregarDias(d, -7))}>‹</Button>
          <span className="text-sm font-medium">Lunes {fechaLunes}</span>
          <Button variant="secondary" size="sm" onClick={() => setLunes((d) => agregarDias(d, 7))}>›</Button>
        </div>
      </header>

      {/* ── Tabla de carga ─────────────────────────────────────────────── */}
      <section>
        <div className="mc-section-header">
          <span>Carga de trabajo por miembro</span>
        </div>
        <div className="mb-2 flex flex-wrap gap-3">
          {LEYENDA_CARGA.map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-[var(--mc-color-text-secondary)]">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
              {label}
            </div>
          ))}
        </div>
        <div className="overflow-x-auto rounded-xl border border-[var(--mc-color-border)] bg-[var(--mc-color-surface)]">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--mc-color-border)]">
                <th className="p-2 text-[10px] font-medium uppercase tracking-wide text-[var(--mc-color-text-secondary)]">Miembro</th>
                {diasLab.map((d, i) => (
                  <th key={fechaLocalYmd(d)} className="p-2 text-[10px] font-medium uppercase tracking-wide text-[var(--mc-color-text-secondary)]">
                    {DIAS_CORTO[i]} {d.getDate()}
                  </th>
                ))}
                <th className="p-2 text-[10px] font-medium uppercase tracking-wide text-[var(--mc-color-text-secondary)]">Total</th>
              </tr>
            </thead>
            <tbody>
              {miembros.map((u) => {
                const totalSem = diasLab.reduce((acc, d) => acc + cuenta(u.id, fechaLocalYmd(d)), 0);
                return (
                  <tr key={u.id} className="border-b border-[var(--mc-color-border)]">
                    <td className="p-2 font-medium text-[var(--mc-color-text)]">{u.nombre}</td>
                    {diasLab.map((d) => {
                      const ymd = fechaLocalYmd(d);
                      const n   = cuenta(u.id, ymd);
                      return (
                        <td key={ymd} className="p-2">
                          <button
                            type="button"
                            className={`w-full rounded-md py-1 text-center text-xs font-medium ${celdaClass(n)}`}
                            onClick={() => setModal({ usuarioId: u.id, fecha: ymd, nombre: u.nombre })}
                            aria-label={`${u.nombre} — ${ymd}: ${n} tareas`}
                          >
                            {n}
                          </button>
                        </td>
                      );
                    })}
                    <td className="p-2 font-medium text-[var(--mc-color-text)]">{totalSem}</td>
                  </tr>
                );
              })}

              {/* Fila resumen por estado */}
              <tr className="border-t border-[var(--mc-color-border)] bg-[var(--mc-color-bg-secondary)]">
                <td className="p-2 text-xs font-medium text-[var(--mc-color-text-secondary)]">Resumen del día</td>
                {diasLab.map((d) => {
                  const ymd    = fechaLocalYmd(d);
                  const counts = conteoEstadosDia(ymd);
                  const hayAlgo = Object.values(counts).some((v) => v && v > 0);
                  return (
                    <td key={ymd} className="p-2">
                      {!hayAlgo ? (
                        <span className="text-xs text-[var(--mc-color-text-secondary)]">—</span>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          {ESTADOS.filter((e) => counts[e]).map((e) => (
                            <span key={e} className={`inline-block rounded px-1 py-0.5 text-[10px] font-medium ${TAREA_PILL[e] ?? ''}`}>
                              {counts[e]} {TAREA_LABEL_PLURAL[e]}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="p-2">
                  <div className="flex flex-col gap-0.5">
                    {ESTADOS.filter((e) => conteoSemana[e]).map((e) => (
                      <span key={e} className={`inline-block rounded px-1 py-0.5 text-[10px] font-medium ${TAREA_PILL[e] ?? ''}`}>
                        {conteoSemana[e]} {TAREA_LABEL_PLURAL[e]}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Justificaciones pendientes ──────────────────────────────────── */}
      <section>
        <div className="mc-section-header">
          <span>Justificaciones pendientes de lectura</span>
        </div>
        {errLogs && <p className="text-sm text-[var(--mc-color-danger)]">No se pudieron cargar los registros.</p>}
        {loadLogs ? (
          <p className="text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
        ) : logsPend.length === 0 ? (
          <div className="mc-empty">
            <p className="mc-empty-title">Sin pendientes de lectura</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--mc-color-border)] bg-[var(--mc-color-surface)]">
            {logsPend.map((log: LogAccion) => (
              <div
                key={log.id}
                className="grid grid-cols-[120px_100px_1fr_auto] items-center gap-3 border-b border-[var(--mc-color-border)] px-4 py-3 last:border-b-0"
              >
                <span className="text-xs text-[var(--mc-color-text-secondary)]">
                  {new Date(log.created_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
                <span className="mc-badge mc-badge-neutral text-[10px]">{labelTipoLog(log.tipo_accion)}</span>
                <span className="text-sm text-[var(--mc-color-text)]">{log.justificacion ?? '—'}</span>
                <Button
                  variant="secondary"
                  size="xs"
                  disabled={mutLeerLog.isPending}
                  onClick={() => mutLeerLog.mutate(log.id)}
                >
                  Marcar leído
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Modal: detalle de celda ─────────────────────────────────────── */}
      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal ? `${modal.nombre} — ${modal.fecha}` : ''}
        size="md"
        footer={
          <Button variant="ghost" onClick={() => setModal(null)}>Cerrar</Button>
        }
      >
        {modal && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-[var(--mc-color-text-secondary)]">
              {detalle.length} {detalle.length === 1 ? 'tarea' : 'tareas'}
            </p>
            {detalle.length === 0 ? (
              <div className="mc-empty">
                <p className="mc-empty-title">Sin tareas planificadas</p>
              </div>
            ) : (
              detalle.map((t) => {
                const est = estadoEfectivoTablero(t, hoyYmd);
                return (
                  <div key={t.id} className="mc-entity-card flex flex-col gap-2">
                    <p className="text-sm font-semibold text-[var(--mc-color-text)]">{t.titulo}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`mc-badge ${TAREA_PILL[est] ?? 'mc-badge-neutral'} text-[10px]`}>
                        {TAREA_LABEL_PLURAL[est] ?? est}
                      </span>
                      <span className="text-[11px] text-[var(--mc-color-text-secondary)]">{t.prioridad} prioridad</span>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {est === 'bloqueada' && (
                        <Button variant="secondary" size="xs" onClick={() => setDesbloquearTarea(t)}>
                          Desbloquear
                        </Button>
                      )}
                      {est === 'completada' && (
                        <Button variant="secondary" size="xs" className="!text-[var(--mc-color-warning)]" onClick={() => abrirDevolver(t)}>
                          Devolver a pendiente
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </Modal>

      {/* ── Modal: devolver a pendiente ─────────────────────────────────── */}
      <Modal
        open={devolverTarea !== null}
        onClose={cerrarDevolver}
        title="Devolver a pendiente"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={cerrarDevolver} disabled={busyDevolver}>Cancelar</Button>
            <Button onClick={() => void confirmarDevolver()} disabled={busyDevolver || !motivoDevolverOk}>
              {busyDevolver ? 'Guardando…' : 'Confirmar'}
            </Button>
          </>
        }
      >
        {devolverTarea && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-[var(--mc-color-text-secondary)]">
              {devolverTarea.titulo}
            </p>
            <div className="mc-field">
              <label className="mc-field-label" htmlFor="dev-motivo">
                <span className="flex justify-between">
                  Justificación
                  <span aria-live="polite" className={`mc-char-count ${!motivoDevolverOk ? 'mc-char-count-error' : ''}`}>
                    {motivoDevolverLen}/{MIN_MOTIVO}
                  </span>
                </span>
              </label>
              <textarea
                id="dev-motivo"
                className="mc-input"
                style={{ minHeight: 80, resize: 'vertical' }}
                value={motivoDevolver}
                onChange={(e) => setMotivoDevolver(e.target.value)}
                placeholder="Indica el motivo para devolver esta tarea…"
                autoFocus
                aria-invalid={motivoDevolver.length > 0 && !motivoDevolverOk}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal: desbloquear ──────────────────────────────────────────── */}
      <ModalDesbloquear
        tarea={desbloquearTarea}
        onClose={() => setDesbloquearTarea(null)}
        onConfirm={confirmarDesbloqueo}
      />
    </div>
  );
}