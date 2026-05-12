import { Modal } from '@/components/ui/Modal';
import { Button, CancelButton } from '@/components/ui/Button';
import { JustificacionField } from '@/components/ui/JustificacionField';
import { KpiCard } from '@/components/ui/KpiCard';
import { ModalDesbloquear } from '@/components/tareas/ModalDesbloquear';
import { ModalMiSemana } from '@/components/semana/ModalMiSemana';
import { usePlanificacionPage } from '@/hooks/usePlanificacionPage';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { fechaLocalDdMmYyyy, fechaLocalYmd } from '@/lib/fecha';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import { TAREA_LABEL_PLURAL, TAREA_PILL } from '@/lib/estadoConfig';
import { agregarDias } from '@/lib/semanas';
import { useRef } from 'react';
import { AlertTriangle, CheckCircle, Clock, History, Info, XCircle } from 'lucide-react';
import type { EstadoTarea, LogAccion, TipoAccionLog } from '@/types';
import type { LogActividadItem } from '@/api/audit';

// ---------------------------------------------------------------------------
// Configuración de presentación (sin lógica de negocio)
// ---------------------------------------------------------------------------
const DIAS_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const ESTADOS: EstadoTarea[] = ['pendiente', 'en_progreso', 'atrasada', 'bloqueada', 'completada', 'reprogramada'];

const LEYENDA_CARGA = [
  { color: 'var(--mc-state-completada-bg-soft)', label: '1–2 tareas' },
  { color: 'color-mix(in srgb, var(--mc-color-accent-soft) 65%, var(--mc-color-surface))', label: '3–4 tareas' },
  { color: 'var(--mc-state-atrasada-bg-soft)', label: '5+ tareas' },
];

function celdaClass(n: number): string {
  if (n === 0) return 'bg-[var(--mc-color-bg-secondary)] text-[var(--mc-color-text-secondary)]';
  if (n <= 2)  return 'bg-[var(--mc-state-completada-bg-soft)] text-[var(--mc-state-completada-fg)]';
  if (n <= 4) {
    return 'bg-[color-mix(in_srgb,var(--mc-color-accent-soft)_65%,var(--mc-color-surface))] text-[var(--mc-color-accent)]';
  }
  return 'bg-[var(--mc-state-atrasada-bg-soft)] text-[var(--mc-state-atrasada-meta)]';
}

function labelTipoLog(t: TipoAccionLog): string {
  const m: Record<TipoAccionLog, string> = {
    creada:             'Creada',
    iniciada:           'Iniciada',
    reprogramada:       'Reprogramada',
    eliminada:          'Eliminada',
    estado_cambiado:    'Cambio de estado',
    prioridad_cambiada: 'Prioridad',
    editada:            'Editada',
    cancelada:          'Cancelación',
    bloqueada:          'Bloqueada',
    desbloqueada:       'Desbloqueada',
    completada:         'Completada',
  };
  return m[t] ?? t;
}

// ---------------------------------------------------------------------------

export function Planificacion() {
  const {
    usuario,
    lunes, setLunes, sabado, diasLab, numSem, hoyYmd,
    miembros, detalle, logsPend, loadLogs, errLogs,
    conteoSemana, mutLeerLog,
    incidencias, loadInc,
    actividad, loadActividad,
    objetivosActivos,
    modalCrear, setModalCrear,
    crearTareaDesdePanel,
    mostrarHistorial, setMostrarHistorial,
    histLogs, histTotal, histTotalPaginas, loadHist,
    histPagina, setHistPagina,
    histUsuarioId, setHistUsuarioId,
    histTipoAccion, setHistTipoAccion,
    todosUsuarios,
    resetHistFiltros,
    modal,           setModal,
    desbloquearTarea,setDesbloquearTarea,
    devolverTarea,
    motivoDevolver,  setMotivoDevolver,
    motivoDevolverOk,
    busyDevolver,
    cuenta, conteoEstadosDia, otsPendientes,
    confirmarDesbloqueo, confirmarDevolver,
    abrirDevolver, cerrarDevolver,
  } = usePlanificacionPage();

  if (!usuario) return null;

  const nombreMiembro = Object.fromEntries(miembros.map((m) => [m.id, m.nombre]));

  // Refs para hacer scroll desde los KPIs ejecutivos a cada sección.
  const refHeatmap     = useRef<HTMLElement | null>(null);
  const refActividad   = useRef<HTMLElement | null>(null);
  const refIncidencias = useRef<HTMLElement | null>(null);
  const refLogs        = useRef<HTMLElement | null>(null);

  function scrollTo(ref: React.RefObject<HTMLElement | null>) {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className={APP_PAGE_CLASS}>

      <PageHeader
        title="Planificación"
        subtitle={`Semana ${numSem}: del ${fechaLocalDdMmYyyy(lunes)} al ${fechaLocalDdMmYyyy(sabado)}`}
        left={
          <div className="mc-nav-arrows">
            <button className="mc-nav-arrow-btn" onClick={() => setLunes((d) => agregarDias(d, -7))} aria-label="Semana anterior">‹</button>
            <button className="mc-nav-arrow-btn" onClick={() => setLunes((d) => agregarDias(d, 7))} aria-label="Semana siguiente">›</button>
          </div>
        }
      />

      {/* ── Resumen ejecutivo ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <KpiCard
          size="md"
          value={conteoSemana.atrasada ?? 0}
          label="Tareas atrasadas del equipo"
          variant={(conteoSemana.atrasada ?? 0) > 0 ? 'danger' : 'success'}
          emphasized
          icon={AlertTriangle}
          onClick={() => scrollTo(refHeatmap)}
        />
        <KpiCard
          size="md"
          value={otsPendientes.length}
          label="OTs pendientes de aprobación"
          variant={otsPendientes.length > 0 ? 'warning' : 'success'}
          emphasized
          icon={Clock}
          onClick={() => scrollTo(refActividad)}
        />
        <KpiCard
          size="md"
          value={incidencias.length}
          label="Incidencias esta semana"
          variant={incidencias.length > 5 ? 'warning' : 'neutral'}
          emphasized={incidencias.length > 5}
          icon={Info}
          onClick={() => scrollTo(refIncidencias)}
        />
        <KpiCard
          size="md"
          value={logsPend.length}
          label="Justificaciones sin leer"
          variant={logsPend.length > 0 ? 'warning' : 'neutral'}
          emphasized={logsPend.length > 0}
          icon={History}
          onClick={() => scrollTo(refLogs)}
        />
      </div>

      {/* ── Tabla de carga ─────────────────────────────────────────────── */}
      <section ref={refHeatmap}>
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
                <th
                  className="p-2 text-[10px] font-medium uppercase tracking-wide text-[var(--mc-color-text-secondary)]"
                  style={{ position: 'sticky', left: 0, background: 'var(--mc-color-surface)', zIndex: 2 }}
                >
                  Miembro
                </th>
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
                    <td
                      className="p-2 font-medium text-[var(--mc-color-text)]"
                      style={{ position: 'sticky', left: 0, background: 'var(--mc-color-surface)', zIndex: 1 }}
                    >
                      {u.nombre}
                    </td>
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
                <td
                  className="p-2 text-xs font-medium text-[var(--mc-color-text-secondary)]"
                  style={{ position: 'sticky', left: 0, background: 'var(--mc-color-bg-secondary)', zIndex: 1 }}
                >
                  Resumen del día
                </td>
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

      {/* ── Actividad del equipo ─────────────────────────────────────────── */}
      <section ref={refActividad}>
        <div className="mc-section-header">
          <span>Actividad del equipo esta semana</span>
          <span className="rounded-full bg-[var(--mc-color-bg-secondary)] px-2 py-0.5 text-xs font-medium text-[var(--mc-color-text-secondary)]">
            {actividad.length}
          </span>
        </div>
        {loadActividad ? (
          <p className="text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
        ) : actividad.length === 0 ? (
          <div className="mc-empty">
            <p className="mc-empty-title">Sin actividad registrada esta semana</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--mc-color-border)] bg-[var(--mc-color-surface)]">
            {actividad.map((item: LogActividadItem) => {
              const esCompletada  = item.tipo_accion === 'editada' && item.justificacion !== null;
              const esReprogramada = item.tipo_accion === 'reprogramada';
              const esBloqueada   = item.tipo_accion === 'estado_cambiado';
              const esCancelada   = item.tipo_accion === 'cancelada';

              const icon = esCompletada
                ? <CheckCircle size={14} className="text-[var(--mc-color-success)] shrink-0 mt-0.5" aria-hidden />
                : esReprogramada
                ? <Clock size={14} className="text-[var(--mc-color-text-secondary)] shrink-0 mt-0.5" aria-hidden />
                : esCancelada
                ? <XCircle size={14} className="text-[var(--mc-color-danger)] shrink-0 mt-0.5" aria-hidden />
                : <AlertTriangle size={14} className="text-[var(--mc-color-warning)] shrink-0 mt-0.5" aria-hidden />;

              const accionLabel = esCompletada ? 'completó'
                : esReprogramada ? 'reprogramó'
                : esBloqueada    ? 'bloqueó'
                : 'canceló';

              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 border-b border-[var(--mc-color-border)] px-4 py-3 last:border-b-0"
                >
                  {icon}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-xs font-semibold text-[var(--mc-color-text)]">
                        {item.usuario_nombre}
                      </span>
                      <span className="text-xs text-[var(--mc-color-text-secondary)]">
                        {accionLabel}
                      </span>
                      {item.tarea_titulo && (
                        <span className="text-xs font-medium text-[var(--mc-color-text)]">
                          {item.tarea_titulo}
                        </span>
                      )}
                      <span className="ml-auto text-[10px] text-[var(--mc-color-text-secondary)]">
                        {new Date(item.created_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>
                    {item.justificacion && (
                      <p className="text-sm text-[var(--mc-color-text)] leading-relaxed">
                        {item.justificacion}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Incidencias del equipo ────────────────────────────────────── */}
      <section ref={refIncidencias}>
        <div className="mc-section-header">
          <span className="flex items-center gap-2">
            <Info size={14} className="text-[var(--mc-color-info)]" aria-hidden />
            Incidencias registradas esta semana
          </span>
          <span className="rounded-full bg-[var(--mc-color-bg-secondary)] px-2 py-0.5 text-xs font-medium text-[var(--mc-color-text-secondary)]">
            {incidencias.length}
          </span>
        </div>
        {loadInc ? (
          <p className="text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
        ) : incidencias.length === 0 ? (
          <div className="mc-empty">
            <p className="mc-empty-title">Sin incidencias esta semana</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--mc-color-border)] bg-[var(--mc-color-surface)]">
            {incidencias.map((t) => {
              const est = estadoEfectivoTablero(t, hoyYmd);
              return (
                <div
                  key={t.id}
                  className="grid grid-cols-[140px_1fr_auto] items-start gap-3 border-b border-[var(--mc-color-border)] px-4 py-3 last:border-b-0"
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-[var(--mc-color-text)]">
                      {nombreMiembro[t.asignado_a] ?? '—'}
                    </span>
                    <span className="text-[10px] text-[var(--mc-color-text-secondary)]">
                      {new Date(t.created_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm text-[var(--mc-color-text)]">{t.titulo}</p>
                    {t.descripcion && (
                      <p className="text-xs text-[var(--mc-color-text-secondary)] line-clamp-2">{t.descripcion}</p>
                    )}
                  </div>
                  <span className={`mc-badge text-[10px] shrink-0 ${TAREA_PILL[est] ?? 'mc-badge-neutral'}`}>
                    {TAREA_LABEL_PLURAL[est] ?? est}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Logs de auditoría ────────────────────────────────────────────── */}
      <section ref={refLogs}>
        {/* Cabecera con toggle pendientes / historial */}
        <div className="mc-section-header">
          <div className="flex items-center gap-3">
            <span>{mostrarHistorial ? 'Historial completo de acciones' : 'Justificaciones pendientes de lectura'}</span>
            {!mostrarHistorial && logsPend.length > 0 && (
              <span className="rounded-full bg-[var(--mc-color-danger)] px-2 py-0.5 text-[10px] font-semibold text-white">
                {logsPend.length}
              </span>
            )}
          </div>
          <Button
            variant="quaternary"
            onClick={() => { setMostrarHistorial((v) => !v); resetHistFiltros(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <History size={13} aria-hidden />
            {mostrarHistorial ? 'Ver pendientes' : 'Ver historial completo'}
          </Button>
        </div>

        {/* ── Vista: pendientes ── */}
        {!mostrarHistorial && (
          <>
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
          </>
        )}

        {/* ── Vista: historial completo ── */}
        {mostrarHistorial && (
          <div className="flex flex-col gap-4">

            {/* Filtros */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="mc-field !mb-0">
                <label className="mc-field-label" htmlFor="hist-usuario">Miembro</label>
                <select
                  id="hist-usuario"
                  className="mc-input !w-auto min-w-[180px]"
                  value={histUsuarioId}
                  onChange={(e) => { setHistUsuarioId(e.target.value); setHistPagina(0); }}
                >
                  <option value="todos">Todos</option>
                  {todosUsuarios.map((u) => (
                    <option key={u.id} value={u.id}>{u.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="mc-field !mb-0">
                <label className="mc-field-label" htmlFor="hist-tipo">Tipo de acción</label>
                <select
                  id="hist-tipo"
                  className="mc-input !w-auto min-w-[180px]"
                  value={histTipoAccion}
                  onChange={(e) => { setHistTipoAccion(e.target.value as typeof histTipoAccion); setHistPagina(0); }}
                >
                  <option value="todos">Todos</option>
                  <option value="creada">Creada</option>
                  <option value="editada">Editada</option>
                  <option value="reprogramada">Reprogramada</option>
                  <option value="estado_cambiado">Cambio de estado</option>
                  <option value="prioridad_cambiada">Prioridad</option>
                  <option value="eliminada">Eliminada</option>
                  <option value="cancelada">Cancelación</option>
                </select>
              </div>
              {(histUsuarioId !== 'todos' || histTipoAccion !== 'todos') && (
                <Button variant="quaternary" onClick={resetHistFiltros}>
                  Limpiar filtros
                </Button>
              )}
            </div>

            {/* Tabla */}
            {loadHist ? (
              <p className="text-sm text-[var(--mc-color-text-secondary)]">Cargando historial…</p>
            ) : histLogs.length === 0 ? (
              <div className="mc-empty">
                <p className="mc-empty-title">Sin registros con estos filtros</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-[var(--mc-color-border)] bg-[var(--mc-color-surface)]">
                {histLogs.map((log: LogAccion) => (
                  <div
                    key={log.id}
                    className="grid grid-cols-[130px_110px_1fr] items-start gap-3 border-b border-[var(--mc-color-border)] px-4 py-3 last:border-b-0"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium text-[var(--mc-color-text)]">
                        {todosUsuarios.find((u) => u.id === log.usuario_id)?.nombre ?? '—'}
                      </span>
                      <span className="text-[10px] text-[var(--mc-color-text-secondary)]">
                        {new Date(log.created_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="mc-badge mc-badge-neutral text-[10px] w-fit">{labelTipoLog(log.tipo_accion)}</span>
                      {log.leido_por_jefe ? null : (
                        <span className="text-[10px] font-medium text-[var(--mc-color-warning)]">Sin leer</span>
                      )}
                    </div>
                    <span className="text-sm text-[var(--mc-color-text)]">{log.justificacion ?? '—'}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Paginación */}
            {histTotalPaginas > 1 && (
              <div className="flex items-center justify-between text-xs text-[var(--mc-color-text-secondary)]">
                <span>{histTotal} registros · página {histPagina + 1} de {histTotalPaginas}</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="xs"
                    disabled={histPagina === 0}
                    onClick={() => setHistPagina((p) => Math.max(0, p - 1))}
                  >‹ Anterior</Button>
                  <Button
                    variant="secondary"
                    size="xs"
                    disabled={histPagina >= histTotalPaginas - 1}
                    onClick={() => setHistPagina((p) => p + 1)}
                  >Siguiente ›</Button>
                </div>
              </div>
            )}
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
          <div className="flex w-full items-center justify-between">
            <Button
              size="sm"
              onClick={() => {
                if (modal) {
                  setModalCrear({ usuarioId: modal.usuarioId, fecha: modal.fecha });
                  setModal(null);
                }
              }}
            >
              + Nueva tarea
            </Button>
            <CancelButton onClick={() => setModal(null)} label="Cerrar" />
          </div>
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
            <Button size="lg" fullWidth onClick={() => void confirmarDevolver()} disabled={busyDevolver || !motivoDevolverOk}>
              {busyDevolver ? 'Guardando…' : 'Confirmar devolución'}
            </Button>
            <CancelButton onClick={cerrarDevolver} disabled={busyDevolver} />
          </>
        }
      >
        {devolverTarea && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-[var(--mc-color-text-secondary)]">
              {devolverTarea.titulo}
            </p>
            <JustificacionField
              value={motivoDevolver}
              onChange={setMotivoDevolver}
              placeholder="Indica el motivo para devolver esta tarea…"
              disabled={busyDevolver}
              autoFocus
            />
          </div>
        )}
      </Modal>

      {/* ── Modal: crear tarea directa (Jefe) ─────────────────────────── */}
      <ModalMiSemana
        open={modalCrear !== null}
        modoOrigen="dia"
        fechaDia={modalCrear?.fecha}
        objetivos={objetivosActivos}
        usuariosAsignables={miembros}
        asignadoPorDefectoId={modalCrear?.usuarioId ?? ''}
        onClose={() => setModalCrear(null)}
        onCrearTarea={crearTareaDesdePanel}
        onCrearEvento={async () => { /* eventos no aplican desde planificación */ }}
      />

      {/* ── Modal: desbloquear ──────────────────────────────────────────── */}
      <ModalDesbloquear
        tarea={desbloquearTarea}
        onClose={() => setDesbloquearTarea(null)}
        onConfirm={confirmarDesbloqueo}
      />
    </div>
  );
}