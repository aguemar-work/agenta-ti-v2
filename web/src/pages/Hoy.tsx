import { ModalDetalleTareaSemana } from '@/components/semana/ModalDetalleTareaSemana';
import { ModalBloquear } from '@/components/tareas/ModalBloquear';
import { ModalCompletarTarea } from '@/components/tareas/ModalCompletarTarea';
import { ModalNuevaTarea } from '@/components/tareas/ModalNuevaTarea';
import { ModalReprogramar } from '@/components/tareas/ModalReprogramar';
import { TaskItem } from '@/components/tareas/TaskItem';
import { Button } from '@/components/ui/Button';
import { useHoyPage } from '@/hooks/useHoyPage';
import { fechaLocalDdMmYyyy } from '@/lib/fecha';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import type { VisibilidadBitacora } from '@/types';

const visLabel: Record<VisibilidadBitacora, string> = {
  todos:     'Equipo',
  solo_jefe: 'Jefe',
  privado:   'Privado',
};

export function Hoy() {
  const {
    usuario, esJefe,
    atrasadas, delDia, incidenciasHist, eventos, notas,
    objetivosActivos, usuariosAsignables, usuariosJefe, tareaDetalle, hoyYmd,
    colLoading, isError, mutNotaPending,
    asignado, setSeleccionId,
    reprTarea,          setReprTarea,
    modalInc,           setModalInc,
    completarTarea,     setCompletarTarea,
    bloquearTareaState, setBloquearTareaState,
    detalleTareaId,     setDetalleTareaId,
    notaRapida,         setNotaRapida,
    puedeEditar,
    iniciarTarea, confirmarCompletar, confirmarReprogramacion,
    confirmarBloqueo, crearIncidencia, guardarNotaRapida,
    guardarDetalle, eliminarDetalle,
  } = useHoyPage();

  if (!usuario) return null;

  return (
    <div className={APP_PAGE_CLASS}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="mc-page-header">
        <div>
          <h1 className="mc-page-title">Hoy</h1>
          <h2 className="mc-page-subtitle">{fechaLocalDdMmYyyy(new Date())}</h2>
        </div>
        {esJefe && usuariosJefe && usuariosJefe.length > 0 && (
          <div className="mc-field !mb-0">
            <label className="mc-field-label" htmlFor="hoy-miembro">Miembro</label>
            <select
              id="hoy-miembro"
              className="mc-input !w-auto min-w-[200px]"
              value={asignado}
              onChange={(e) => setSeleccionId(e.target.value)}
            >
              {usuariosJefe.map((u) => (
                <option key={u.id} value={u.id}>{u.nombre} ({u.email})</option>
              ))}
            </select>
          </div>
        )}
      </header>

      {isError && (
        <p className="text-sm text-[var(--mc-color-danger)]">No se pudieron cargar las tareas.</p>
      )}

      {/* ── Eventos del día ────────────────────────────────────────────── */}
      {eventos.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--mc-color-border)] bg-[var(--mc-color-bg)] px-4 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--mc-color-text-secondary)]">
            Eventos
          </span>
          {eventos.map((ev) => (
            <span
              key={ev.id}
              className="flex items-center gap-2 rounded-full border border-[var(--mc-color-border)] bg-[var(--mc-color-bg-secondary)] px-3 py-1 text-xs text-[var(--mc-color-text)]"
            >
              <span className="text-[var(--mc-color-text-secondary)]">
                {new Date(ev.fecha_inicio).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
              </span>
              {ev.titulo}
            </span>
          ))}
        </div>
      )}

      {/* ── Columnas ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Columna: Tareas planificadas */}
        <section className="mc-hoy-col">
          <div className="mc-hoy-col-head">
            <span>Tareas planificadas</span>
          </div>
          <div className="mc-hoy-col-body">
            {colLoading ? (
              <p className="p-4 text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
            ) : (
              <>
                {atrasadas.length > 0 && (
                  <div className="border-b border-[var(--mc-color-border)]">
                    <div className="bg-[var(--mc-color-bg)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--mc-color-text-secondary)]">
                      Atrasadas
                    </div>
                    <div className="flex flex-col gap-2 p-2">
                      {atrasadas.map((t) => (
                        <TaskItem
                          key={t.id}
                          variant="week"
                          tarea={t}
                          readOnly={!puedeEditar(t)}
                          estadoVisual={estadoEfectivoTablero(t, hoyYmd)}
                          onOpenDetalle={() => setDetalleTareaId(t.id)}
                          onReprogramar={puedeEditar(t) ? (x) => setReprTarea(x)          : undefined}
                          onBloquear={   puedeEditar(t) ? (x) => setBloquearTareaState(x) : undefined}
                          onCompletar={  puedeEditar(t) ? (x) => setCompletarTarea(x)     : undefined}
                          onIniciar={    puedeEditar(t) ? () => void iniciarTarea(t)      : undefined}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div className="min-h-0">
                  {delDia.length > 0 && (
                    <div className="bg-[var(--mc-color-bg)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--mc-color-text-secondary)]">
                      Hoy
                    </div>
                  )}
                  {delDia.length === 0 && atrasadas.length === 0 ? (
                    <div className="mc-empty">
                      <p className="mc-empty-title">Sin tareas planificadas</p>
                    </div>
                  ) : delDia.length === 0 ? (
                    <div className="mc-empty">
                      <p className="mc-empty-title">Sin tareas para hoy</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 p-2">
                      {delDia.map((t) => (
                        <TaskItem
                          key={t.id}
                          variant="week"
                          tarea={t}
                          readOnly={!puedeEditar(t)}
                          estadoVisual={estadoEfectivoTablero(t, hoyYmd)}
                          onOpenDetalle={() => setDetalleTareaId(t.id)}
                          onReprogramar={puedeEditar(t) ? (x) => setReprTarea(x)          : undefined}
                          onBloquear={   puedeEditar(t) ? (x) => setBloquearTareaState(x) : undefined}
                          onCompletar={  puedeEditar(t) ? (x) => setCompletarTarea(x)     : undefined}
                          onIniciar={    puedeEditar(t) ? () => void iniciarTarea(t)      : undefined}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Columna: Incidencias */}
        <section className="mc-hoy-col">
          <div className="mc-hoy-col-head">
            <span>Incidencias del día</span>
            <Button
              size="sm"
              onClick={() => setModalInc(true)}
              disabled={!asignado}
            >
              +
            </Button>
          </div>
          <div className="mc-hoy-col-body">
            {colLoading ? (
              <p className="p-4 text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
            ) : incidenciasHist.length === 0 ? (
              <div className="mc-empty">
                <p className="mc-empty-title">Sin incidencias</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {incidenciasHist.map((t) => (
                  <TaskItem key={t.id} variant="week" tarea={t} readOnly />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Columna: Bitácora */}
        <section className="mc-hoy-col">
          <div className="mc-hoy-col-head">
            <span>Bitácora</span>
          </div>
          <div className="mc-hoy-col-body flex flex-col">
            <div className="min-h-0 flex-1">
              <div className="mc-section-header">
                <span>Bitácora</span>
              </div>
              <div className="flex items-center gap-2 border-b border-[var(--mc-color-border)] px-3 py-2">
                <input
                  className="mc-input flex-1 !py-2 text-sm"
                  placeholder="Nota rápida…"
                  value={notaRapida}
                  onChange={(e) => setNotaRapida(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); guardarNotaRapida(); }
                  }}
                />
                <Button
                  size="sm"
                  disabled={!asignado || !notaRapida.trim() || mutNotaPending}
                  onClick={guardarNotaRapida}
                  aria-label="Agregar nota"
                >
                  +
                </Button>
              </div>
              {colLoading ? (
                <p className="p-4 text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
              ) : notas.length === 0 ? (
                <div className="mc-empty">
                  <p className="mc-empty-title">Sin notas recientes</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2 p-2">
                  {notas.map((n) => (
                    <div key={n.id} className="mc-entity-card">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="mc-badge mc-badge-neutral text-[11px]">{visLabel[n.visibilidad]}</span>
                        <span className="text-xs text-[var(--mc-color-text-secondary)]">
                          {new Date(n.created_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--mc-color-text)]">{n.contenido}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* ── Modales ────────────────────────────────────────────────────── */}
      <ModalReprogramar
        tarea={reprTarea}
        onClose={() => setReprTarea(null)}
        onConfirm={confirmarReprogramacion}
      />
      <ModalBloquear
        tarea={bloquearTareaState}
        onClose={() => setBloquearTareaState(null)}
        onConfirm={confirmarBloqueo}
      />
      <ModalCompletarTarea
        open={completarTarea !== null}
        tarea={completarTarea}
        onClose={() => setCompletarTarea(null)}
        onConfirm={confirmarCompletar}
      />
      <ModalNuevaTarea
        open={modalInc}
        modo="incidencia"
        fechaReferencia={hoyYmd}
        usuarioActualId={usuario.id}
        usuariosAsignables={usuariosAsignables}
        objetivos={objetivosActivos}
        onClose={() => setModalInc(false)}
        onSubmit={crearIncidencia}
      />
      <ModalDetalleTareaSemana
        open={detalleTareaId !== null}
        tarea={tareaDetalle}
        objetivos={objetivosActivos}
        usuariosAsignables={usuariosAsignables}
        readOnly={Boolean(
          tareaDetalle && usuario.rol !== 'jefe' && tareaDetalle.asignado_a !== usuario.id,
        )}
        onClose={() => setDetalleTareaId(null)}
        onGuardar={guardarDetalle}
        onEliminar={eliminarDetalle}
      />
    </div>
  );
}