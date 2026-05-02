import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useObjetivosPage } from '@/hooks/useObjetivosPage';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { OBJETIVO_BADGE, OBJETIVO_LABEL, TAREA_BADGE, TAREA_LABEL } from '@/lib/estadoConfig';
import type { EstadoObjetivo, Tarea } from '@/types';

export function Objetivos() {
  const {
    usuario, esJefe,
    objetivos, loadO, isError,
    tareasVinc, loadTareas,
    usuariosActivos,
    objetivoSel, objetivoEliminar,
    seleccionId, setSeleccionId,
    menuObjId, setMenuObjId, menuRef,
    modalNuevo,
    nuevoObjetivoForm,
    setNuevoObjetivoForm,
    nuevoObjetivoHasChanges,
    cerrarModalNuevoObjetivo,
    creandoObj,
    modalTarea, setModalTarea,
    tareaObjetivoForm,
    setTareaObjetivoForm,
    tareaObjetivoHasChanges,
    cerrarModalTareaObjetivo,
    addingTarea,
    eliminarObjId, setEliminarObjId,
    motivoEliminar, setMotivoEliminar,
    motivoOk, MIN_JUSTIFICACION_CHARS,
    eliminandoObj,
    puedeEliminar,
    submitNuevoObjetivo,
    addTareaVinculada,
    confirmarEliminar,
    abrirModalNuevo,
    cerrarEliminar,
  } = useObjetivosPage();

  if (!usuario) return null;

  const canSubmitNuevo = !creandoObj && nuevoObjetivoForm.titulo.trim().length > 0
    && (esJefe ? nuevoObjetivoForm.responsableId.trim().length > 0 : true);

  return (
    <div className={APP_PAGE_CLASS}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <PageHeader
        title="Objetivos"
        subtitle="Gestión estratégica"
        actions={
          <Button onClick={abrirModalNuevo} size="sm">+ Nuevo objetivo</Button>
        }
      />

      {isError && <p className="text-sm text-[var(--mc-color-danger)]">No se pudieron cargar los objetivos.</p>}

      {/* ── Layout principal ────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">

        {/* Tabla */}
        <div className="mc-card !p-0 overflow-hidden">
          <div className="mc-section-header">
            <span>Lista de objetivos</span>
          </div>
          <div className="grid grid-cols-[1fr_80px_160px_80px_32px] gap-3 border-b border-[var(--mc-color-border)] bg-[var(--mc-color-bg-secondary)] px-4 py-2">
            {['Objetivo', 'Estado', 'Progreso', 'Límite', ''].map((h) => (
              <span key={h} className="text-[10px] font-medium uppercase tracking-wide text-[var(--mc-color-text-secondary)]">{h}</span>
            ))}
          </div>

          {loadO ? (
            <p className="p-4 text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
          ) : objetivos.length === 0 ? (
            <div className="mc-empty">
              <p className="mc-empty-title">Sin objetivos</p>
            </div>
          ) : (
            objetivos.map((o) => (
              <div
                key={o.id}
                className={[
                  'grid cursor-pointer grid-cols-[1fr_80px_160px_80px_32px] items-center gap-3',
                  'border-b border-[var(--mc-color-border)] px-4 py-3 last:border-b-0',
                  'hover:bg-[var(--mc-color-bg-secondary)]',
                  seleccionId === o.id ? 'bg-[var(--mc-color-accent-soft)]' : '',
                ].join(' ').trim()}
                onClick={() => setSeleccionId(o.id)}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--mc-color-text)]">{o.titulo}</p>
                  {o.descripcion && (
                    <p className="mt-0.5 truncate text-xs text-[var(--mc-color-text-secondary)]">{o.descripcion}</p>
                  )}
                </div>
                <span className={`mc-badge ${OBJETIVO_BADGE[o.estado as EstadoObjetivo]} text-[10px]`}>
                  {OBJETIVO_LABEL[o.estado as EstadoObjetivo]}
                </span>
                <div className="flex flex-col gap-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--mc-color-border)]">
                    <div className="h-full rounded-full bg-[var(--mc-color-accent)]" style={{ width: `${o.pct}%` }} />
                  </div>
                  <span className="text-[10px] text-[var(--mc-color-text-secondary)]">
                    {o.completadas}/{o.total_tareas} · {o.pct}%
                  </span>
                </div>
                <span className="text-xs text-[var(--mc-color-text-secondary)]">{o.fecha_limite ?? '—'}</span>

                {/* Menú ⋯ */}
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="mc-btn-ghost !p-1 text-[var(--mc-color-text-secondary)]"
                    onClick={() => setMenuObjId(menuObjId === o.id ? null : o.id)}
                    aria-label="Opciones"
                    aria-expanded={menuObjId === o.id}
                  >
                    ···
                  </button>
                  {menuObjId === o.id && (
                    <div
                      ref={menuRef}
                      className="absolute right-0 top-7 z-20 min-w-[160px] rounded-lg border border-[var(--mc-color-border)] bg-[var(--mc-color-bg)] py-1"
                      role="menu"
                    >
                      {(esJefe || o.creado_por === usuario.id) && (
                        <button type="button" className="mc-btn-ghost w-full justify-start px-3 py-2 text-xs"
                          role="menuitem" onClick={() => setMenuObjId(null)}>
                          Editar
                        </button>
                      )}
                      {puedeEliminar(o.id) && (
                        <button type="button" className="mc-btn-danger mc-btn-sm w-full justify-start px-3"
                          role="menuitem" onClick={() => { setMenuObjId(null); setEliminarObjId(o.id); }}>
                          Eliminar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Panel lateral */}
        <div className="mc-card flex flex-col gap-4">
          {!objetivoSel ? (
            <p className="text-sm text-[var(--mc-color-text-secondary)]">Selecciona un objetivo para ver sus tareas.</p>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-[var(--mc-color-text)]">{objetivoSel.titulo}</p>
                  {objetivoSel.descripcion && (
                    <p className="mt-1 text-xs text-[var(--mc-color-text-secondary)]">{objetivoSel.descripcion}</p>
                  )}
                </div>
                <span className={`mc-badge ${OBJETIVO_BADGE[objetivoSel.estado as EstadoObjetivo]} shrink-0 text-[10px]`}>
                  {OBJETIVO_LABEL[objetivoSel.estado as EstadoObjetivo]}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--mc-color-border)]">
                  <div className="h-full rounded-full bg-[var(--mc-color-accent)]" style={{ width: `${objetivoSel.pct}%` }} />
                </div>
                <span className="text-xs text-[var(--mc-color-text-secondary)]">
                  {objetivoSel.completadas} de {objetivoSel.total_tareas} tareas completadas · {objetivoSel.pct}%
                </span>
              </div>
              <div className="border-t border-[var(--mc-color-border)] pt-3">
                <div className="mc-section-header !border-none !bg-transparent !p-0">
                  <span>Tareas vinculadas</span>
                  <Button variant="secondary" size="xs" onClick={() => setModalTarea(true)}>
                    + Añadir
                  </Button>
                </div>
                {loadTareas ? (
                  <p className="text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
                ) : tareasVinc.length === 0 ? (
                  <div className="mc-empty !p-6">
                    <p className="mc-empty-title">Sin tareas vinculadas</p>
                  </div>
                ) : (
                  <div className="flex max-h-[300px] flex-col gap-2 overflow-y-auto">
                    {tareasVinc.map((t) => (
                      <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg bg-[var(--mc-color-bg-secondary)] px-3 py-2">
                        <p className="min-w-0 flex-1 truncate text-xs text-[var(--mc-color-text)]">{t.titulo}</p>
                        <span className={`mc-badge ${TAREA_BADGE[t.estado] ?? 'mc-badge-neutral'} shrink-0 text-[9px]`}>
                          {TAREA_LABEL[t.estado] ?? t.estado}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Modal: nuevo objetivo ───────────────────────────────────────── */}
      <Modal
        open={modalNuevo}
        onClose={cerrarModalNuevoObjetivo}
        title="Nuevo objetivo"
        size="sm"
        hasUnsavedChanges={nuevoObjetivoHasChanges}
        footer={
          <>
            <Button variant="ghost" onClick={cerrarModalNuevoObjetivo} disabled={creandoObj}>Cancelar</Button>
            <Button onClick={() => void submitNuevoObjetivo()} disabled={!canSubmitNuevo}>
              {creandoObj ? 'Guardando…' : 'Crear objetivo'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {/* Si es miembro, mostrar aviso de que el objetivo es para sí mismo */}
          {!esJefe && (
            <p className="mc-empty-desc !max-w-none !bg-[var(--mc-color-bg-secondary)] !p-3 !text-left">
              El objetivo se creará con <strong>{usuario.nombre}</strong> como responsable.
            </p>
          )}

          <div className="mc-field">
            <label className="mc-field-label" htmlFor="obj-titulo">Título</label>
            <input id="obj-titulo" className="mc-input" value={nuevoObjetivoForm.titulo} onChange={(e) => setNuevoObjetivoForm((p) => ({ ...p, titulo: e.target.value }))} autoFocus required />
          </div>
          <div className="mc-field">
            <label className="mc-field-label" htmlFor="obj-desc">Descripción (opcional)</label>
            <textarea id="obj-desc" className="mc-input" style={{ minHeight: 80 }} value={nuevoObjetivoForm.descripcion} onChange={(e) => setNuevoObjetivoForm((p) => ({ ...p, descripcion: e.target.value }))} />
          </div>
          <div className="mc-field">
            <label className="mc-field-label" htmlFor="obj-limite">Fecha límite (opcional)</label>
            <input id="obj-limite" type="date" className="mc-input" value={nuevoObjetivoForm.limite} onChange={(e) => setNuevoObjetivoForm((p) => ({ ...p, limite: e.target.value }))} />
          </div>

          {/* Selector de responsable — solo para jefe */}
          {esJefe && (
            <div className="mc-field">
              <label className="mc-field-label" htmlFor="obj-resp">Responsable</label>
              <select id="obj-resp" className="mc-input" value={nuevoObjetivoForm.responsableId} onChange={(e) => setNuevoObjetivoForm((p) => ({ ...p, responsableId: e.target.value }))}>
                <option value="">Selecciona…</option>
                {usuariosActivos.map((u) => (
                  <option key={u.id} value={u.id}>{u.nombre}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Modal: añadir tarea ─────────────────────────────────────────── */}
      <Modal
        open={modalTarea && Boolean(seleccionId)}
        onClose={cerrarModalTareaObjetivo}
        title="Añadir tarea al objetivo"
        size="sm"
        hasUnsavedChanges={tareaObjetivoHasChanges}
        footer={
          <>
            <Button variant="ghost" onClick={cerrarModalTareaObjetivo} disabled={addingTarea}>Cancelar</Button>
            <Button onClick={addTareaVinculada} disabled={addingTarea || !tareaObjetivoForm.titulo.trim()}>
              {addingTarea ? 'Guardando…' : 'Añadir tarea'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {objetivoSel && (
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--mc-color-text-secondary)' }}>{objetivoSel.titulo}</p>
          )}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '12px', fontWeight: 600, color: 'var(--mc-color-text-secondary)' }}>
            Título
            <input className="mc-input" value={tareaObjetivoForm.titulo} onChange={(e) => setTareaObjetivoForm((p) => ({ ...p, titulo: e.target.value }))}
              placeholder="Ej: Configurar firewall perimetral…" autoFocus required />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '12px', fontWeight: 600, color: 'var(--mc-color-text-secondary)' }}>
            Prioridad
            <select className="mc-input" value={tareaObjetivoForm.prioridad}
              onChange={(e) => setTareaObjetivoForm((p) => ({ ...p, prioridad: e.target.value as Tarea['prioridad'] }))}>
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
            </select>
          </label>
          {/* Selector de asignado solo para jefe */}
          {esJefe && usuariosActivos.length > 0 && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '12px', fontWeight: 600, color: 'var(--mc-color-text-secondary)' }}>
              Responsable
              <select className="mc-input" value={tareaObjetivoForm.asignadoId}
                onChange={(e) => setTareaObjetivoForm((p) => ({ ...p, asignadoId: e.target.value }))}>
                {usuariosActivos.map((u) => (
                  <option key={u.id} value={u.id}>{u.nombre}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </Modal>

      {/* ── Modal: eliminar objetivo ────────────────────────────────────── */}
      <Modal
        open={Boolean(eliminarObjId)}
        onClose={cerrarEliminar}
        title="Eliminar objetivo"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={cerrarEliminar} disabled={eliminandoObj}>Cancelar</Button>
            <Button variant="danger" onClick={() => void confirmarEliminar()} disabled={eliminandoObj || !motivoOk}>
              {eliminandoObj ? 'Eliminando…' : 'Confirmar eliminación'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {objetivoEliminar && (
            <p className="text-sm text-[var(--mc-color-text-secondary)]">
              {objetivoEliminar.titulo} · Esta acción no se puede deshacer.
            </p>
          )}
          <div className="mc-field">
            <label className="mc-field-label" htmlFor="del-motivo">
              <span className="flex justify-between">
                Motivo de eliminación
                <span aria-live="polite" className={`mc-char-count ${!motivoOk ? 'mc-char-count-error' : ''}`}>
                  {motivoEliminar.trim().length}/{MIN_JUSTIFICACION_CHARS}
                </span>
              </span>
            </label>
            <textarea id="del-motivo" className="mc-input" style={{ minHeight: 80 }} value={motivoEliminar}
              onChange={(e) => setMotivoEliminar(e.target.value)}
              placeholder="Indica el motivo de la eliminación…" autoFocus
              aria-invalid={motivoEliminar.length > 0 && !motivoOk} />
          </div>
        </div>
      </Modal>
    </div>
  );
}