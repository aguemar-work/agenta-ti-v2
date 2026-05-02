import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useObjetivosPage } from '@/hooks/useObjetivosPage';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { OBJETIVO_BADGE, OBJETIVO_LABEL, TAREA_BADGE, TAREA_LABEL } from '@/lib/estadoConfig';
import { nivelRiesgoObjetivo, RIESGO_CONFIG } from '@/lib/tareaUrgencia';
import type { EstadoObjetivo, Tarea } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';

// ---------------------------------------------------------------------------
// Barra de progreso con color según nivel de riesgo
// ---------------------------------------------------------------------------
function BarraProgreso({
  pct,
  fechaLimite,
  size = 'sm',
}: {
  pct:         number;
  fechaLimite: string | null;
  size?:       'sm' | 'md';
}) {
  const nivel    = nivelRiesgoObjetivo(pct, fechaLimite);
  const config   = RIESGO_CONFIG[nivel];
  const altura   = size === 'md' ? 8 : 5;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{
        height:       altura,
        width:        '100%',
        borderRadius: altura,
        background:   nivel === 'sin_fecha' ? 'var(--mc-color-border)' :
                      nivel === 'critico'   ? '#F7C1C1' :
                      nivel === 'moderado'  ? '#FAC775' :
                      '#C0DD97',
        overflow:     'hidden',
      }}>
        <div style={{
          height:       '100%',
          width:        `${Math.min(pct, 100)}%`,
          borderRadius: altura,
          background:   config.barColor,
          transition:   'width 0.4s ease',
        }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badge de riesgo (solo si tiene fecha_limite)
// ---------------------------------------------------------------------------
function BadgeRiesgo({ pct, fechaLimite }: { pct: number; fechaLimite: string | null }) {
  const nivel  = nivelRiesgoObjetivo(pct, fechaLimite);
  const config = RIESGO_CONFIG[nivel];
  if (nivel === 'sin_fecha' || nivel === 'en_ritmo') return null;

  return (
    <span style={{
      display:       'inline-block',
      fontSize:       10,
      fontWeight:     600,
      padding:        '2px 7px',
      borderRadius:   10,
      background:     config.bgColor,
      color:          config.textColor,
      letterSpacing: '.02em',
      flexShrink:     0,
    }}>
      {config.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------
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

  // Conteo de objetivos críticos para el subtítulo
  const criticos = objetivos.filter((o) =>
    nivelRiesgoObjetivo(o.pct, o.fecha_limite) === 'critico'
  ).length;

  return (
    <div className={APP_PAGE_CLASS}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <PageHeader
        title="Objetivos"
        subtitle={
          criticos > 0
            ? `${criticos} objetivo${criticos > 1 ? 's' : ''} en estado crítico`
            : 'Gestión estratégica'
        }
        actions={<Button onClick={abrirModalNuevo} size="sm">+ Nuevo objetivo</Button>}
      />

      {isError && (
        <p style={{ fontSize: 13, color: 'var(--mc-color-danger)', margin: '0 0 12px' }}>
          No se pudieron cargar los objetivos.
        </p>
      )}

      {/* ── Layout principal ─────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">

        {/* ── Tabla de objetivos ──────────────────────────────────────────── */}
        <div className="mc-card !p-0 overflow-hidden">
          <div className="mc-section-header">
            <span>Lista de objetivos</span>
          </div>

          {/* Cabecera */}
          <div style={{
            display:          'grid',
            gridTemplateColumns: '1fr 80px 180px 90px 32px',
            gap:              12,
            borderBottom:     '1px solid var(--mc-color-border)',
            background:       'var(--mc-color-bg)',
            padding:          '6px 16px',
          }}>
            {['Objetivo', 'Estado', 'Progreso', 'Límite', ''].map((h) => (
              <span key={h} style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--mc-color-text-secondary)' }}>
                {h}
              </span>
            ))}
          </div>

          {loadO ? (
            <p style={{ padding: 16, fontSize: 13, color: 'var(--mc-color-text-secondary)' }}>Cargando…</p>
          ) : objetivos.length === 0 ? (
            <div className="mc-empty">
              <p className="mc-empty-title">Sin objetivos</p>
              <p className="mc-empty-desc">Crea el primer objetivo estratégico del equipo</p>
            </div>
          ) : (
            objetivos.map((o) => {
              const nivel  = nivelRiesgoObjetivo(o.pct, o.fecha_limite);
              const config = RIESGO_CONFIG[nivel];
              const esCritico = nivel === 'critico';

              return (
                <div
                  key={o.id}
                  onClick={() => setSeleccionId(o.id)}
                  style={{
                    display:             'grid',
                    gridTemplateColumns: '1fr 80px 180px 90px 32px',
                    alignItems:          'center',
                    gap:                  12,
                    borderBottom:        '1px solid var(--mc-color-border)',
                    padding:             '10px 16px',
                    cursor:              'pointer',
                    background:          seleccionId === o.id
                                           ? 'var(--mc-color-accent-soft)'
                                           : esCritico
                                             ? '#FFF8F8'
                                             : undefined,
                    transition:          'background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (seleccionId !== o.id) (e.currentTarget as HTMLElement).style.background = 'var(--mc-color-surface-hover)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      seleccionId === o.id ? 'var(--mc-color-accent-soft)' :
                      esCritico ? '#FFF8F8' : '';
                  }}
                >
                  {/* Título */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--mc-color-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {o.titulo}
                      </p>
                      <BadgeRiesgo pct={o.pct} fechaLimite={o.fecha_limite} />
                    </div>
                    {o.descripcion && (
                      <p style={{ fontSize: 11, color: 'var(--mc-color-text-secondary)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {o.descripcion}
                      </p>
                    )}
                  </div>

                  {/* Estado */}
                  <span className={`mc-badge ${OBJETIVO_BADGE[o.estado as EstadoObjetivo]}`} style={{ fontSize: 10 }}>
                    {OBJETIVO_LABEL[o.estado as EstadoObjetivo]}
                  </span>

                  {/* Progreso */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <BarraProgreso pct={o.pct} fechaLimite={o.fecha_limite} />
                    <span style={{ fontSize: 10, color: config.textColor !== 'var(--mc-color-text-secondary)' ? config.textColor : 'var(--mc-color-text-secondary)' }}>
                      {o.completadas}/{o.total_tareas} tareas · {o.pct}%
                    </span>
                  </div>

                  {/* Fecha límite */}
                  <span style={{ fontSize: 12, color: esCritico ? '#A32D2D' : 'var(--mc-color-text-secondary)' }}>
                    {o.fecha_limite ?? '—'}
                  </span>

                  {/* Menú ⋯ */}
                  <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="mc-btn-ghost !p-1"
                      style={{ color: 'var(--mc-color-text-secondary)' }}
                      onClick={() => setMenuObjId(menuObjId === o.id ? null : o.id)}
                      aria-label="Opciones"
                      aria-expanded={menuObjId === o.id}
                    >
                      ···
                    </button>
                    {menuObjId === o.id && (
                      <div
                        ref={menuRef}
                        style={{ position: 'absolute', right: 0, top: 28, zIndex: 20, minWidth: 160, borderRadius: 10, border: '1px solid var(--mc-color-border)', background: 'var(--mc-color-bg)', padding: '4px 0' }}
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
              );
            })
          )}
        </div>

        {/* ── Panel lateral ────────────────────────────────────────────────── */}
        <div className="mc-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!objetivoSel ? (
            <div className="mc-empty">
              <p className="mc-empty-title">Selecciona un objetivo</p>
              <p className="mc-empty-desc">Ver sus tareas vinculadas y progreso detallado</p>
            </div>
          ) : (
            <>
              {/* Cabecera del objetivo */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--mc-color-text)', margin: 0 }}>
                    {objetivoSel.titulo}
                  </p>
                  {objetivoSel.descripcion && (
                    <p style={{ fontSize: 12, color: 'var(--mc-color-text-secondary)', margin: '4px 0 0' }}>
                      {objetivoSel.descripcion}
                    </p>
                  )}
                </div>
                <span className={`mc-badge ${OBJETIVO_BADGE[objetivoSel.estado as EstadoObjetivo]} shrink-0`} style={{ fontSize: 10 }}>
                  {OBJETIVO_LABEL[objetivoSel.estado as EstadoObjetivo]}
                </span>
              </div>

              {/* Barra de progreso grande */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: 'var(--mc-color-text-secondary)' }}>Progreso</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <BadgeRiesgo pct={objetivoSel.pct} fechaLimite={objetivoSel.fecha_limite} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: RIESGO_CONFIG[nivelRiesgoObjetivo(objetivoSel.pct, objetivoSel.fecha_limite)].textColor }}>
                      {objetivoSel.pct}%
                    </span>
                  </div>
                </div>
                <BarraProgreso pct={objetivoSel.pct} fechaLimite={objetivoSel.fecha_limite} size="md" />
                <span style={{ fontSize: 11, color: 'var(--mc-color-text-secondary)' }}>
                  {objetivoSel.completadas} de {objetivoSel.total_tareas} tareas completadas
                  {objetivoSel.fecha_limite && ` · vence ${objetivoSel.fecha_limite}`}
                </span>
              </div>

              {/* Tareas vinculadas */}
              <div style={{ borderTop: '1px solid var(--mc-color-border)', paddingTop: 12 }}>
                <div className="mc-section-header !border-none !bg-transparent !p-0">
                  <span>Tareas vinculadas</span>
                  <Button variant="secondary" size="xs" onClick={() => setModalTarea(true)}>
                    + Añadir
                  </Button>
                </div>
                {loadTareas ? (
                  <p style={{ fontSize: 12, color: 'var(--mc-color-text-secondary)', padding: '8px 0' }}>Cargando…</p>
                ) : tareasVinc.length === 0 ? (
                  <div className="mc-empty !p-6">
                    <p className="mc-empty-title">Sin tareas vinculadas</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto', marginTop: 8 }}>
                    {tareasVinc.map((t) => (
                      <div key={t.id} style={{
                        display:        'flex',
                        alignItems:     'center',
                        justifyContent: 'space-between',
                        gap:             8,
                        borderRadius:   'var(--mc-radius-md)',
                        background:     t.estado === 'atrasada' ? '#FCEBEB' : 'var(--mc-color-bg)',
                        border:         `1px solid ${t.estado === 'atrasada' ? '#F7C1C1' : 'var(--mc-color-border)'}`,
                        padding:        '7px 10px',
                      }}>
                        <p style={{ fontSize: 12, color: t.estado === 'atrasada' ? '#791F1F' : 'var(--mc-color-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {t.titulo}
                        </p>
                        <span className={`mc-badge ${TAREA_BADGE[t.estado] ?? 'mc-badge-neutral'} shrink-0`} style={{ fontSize: 9 }}>
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

      {/* ── Modal: nuevo objetivo ──────────────────────────────────────────── */}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!esJefe && (
            <p style={{ fontSize: 12, color: 'var(--mc-color-text-secondary)', background: 'var(--mc-color-bg)', borderRadius: 8, padding: '8px 12px', margin: 0 }}>
              El objetivo se creará con <strong>{usuario.nombre}</strong> como responsable.
            </p>
          )}
          <div className="mc-field">
            <label className="mc-field-label" htmlFor="obj-titulo">Título</label>
            <input id="obj-titulo" className="mc-input" value={nuevoObjetivoForm.titulo}
              onChange={(e) => setNuevoObjetivoForm((p) => ({ ...p, titulo: e.target.value }))}
              autoFocus required />
          </div>
          <div className="mc-field">
            <label className="mc-field-label" htmlFor="obj-desc">Descripción (opcional)</label>
            <textarea id="obj-desc" className="mc-input" style={{ minHeight: 72 }}
              value={nuevoObjetivoForm.descripcion}
              onChange={(e) => setNuevoObjetivoForm((p) => ({ ...p, descripcion: e.target.value }))} />
          </div>
          <div className="mc-field">
            <label className="mc-field-label" htmlFor="obj-limite">Fecha límite (opcional)</label>
            <input id="obj-limite" type="date" className="mc-input" value={nuevoObjetivoForm.limite}
              onChange={(e) => setNuevoObjetivoForm((p) => ({ ...p, limite: e.target.value }))} />
          </div>
          {esJefe && (
            <div className="mc-field">
              <label className="mc-field-label" htmlFor="obj-resp">Responsable</label>
              <select id="obj-resp" className="mc-input" value={nuevoObjetivoForm.responsableId}
                onChange={(e) => setNuevoObjetivoForm((p) => ({ ...p, responsableId: e.target.value }))}>
                <option value="">Selecciona…</option>
                {usuariosActivos.map((u) => (
                  <option key={u.id} value={u.id}>{u.nombre}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Modal: añadir tarea ────────────────────────────────────────────── */}
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
            <p style={{ fontSize: 12, color: 'var(--mc-color-text-secondary)', margin: 0 }}>{objetivoSel.titulo}</p>
          )}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--mc-color-text-secondary)' }}>
            Título
            <input className="mc-input" value={tareaObjetivoForm.titulo}
              onChange={(e) => setTareaObjetivoForm((p) => ({ ...p, titulo: e.target.value }))}
              placeholder="Ej: Configurar firewall perimetral…" autoFocus required />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--mc-color-text-secondary)' }}>
            Prioridad
            <select className="mc-input" value={tareaObjetivoForm.prioridad}
              onChange={(e) => setTareaObjetivoForm((p) => ({ ...p, prioridad: e.target.value as Tarea['prioridad'] }))}>
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
            </select>
          </label>
          {esJefe && usuariosActivos.length > 0 && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--mc-color-text-secondary)' }}>
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

      {/* ── Modal: eliminar objetivo ───────────────────────────────────────── */}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {objetivoEliminar && (
            <p style={{ fontSize: 13, color: 'var(--mc-color-text-secondary)', margin: 0 }}>
              <strong>{objetivoEliminar.titulo}</strong> · Esta acción no se puede deshacer.
            </p>
          )}
          <div className="mc-field">
            <label className="mc-field-label" htmlFor="del-motivo">
              <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                Motivo de eliminación
                <span aria-live="polite" className={`mc-char-count ${!motivoOk ? 'mc-char-count-error' : ''}`}>
                  {motivoEliminar.trim().length}/{MIN_JUSTIFICACION_CHARS}
                </span>
              </span>
            </label>
            <textarea id="del-motivo" className="mc-input" style={{ minHeight: 80 }}
              value={motivoEliminar}
              onChange={(e) => setMotivoEliminar(e.target.value)}
              placeholder="Indica el motivo de la eliminación…"
              autoFocus
              aria-invalid={motivoEliminar.length > 0 && !motivoOk} />
          </div>
        </div>
      </Modal>
    </div>
  );
}