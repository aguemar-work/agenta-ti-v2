import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button, CancelButton } from '@/components/ui/Button';
import { JustificacionField } from '@/components/ui/JustificacionField';
import { ModalNuevaTarea } from '@/components/tareas/ModalNuevaTarea';
import { ModalDetalleTareaSemana } from '@/components/semana/ModalDetalleTareaSemana';
import { useObjetivosPage } from '@/hooks/useObjetivosPage';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { OBJETIVO_BADGE, OBJETIVO_LABEL } from '@/lib/estadoConfig';
import { TareaEstadoIndicator } from '@/components/tareas/TareaEstadoIndicator';
import { ESTADO_OT_BADGE, ESTADO_OT_LABEL } from '@/lib/otConfig';
import { nivelRiesgoObjetivo, RIESGO_CONFIG } from '@/lib/tareaUrgencia';
import type { EstadoObjetivo, EstadoTarea, Tarea, Usuario } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ValuePropositionBanner } from '@/components/ui/ValuePropositionBanner';

function BarraProgreso({ pct, fechaLimite, size = 'sm', totalTareas }: { pct: number; fechaLimite: string | null; size?: 'sm' | 'md'; totalTareas?: number }) {
  const nivel  = nivelRiesgoObjetivo(pct, fechaLimite, totalTareas);
  const config = RIESGO_CONFIG[nivel];
  const h      = size === 'md' ? 8 : 5;
  const bgTrack =
    nivel === 'sin_fecha' ? 'var(--mc-color-border)' :
    nivel === 'critico'   ? 'var(--mc-state-atrasada-bar-soft)' :
    nivel === 'moderado'  ? 'var(--mc-state-precaucion-bar-soft)' :
                            'var(--mc-state-completada-bar-soft)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ height: h, width: '100%', borderRadius: h, overflow: 'hidden', background: bgTrack }}>
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

  const nombreResponsablePorId = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of usuariosActivos) m.set(u.id, u.nombre);
    if (usuario) m.set(usuario.id, usuario.nombre);
    return m;
  }, [usuariosActivos, usuario]);

  if (!usuario) return null;

  const canSubmitNuevo = !creandoObj && nuevoObjetivoForm.titulo.trim().length > 0 && nuevoObjetivoForm.responsableId.trim().length > 0;
  const criticos = objetivos.filter((o) => nivelRiesgoObjetivo(o.pct, o.fecha_limite, o.total_tareas) === 'critico').length;

  const gridCols = '1fr 100px 80px 180px 90px 32px';

  return (
    <div className={APP_PAGE_CLASS}>
      <PageHeader
        title="Objetivos"
        subtitle={criticos > 0 ? `${criticos} objetivo${criticos > 1 ? 's' : ''} en estado crítico` : 'Gestión estratégica'}
        actions={esJefe ? <Button variant="primary" onClick={abrirModalNuevo} size="sm">+ Nuevo objetivo</Button> : null}
      />

      <ValuePropositionBanner
        userId={usuario.id}
        feature="objetivos"
        title="Operación alineada a estrategia"
        description="Vincula tareas de Mi semana y órdenes de trabajo a objetivos. El progreso se calcula solo — sin tableros desconectados como en herramientas genéricas."
      />

      {isError && <p style={{ fontSize: 13, color: 'var(--mc-color-danger)', margin: '0 0 12px' }}>No se pudieron cargar los objetivos.</p>}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">

        {/* ── Tabla ── */}
        <div className="mc-card !p-0 overflow-hidden">
          <div className="mc-section-header"><span>Lista de objetivos</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 12, borderBottom: '1px solid var(--mc-color-border)', background: 'var(--mc-color-bg)', padding: '6px 16px' }}>
            {['Objetivo', 'Responsable', 'Estado', 'Progreso', 'Límite', ''].map((h) => (
              <span key={h} style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--mc-color-text-secondary)' }}>{h}</span>
            ))}
          </div>

          {loadO ? (
            <p style={{ padding: 16, fontSize: 13, color: 'var(--mc-color-text-secondary)' }}>Cargando…</p>
          ) : objetivos.length === 0 ? (
            <EmptyState
              title="Sin objetivos"
              desc={esJefe ? 'Crea el primer objetivo estratégico del equipo.' : 'Tu jefe aún no ha creado objetivos para el equipo.'}
            />
          ) : objetivos.map((o) => {
            const nivel   = nivelRiesgoObjetivo(o.pct, o.fecha_limite, o.total_tareas);
            const config  = RIESGO_CONFIG[nivel];
            const esCrit  = nivel === 'critico';
            const vencido = o.fecha_limite && new Date(`${o.fecha_limite}T12:00:00`) < new Date() && o.estado === 'activo';

            return (
              <div
                key={o.id}
                onClick={() => setSeleccionId(o.id)}
                className={[
                  'mc-list-row',
                  seleccionId === o.id ? 'mc-list-row--selected' : '',
                  seleccionId !== o.id && esCrit ? 'mc-list-row--atrasada' : '',
                ].filter(Boolean).join(' ')}
                style={{ gridTemplateColumns: gridCols }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--mc-color-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.titulo}</p>
                    <BadgeRiesgo pct={o.pct} fechaLimite={o.fecha_limite} totalTareas={o.total_tareas} />
                    {vencido && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 10, background: 'var(--mc-state-atrasada-bg-soft)', color: 'var(--mc-state-atrasada-meta)' }}>Vencido</span>}
                  </div>
                  {o.descripcion && <p style={{ fontSize: 11, color: 'var(--mc-color-text-secondary)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.descripcion}</p>}
                </div>

                <span style={{ fontSize: 12, color: 'var(--mc-color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {o.responsable_id ? (nombreResponsablePorId.get(o.responsable_id) ?? '—') : '—'}
                </span>

                <span className={`mc-badge ${OBJETIVO_BADGE[o.estado as EstadoObjetivo]}`} style={{ fontSize: 10 }}>{OBJETIVO_LABEL[o.estado as EstadoObjetivo]}</span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <BarraProgreso pct={o.pct} fechaLimite={o.fecha_limite} totalTareas={o.total_tareas} />
                  <span style={{ fontSize: 10, color: config.textColor !== 'var(--mc-color-text-secondary)' ? config.textColor : 'var(--mc-color-text-secondary)' }}>
                    {o.completadas}/{o.total_tareas} tareas · {o.pct}%
                  </span>
                </div>

                <span style={{ fontSize: 12, color: esCrit ? 'var(--mc-state-atrasada-meta)' : 'var(--mc-color-text-secondary)' }}>{o.fecha_limite ?? '—'}</span>

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
                    aria-label="Opciones" aria-expanded={menuObjId === o.id}>
                    <MoreHorizontal size={16} aria-hidden />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Panel lateral ── */}
        <div className="mc-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!objetivoSel ? (
            <EmptyState
              title="Selecciona un objetivo"
              desc="Ver tareas, OTs y progreso detallado"
            />
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
              <div className="flex flex-col gap-3 border-t border-[var(--mc-color-border)] pt-3">
                <div className="mc-section-header mc-section-header--plain">
                  <span>Tareas vinculadas</span>
                  {esJefe && <Button variant="secondary" size="xs" onClick={() => setModalTarea(true)}>+ Añadir</Button>}
                </div>
                {loadTareas ? (
                  <p className="py-2 text-[var(--mc-text-sm)] text-[var(--mc-color-text-secondary)]">Cargando…</p>
                ) : tareasVinc.length === 0 ? (
                  <EmptyState compact title="Sin tareas vinculadas" />
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {tareasVinc.map((t) => (
                      <div key={t.id}
                        onClick={() => setTareaDetalle(t)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                          borderRadius: 'var(--mc-radius-md)', padding: '7px 10px', cursor: 'pointer',
                          background: t.estado === 'atrasada' ? 'var(--mc-state-atrasada-bg-soft)' : 'var(--mc-color-bg)',
                          border: `1px solid ${t.estado === 'atrasada' ? 'var(--mc-state-atrasada-border)' : 'var(--mc-color-border)'}`,
                        }}
                      >
                        <p style={{ fontSize: 12, color: t.estado === 'atrasada' ? 'var(--mc-state-atrasada-fg)' : 'var(--mc-color-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{t.titulo}</p>
                        <TareaEstadoIndicator estado={t.estado as EstadoTarea} className="shrink-0" style={{ fontSize: 9 }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* OTs — solo visor */}
              {(loadOTs || otsVinc.length > 0) && (
                <div style={{ borderTop: '1px solid var(--mc-color-border)', paddingTop: 12 }}>
                  <div className="mc-section-header mc-section-header--plain" style={{ marginBottom: 8 }}>
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
      <Modal open={modalNuevo} onClose={cerrarModalNuevoObjetivo} title="Nuevo objetivo" analyticsId="modal-nuevo-objetivo" size="sm" hasUnsavedChanges={nuevoObjetivoHasChanges}
        bodyClassName="mc-modal-form"
        footerClassName="mc-modal-footer--stack"
        footer={(
          <>
            <button type="button" className="mc-btn-modal-primary" onClick={() => void submitNuevoObjetivo()} disabled={!canSubmitNuevo || creandoObj}>
              {creandoObj ? 'Guardando…' : 'Crear objetivo'}
            </button>
            <CancelButton onClick={cerrarModalNuevoObjetivo} disabled={creandoObj} />
          </>
        )}>
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
      <Modal open={modalCompletar} onClose={cerrarCompletar} title={esJefe ? 'Cerrar objetivo' : 'Marcar como completado'} analyticsId="modal-completar-objetivo" descriptionElementId="modal-completar-objetivo-desc" size="sm"
        footer={<><Button variant="primary" size="lg" fullWidth onClick={() => void confirmarCompletar()} disabled={completandoObj}>{completandoObj ? 'Guardando…' : esJefe ? 'Cerrar objetivo' : 'Confirmar'}</Button><CancelButton onClick={cerrarCompletar} disabled={completandoObj} /></>}>
        <p id="modal-completar-objetivo-desc" style={{ fontSize: 13, color: 'var(--mc-color-text-secondary)', margin: 0 }}>
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
      <Modal open={Boolean(eliminarObjId)} onClose={cerrarEliminar} title="Eliminar objetivo" analyticsId="modal-eliminar-objetivo" descriptionElementId="modal-eliminar-objetivo-desc" size="sm"
        footer={<><Button variant="danger" size="lg" fullWidth onClick={() => void confirmarEliminar()} disabled={eliminandoObj || !motivoOk}>{eliminandoObj ? 'Eliminando…' : 'Eliminar objetivo'}</Button><CancelButton onClick={cerrarEliminar} disabled={eliminandoObj} /></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {objetivoEliminar && <p id="modal-eliminar-objetivo-desc" style={{ fontSize: 13, color: 'var(--mc-color-text-secondary)', margin: 0 }}><strong>{objetivoEliminar.titulo}</strong> · Esta acción no se puede deshacer.</p>}
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
          className="mc-dropdown-menu mc-dropdown-menu--portal"
          style={{ top: menuPos.top, left: menuPos.left }}
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