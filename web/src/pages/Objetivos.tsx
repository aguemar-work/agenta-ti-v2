import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '@/components/ui/Modal';
import { Button, CancelButton } from '@/components/ui/Button';
import { JustificacionField } from '@/components/ui/JustificacionField';
import { ModalNuevaTarea } from '@/components/tareas/ModalNuevaTarea';
import { ModalDetalleTareaSemana } from '@/components/semana/ModalDetalleTareaSemana';
import { useObjetivosPage } from '@/hooks/useObjetivosPage';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { OBJETIVO_BADGE, OBJETIVO_LABEL, TAREA_BADGE, TAREA_LABEL } from '@/lib/estadoConfig';
import { ESTADO_OT_BADGE, ESTADO_OT_LABEL } from '@/lib/otConfig';
import { nivelRiesgoObjetivo, RIESGO_CONFIG } from '@/lib/tareaUrgencia';
import type { EstadoObjetivo, EstadoTarea, Tarea, Usuario } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';

function BarraProgreso({ pct, fechaLimite, size = 'sm', totalTareas }: { pct: number; fechaLimite: string | null; size?: 'sm' | 'md'; totalTareas?: number }) {
  const nivel  = nivelRiesgoObjetivo(pct, fechaLimite, totalTareas);
  const config = RIESGO_CONFIG[nivel];
  const h      = size === 'md' ? 8 : 5;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ height: h, width: '100%', borderRadius: h, overflow: 'hidden',
        background: nivel === 'sin_fecha' ? 'var(--mc-color-border)' : nivel === 'critico' ? '#F7C1C1' : nivel === 'moderado' ? '#FAC775' : '#C0DD97' }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, borderRadius: h, background: config.barColor, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

function BadgeRiesgo({ pct, fechaLimite, totalTareas }: { pct: number; fechaLimite: string | null; totalTareas?: number }) {
  const nivel  = nivelRiesgoObjetivo(pct, fechaLimite, totalTareas);
  const config = RIESGO_CONFIG[nivel];
  if (nivel === 'sin_fecha' || nivel === 'en_ritmo') return null;
  return (
    <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10, flexShrink: 0, background: config.bgColor, color: config.textColor, letterSpacing: '.02em' }}>
      {config.label}
    </span>
  );
}

export function Objetivos() {
  const {
    usuario, esJefe,
    objetivos, loadO, isError,
    tareasVinc, loadTareas,
    otsVinc, loadOTs,
    usuariosActivos,
    objetivoSel, objetivoEliminar,
    seleccionId, setSeleccionId,
    menuObjId, setMenuObjId, menuPos, setMenuPos, menuRef,
    tareaDetalle, setTareaDetalle,
    modalNuevo,
    nuevoObjetivoForm, setNuevoObjetivoForm,
    nuevoObjetivoHasChanges,
    cerrarModalNuevoObjetivo,
    creandoObj,
    modalTarea, setModalTarea,
    tareaObjetivoForm,
    cerrarModalTareaObjetivo,
    eliminarObjId, setEliminarObjId,
    motivoEliminar, setMotivoEliminar,
    motivoOk,
    eliminandoObj,
    modalCompletar, completandoObj,
    puedeEliminar, puedeCompletar,
    submitNuevoObjetivo,
    addTareaVinculada,
    confirmarEliminar,
    confirmarCompletar,
    cerrarCompletar,
    abrirCompletar,
    abrirModalNuevo,
    cerrarEliminar,
  } = useObjetivosPage();

  // Cerrar menú al hacer click fuera
  const menuBtnRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!menuObjId) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          menuBtnRef.current && !menuBtnRef.current.contains(e.target as Node)) {
        setMenuObjId(null);
        setMenuPos(null);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuObjId, menuRef, setMenuObjId, setMenuPos]);

  if (!usuario) return null;

  const canSubmitNuevo = !creandoObj && nuevoObjetivoForm.titulo.trim().length > 0 && nuevoObjetivoForm.responsableId.trim().length > 0;
  const criticos = objetivos.filter((o) => nivelRiesgoObjetivo(o.pct, o.fecha_limite, o.total_tareas) === 'critico').length;

  return (
    <div className={APP_PAGE_CLASS}>
      <PageHeader
        title="Objetivos"
        subtitle={criticos > 0 ? `${criticos} objetivo${criticos > 1 ? 's' : ''} en estado crítico` : 'Gestión estratégica'}
        actions={esJefe ? <Button variant="primary" onClick={abrirModalNuevo} size="sm">+ Nuevo objetivo</Button> : null}
      />

      {isError && <p style={{ fontSize: 13, color: 'var(--mc-color-danger)', margin: '0 0 12px' }}>No se pudieron cargar los objetivos.</p>}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">

        {/* ── Tabla ── */}
        <div className="mc-card !p-0 overflow-hidden">
          <div className="mc-section-header"><span>Lista de objetivos</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 180px 90px 32px', gap: 12, borderBottom: '1px solid var(--mc-color-border)', background: 'var(--mc-color-bg)', padding: '6px 16px' }}>
            {['Objetivo', 'Estado', 'Progreso', 'Límite', ''].map((h) => (
              <span key={h} style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--mc-color-text-secondary)' }}>{h}</span>
            ))}
          </div>

          {loadO ? (
            <p style={{ padding: 16, fontSize: 13, color: 'var(--mc-color-text-secondary)' }}>Cargando…</p>
          ) : objetivos.length === 0 ? (
            <div className="mc-empty">
              <p className="mc-empty-title">Sin objetivos</p>
              <p className="mc-empty-desc">{esJefe ? 'Crea el primer objetivo estratégico del equipo.' : 'Tu jefe aún no ha creado objetivos para el equipo.'}</p>
            </div>
          ) : objetivos.map((o) => {
            const nivel   = nivelRiesgoObjetivo(o.pct, o.fecha_limite, o.total_tareas);
            const config  = RIESGO_CONFIG[nivel];
            const esCrit  = nivel === 'critico';
            const vencido = o.fecha_limite && new Date(`${o.fecha_limite}T12:00:00`) < new Date() && o.estado === 'activo';

            return (
              <div
                key={o.id}
                onClick={() => setSeleccionId(o.id)}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 80px 180px 90px 32px', alignItems: 'center', gap: 12,
                  borderBottom: '1px solid var(--mc-color-border)', padding: '10px 16px', cursor: 'pointer',
                  background: seleccionId === o.id ? 'var(--mc-color-accent-soft)' : esCrit ? '#FFF8F8' : undefined,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { if (seleccionId !== o.id) (e.currentTarget as HTMLElement).style.background = 'var(--mc-color-surface-hover)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = seleccionId === o.id ? 'var(--mc-color-accent-soft)' : esCrit ? '#FFF8F8' : ''; }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--mc-color-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.titulo}</p>
                    <BadgeRiesgo pct={o.pct} fechaLimite={o.fecha_limite} totalTareas={o.total_tareas} />
                    {vencido && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 10, background: '#FCEBEB', color: '#A32D2D' }}>Vencido</span>}
                  </div>
                  {o.descripcion && <p style={{ fontSize: 11, color: 'var(--mc-color-text-secondary)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.descripcion}</p>}
                </div>

                <span className={`mc-badge ${OBJETIVO_BADGE[o.estado as EstadoObjetivo]}`} style={{ fontSize: 10 }}>{OBJETIVO_LABEL[o.estado as EstadoObjetivo]}</span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <BarraProgreso pct={o.pct} fechaLimite={o.fecha_limite} totalTareas={o.total_tareas} />
                  <span style={{ fontSize: 10, color: config.textColor !== 'var(--mc-color-text-secondary)' ? config.textColor : 'var(--mc-color-text-secondary)' }}>
                    {o.completadas}/{o.total_tareas} tareas · {o.pct}%
                  </span>
                </div>

                <span style={{ fontSize: 12, color: esCrit ? '#A32D2D' : 'var(--mc-color-text-secondary)' }}>{o.fecha_limite ?? '—'}</span>

                <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="xs" className="!p-1 text-[var(--mc-color-text-secondary)]"
                    onClick={(e) => {
                      if (menuObjId === o.id) { setMenuObjId(null); setMenuPos(null); return; }
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      const spaceBelow = window.innerHeight - rect.bottom;
                      const menuH = 120;
                      setMenuPos({
                        top:  spaceBelow > menuH ? rect.bottom + 4 : rect.top - menuH - 4,
                        left: rect.right - 170,
                      });
                      setMenuObjId(o.id);
                      menuBtnRef.current = e.currentTarget as HTMLButtonElement;
                    }}
                    aria-label="Opciones" aria-expanded={menuObjId === o.id}>···</Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Panel lateral ── */}
        <div className="mc-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!objetivoSel ? (
            <div className="mc-empty">
              <p className="mc-empty-title">Selecciona un objetivo</p>
              <p className="mc-empty-desc">Ver tareas, OTs y progreso detallado</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--mc-color-text)', margin: 0 }}>{objetivoSel.titulo}</p>
                  {objetivoSel.descripcion && <p style={{ fontSize: 12, color: 'var(--mc-color-text-secondary)', margin: '4px 0 0' }}>{objetivoSel.descripcion}</p>}
                </div>
                <span className={`mc-badge ${OBJETIVO_BADGE[objetivoSel.estado as EstadoObjetivo]} shrink-0`} style={{ fontSize: 10 }}>
                  {OBJETIVO_LABEL[objetivoSel.estado as EstadoObjetivo]}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: 'var(--mc-color-text-secondary)' }}>Progreso</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <BadgeRiesgo pct={objetivoSel.pct} fechaLimite={objetivoSel.fecha_limite} totalTareas={objetivoSel.total_tareas} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: RIESGO_CONFIG[nivelRiesgoObjetivo(objetivoSel.pct, objetivoSel.fecha_limite, objetivoSel.total_tareas)].textColor }}>{objetivoSel.pct}%</span>
                  </div>
                </div>
                <BarraProgreso pct={objetivoSel.pct} fechaLimite={objetivoSel.fecha_limite} size="md" totalTareas={objetivoSel.total_tareas} />
                <span style={{ fontSize: 11, color: 'var(--mc-color-text-secondary)' }}>
                  {objetivoSel.completadas} de {objetivoSel.total_tareas} tareas completadas{objetivoSel.fecha_limite && ` · vence ${objetivoSel.fecha_limite}`}
                </span>
              </div>

              {/* Tareas */}
              <div style={{ borderTop: '1px solid var(--mc-color-border)', paddingTop: 12 }}>
                <div className="mc-section-header !border-none !bg-transparent !p-0">
                  <span>Tareas vinculadas</span>
                  {esJefe && <Button variant="secondary" size="xs" onClick={() => setModalTarea(true)}>+ Añadir</Button>}
                </div>
                {loadTareas ? (
                  <p style={{ fontSize: 12, color: 'var(--mc-color-text-secondary)', padding: '8px 0' }}>Cargando…</p>
                ) : tareasVinc.length === 0 ? (
                  <div className="mc-empty !p-6"><p className="mc-empty-title">Sin tareas vinculadas</p></div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto', marginTop: 8 }}>
                    {tareasVinc.map((t) => (
                      <div key={t.id}
                        onClick={() => setTareaDetalle(t)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                          borderRadius: 'var(--mc-radius-md)', padding: '7px 10px', cursor: 'pointer',
                          background: t.estado === 'atrasada' ? '#FCEBEB' : 'var(--mc-color-bg)',
                          border: `1px solid ${t.estado === 'atrasada' ? '#F7C1C1' : 'var(--mc-color-border)'}`,
                        }}
                      >
                        <p style={{ fontSize: 12, color: t.estado === 'atrasada' ? '#791F1F' : 'var(--mc-color-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{t.titulo}</p>
                        <span className={`mc-badge ${TAREA_BADGE[t.estado as EstadoTarea] ?? 'mc-badge-neutral'} shrink-0`} style={{ fontSize: 9 }}>{TAREA_LABEL[t.estado as EstadoTarea] ?? t.estado}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* OTs — solo visor */}
              {(loadOTs || otsVinc.length > 0) && (
                <div style={{ borderTop: '1px solid var(--mc-color-border)', paddingTop: 12 }}>
                  <div className="mc-section-header !border-none !bg-transparent !p-0" style={{ marginBottom: 8 }}>
                    <span>OTs vinculadas</span>
                    <span style={{ fontSize: 10, color: 'var(--mc-color-text-secondary)' }}>Solo referencia</span>
                  </div>
                  {loadOTs ? <p style={{ fontSize: 12, color: 'var(--mc-color-text-secondary)' }}>Cargando…</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {otsVinc.map((ot: { id: string; numero: string; estado: string; descripcion: string }) => (
                        <div key={ot.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderRadius: 'var(--mc-radius-md)', padding: '7px 10px', background: 'var(--mc-color-bg)', border: '1px solid var(--mc-color-border)' }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--mc-color-text-secondary)', margin: '0 0 1px' }}>{ot.numero}</p>
                            <p style={{ fontSize: 12, color: 'var(--mc-color-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ot.descripcion}</p>
                          </div>
                          <span className={`mc-badge ${ESTADO_OT_BADGE[ot.estado as keyof typeof ESTADO_OT_BADGE] ?? 'mc-badge-neutral'} shrink-0`} style={{ fontSize: 9 }}>
                            {ESTADO_OT_LABEL[ot.estado as keyof typeof ESTADO_OT_LABEL] ?? ot.estado}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal: nuevo objetivo */}
      <Modal open={modalNuevo} onClose={cerrarModalNuevoObjetivo} title="Nuevo objetivo" size="sm" hasUnsavedChanges={nuevoObjetivoHasChanges}
        footer={<><Button variant="primary" size="lg" fullWidth onClick={() => void submitNuevoObjetivo()} disabled={!canSubmitNuevo}>{creandoObj ? 'Guardando…' : 'Crear objetivo'}</Button><CancelButton onClick={cerrarModalNuevoObjetivo} disabled={creandoObj} /></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="mc-field">
            <label className="mc-field-label" htmlFor="obj-titulo">Título</label>
            <input id="obj-titulo" className="mc-input" value={nuevoObjetivoForm.titulo} onChange={(e) => setNuevoObjetivoForm((p) => ({ ...p, titulo: e.target.value }))} autoFocus required />
          </div>
          <div className="mc-field">
            <label className="mc-field-label" htmlFor="obj-desc">Descripción (opcional)</label>
            <textarea id="obj-desc" className="mc-input" style={{ minHeight: 72 }} value={nuevoObjetivoForm.descripcion} onChange={(e) => setNuevoObjetivoForm((p) => ({ ...p, descripcion: e.target.value }))} />
          </div>
          <div className="mc-field">
            <label className="mc-field-label" htmlFor="obj-limite">Fecha límite (opcional)</label>
            <input id="obj-limite" type="date" className="mc-input" value={nuevoObjetivoForm.limite} onChange={(e) => setNuevoObjetivoForm((p) => ({ ...p, limite: e.target.value }))} />
          </div>
          <div className="mc-field">
            <label className="mc-field-label" htmlFor="obj-resp">Responsable</label>
            <select id="obj-resp" className="mc-input" value={nuevoObjetivoForm.responsableId} onChange={(e) => setNuevoObjetivoForm((p) => ({ ...p, responsableId: e.target.value }))}>
              <option value="">Selecciona…</option>
              {usuariosActivos.map((u: Pick<Usuario, 'id' | 'nombre' | 'email'>) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </div>
        </div>
      </Modal>

      {/* Modal: completar objetivo */}
      <Modal open={modalCompletar} onClose={cerrarCompletar} title={esJefe ? 'Cerrar objetivo' : 'Marcar como completado'} size="sm"
        footer={<><Button variant="primary" size="lg" fullWidth onClick={() => void confirmarCompletar()} disabled={completandoObj}>{completandoObj ? 'Guardando…' : esJefe ? 'Cerrar objetivo' : 'Confirmar'}</Button><CancelButton onClick={cerrarCompletar} disabled={completandoObj} /></>}>
        <p style={{ fontSize: 13, color: 'var(--mc-color-text-secondary)', margin: 0 }}>
          {esJefe
            ? 'El objetivo se marcará como completado independientemente del progreso actual.'
            : 'Todas las tareas están completadas. ¿Confirmas que el objetivo ha sido cumplido?'}
        </p>
      </Modal>

      {/* Modal: añadir tarea — usa el mismo modal completo que el resto del sistema */}
      <ModalNuevaTarea
        modo="dia"
        fechaDia={tareaObjetivoForm.fecha}
        fechaReferencia={tareaObjetivoForm.fecha}
        open={modalTarea && Boolean(seleccionId)}
        objetivos={[]}
        usuarioActualId={usuario.id}
        usuariosAsignables={usuariosActivos}
        onClose={cerrarModalTareaObjetivo}
        onSubmit={async (input) => {
          addTareaVinculada(input);
        }}
      />

      {/* Modal: eliminar objetivo */}
      <Modal open={Boolean(eliminarObjId)} onClose={cerrarEliminar} title="Eliminar objetivo" size="sm"
        footer={<><Button variant="danger" size="lg" fullWidth onClick={() => void confirmarEliminar()} disabled={eliminandoObj || !motivoOk}>{eliminandoObj ? 'Eliminando…' : 'Eliminar objetivo'}</Button><CancelButton onClick={cerrarEliminar} disabled={eliminandoObj} /></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {objetivoEliminar && <p style={{ fontSize: 13, color: 'var(--mc-color-text-secondary)', margin: 0 }}><strong>{objetivoEliminar.titulo}</strong> · Esta acción no se puede deshacer.</p>}
          <JustificacionField label="Motivo de eliminación" value={motivoEliminar} onChange={setMotivoEliminar} placeholder="Indica el motivo de la eliminación…" disabled={eliminandoObj} autoFocus />
        </div>
      </Modal>

      {/* Modal: detalle de tarea vinculada */}
      <ModalDetalleTareaSemana
        open={tareaDetalle !== null}
        tarea={tareaDetalle}
        objetivos={[]}
        usuariosAsignables={usuariosActivos}
        readOnly={!esJefe && tareaDetalle?.asignado_a !== usuario.id}
        onClose={() => setTareaDetalle(null)}
        onGuardar={async () => { setTareaDetalle(null); }}
        onIniciar={async (t: Tarea) => { void t; setTareaDetalle(null); }}
        onCompletar={(t: Tarea) => { void t; setTareaDetalle(null); }}
        onReprogramar={(t: Tarea) => { void t; setTareaDetalle(null); }}
        onBloquear={(t: Tarea) => { void t; setTareaDetalle(null); }}
        onEliminar={async () => { setTareaDetalle(null); }}
      />

      {/* Portal: menú flotante de objetivo (evita overflow:hidden de la tabla) */}
      {menuObjId && menuPos && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{
            position: 'fixed', top: menuPos.top, left: menuPos.left,
            zIndex: 9999, minWidth: 170, borderRadius: 10,
            border: '1px solid var(--mc-color-border)',
            background: 'var(--mc-color-bg)', padding: '4px 0',
            boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
          }}
        >
          {puedeCompletar(menuObjId) && (
            <Button variant="ghost" size="xs" role="menuitem"
              className="!h-auto w-full justify-start rounded-none px-3 py-2 text-xs font-normal"
              style={{ color: 'var(--mc-color-success)' }}
              onClick={() => { setMenuPos(null); abrirCompletar(menuObjId); }}>
              {esJefe ? 'Cerrar objetivo' : 'Marcar completado'}
            </Button>
          )}
          {esJefe && (
            <Button variant="ghost" size="xs" role="menuitem"
              className="!h-auto w-full justify-start rounded-none px-3 py-2 text-xs font-normal"
              onClick={() => { setMenuObjId(null); setMenuPos(null); }}>Editar</Button>
          )}
          {puedeEliminar(menuObjId) && (
            <Button variant="danger" size="xs" role="menuitem"
              className="!h-auto w-full justify-start rounded-none px-3 py-2 text-xs font-normal"
              onClick={() => { setMenuObjId(null); setMenuPos(null); setEliminarObjId(menuObjId); }}>Eliminar</Button>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}