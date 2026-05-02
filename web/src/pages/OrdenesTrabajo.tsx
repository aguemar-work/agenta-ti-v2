/**
 * pages/OrdenesTrabajo.tsx
 * Lista de OTs + panel de configuración de tipos (solo jefe).
 */

import { ClipboardCheck, Plus, Settings2, ToggleLeft, ToggleRight } from 'lucide-react';
import { MIN_JUSTIFICACION_CHARS } from '@/lib/constants';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { OTFormModal } from '@/components/ot/OTFormModal';
import { OTImpresion } from '@/components/ot/OTImpresion';
import { useOrdenesTrabajoPage } from '@/hooks/useOrdenesTrabajoPage';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { ESTADO_OT_BADGE, ESTADO_OT_LABEL, MODALIDAD_OT_LABEL } from '@/lib/otConfig';
import type { EstadoOT } from '@/api/ordenTrabajo';

const FILTROS: { value: EstadoOT | 'todos'; label: string }[] = [
  { value: 'todos',        label: 'Todos' },
  { value: 'borrador',     label: 'Borrador' },
  { value: 'pendiente',    label: 'Pendiente' },
  { value: 'aprobada',     label: 'Aprobada' },
  { value: 'en_ejecucion', label: 'En ejecución' },
  { value: 'completada',   label: 'Completada' },
  { value: 'rechazada',    label: 'Rechazada' },
  { value: 'cancelada',    label: 'Cancelada' },
];

export function OrdenesTrabajo() {
  const {
    usuario, esJefe,
    ordenes, isLoading, isError, pendientesCount,
    tiposActivos, tiposInactivos,
    filtroEstado, setFiltroEstado,
    modalForm, setModalForm, editandoOT,
    viendoOT, setViendoOT,
    imprimiendoOT, setImprimiendoOT,
    modalCompletar, setModalCompletar,
    modalRechazar, setModalRechazar,
    motivoRechazo, setMotivoRechazo,
    receptorNombre, setReceptorNombre,
    receptorDni, setReceptorDni,
    receptorCargo, setReceptorCargo,
    obsCierre, setObsCierre,
    canCompletar,
    nuevoTipoNombre, setNuevoTipoNombre, canCrearTipo,
    abrirNuevaOT, abrirEditarOT,
    form, setForm, tiposTrabajo, tareasVinculables,
    mutCrear, mutActualizar, mutAprobar, mutRechazar,
    mutIniciar, mutCompletar, mutCancelar,
    mutCrearTipo, mutToggleTipo,
  } = useOrdenesTrabajoPage();

  if (!usuario) return null;

  return (
    <div className={APP_PAGE_CLASS}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <PageHeader
        title="Órdenes de trabajo"
        subtitle={esJefe
          ? `${pendientesCount} pendiente${pendientesCount !== 1 ? 's' : ''} de aprobación`
          : 'Mis órdenes de trabajo'
        }
        actions={
          <Button onClick={abrirNuevaOT} size="sm">
            <Plus size={14} style={{ marginRight: 6 }} aria-hidden />
            Nueva OT
          </Button>
        }
      />

      {isError && <p className="text-sm text-[var(--mc-color-danger)]">No se pudieron cargar las órdenes de trabajo.</p>}

      <FilterBar>
        <FilterBar.Pills
          value={filtroEstado}
          onChange={(v) => setFiltroEstado(v as typeof filtroEstado)}
          options={FILTROS.map(({ value, label }) => ({
            value,
            label,
            badge: value === 'pendiente' ? pendientesCount : undefined,
          }))}
        />
      </FilterBar>

      {/* ── Lista de OTs ────────────────────────────────────────────────── */}
      <div className="mc-card !p-0 overflow-hidden">
        <div style={{
          display: 'grid',
          gridTemplateColumns: '120px 1fr 100px 100px 110px 140px',
          gap: 12, padding: '8px 16px',
          borderBottom: '1px solid var(--mc-color-border)',
          background: 'var(--mc-color-bg)',
        }}>
          {['Número', 'Descripción', 'Área', 'Modalidad', 'Fecha', 'Estado'].map((h) => (
            <span key={h} style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--mc-color-text-secondary)' }}>
              {h}
            </span>
          ))}
        </div>

        {isLoading ? (
          <p className="p-4 text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
        ) : ordenes.length === 0 ? (
          <div className="mc-empty">
            <ClipboardCheck size={32} style={{ color: 'var(--mc-color-border-strong)', marginBottom: 4 }} aria-hidden />
            <p className="mc-empty-title">Sin órdenes de trabajo</p>
            <p className="mc-empty-desc">Crea una nueva OT para registrar un trabajo.</p>
          </div>
        ) : (
          ordenes.map((ot) => (
            <div
              key={ot.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 1fr 100px 100px 110px 140px',
                gap: 12, padding: '12px 16px',
                borderBottom: '1px solid var(--mc-color-border)',
                alignItems: 'center', cursor: 'pointer',
              }}
              className="hover:bg-[var(--mc-color-surface-hover)]"
              onClick={() => setViendoOT(ot)}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mc-color-accent)', fontFamily: 'monospace' }}>
                {ot.numero}
              </span>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--mc-color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ot.tipo_trabajo?.nombre ?? '—'}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--mc-color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ot.descripcion}
                </p>
                {esJefe && ot.creador && (
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--mc-color-text-secondary)' }}>{ot.creador.nombre}</p>
                )}
              </div>
              <span style={{ fontSize: 12, color: 'var(--mc-color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ot.area_destino}
              </span>
              <span style={{ fontSize: 12, color: 'var(--mc-color-text-secondary)' }}>
                {MODALIDAD_OT_LABEL[ot.modalidad]}
              </span>
              <span style={{ fontSize: 12, color: 'var(--mc-color-text-secondary)' }}>
                {ot.fecha_estimada}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                <span className={`mc-badge ${ESTADO_OT_BADGE[ot.estado]} text-[10px]`}>
                  {ESTADO_OT_LABEL[ot.estado]}
                </span>
                {esJefe && ot.estado === 'pendiente' && (
                  <Button size="xs" onClick={() => mutAprobar.mutate(ot.id)} disabled={mutAprobar.isPending}>
                    Aprobar
                  </Button>
                )}
                {['aprobada', 'en_ejecucion', 'completada'].includes(ot.estado) && (
                  <Button variant="ghost" size="xs" onClick={() => setImprimiendoOT(ot)}>
                    Imprimir
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Panel: tipos de trabajo (solo jefe) ─────────────────────────── */}
      {esJefe && (
        <div className="mc-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Settings2 size={16} style={{ color: 'var(--mc-color-text-secondary)' }} aria-hidden />
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--mc-color-text)' }}>
              Tipos de trabajo
            </h2>
            <span style={{ fontSize: 12, color: 'var(--mc-color-text-secondary)' }}>
              · {tiposActivos.length} activos
            </span>
          </div>

          {/* Agregar nuevo tipo */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              className="mc-input"
              style={{ flex: 1 }}
              value={nuevoTipoNombre}
              onChange={(e) => setNuevoTipoNombre(e.target.value.toUpperCase())}
              placeholder="Ej: REVISIÓN DE INFRAESTRUCTURA"
              onKeyDown={(e) => { if (e.key === 'Enter' && canCrearTipo) mutCrearTipo.mutate(); }}
              maxLength={60}
            />
            <Button
              size="sm"
              disabled={!canCrearTipo}
              onClick={() => mutCrearTipo.mutate()}
            >
              <Plus size={14} aria-hidden />
              Agregar
            </Button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

              {/* Tipos activos */}
              {tiposActivos.map((tipo) => (
                <div
                  key={tipo.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', borderRadius: 'var(--mc-radius-md)',
                    border: '1px solid var(--mc-color-border)',
                    background: 'var(--mc-color-surface)',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--mc-color-text)' }}>
                    {tipo.nombre}
                  </span>
                  <button
                    type="button"
                    onClick={() => mutToggleTipo.mutate({ id: tipo.id, activo: false })}
                    disabled={mutToggleTipo.isPending}
                    title="Desactivar tipo"
                    aria-label={`Desactivar ${tipo.nombre}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--mc-color-success)', fontSize: 12, fontWeight: 500,
                      padding: '4px 8px', borderRadius: 'var(--mc-radius-sm)',
                      transition: 'background 0.13s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--mc-color-surface-hover)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
                  >
                    <ToggleRight size={16} aria-hidden />
                    Activo
                  </button>
                </div>
              ))}

              {/* Tipos inactivos — colapsados visualmente */}
              {tiposInactivos.length > 0 && (
                <>
                  <div style={{ padding: '8px 0 4px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--mc-color-text-secondary)' }}>
                    Inactivos
                  </div>
                  {tiposInactivos.map((tipo) => (
                    <div
                      key={tipo.id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 12px', borderRadius: 'var(--mc-radius-md)',
                        border: '1px solid var(--mc-color-border)',
                        background: 'var(--mc-color-bg)',
                        opacity: 0.6,
                      }}
                    >
                      <span style={{ fontSize: 13, color: 'var(--mc-color-text-secondary)', textDecoration: 'line-through' }}>
                        {tipo.nombre}
                      </span>
                      <button
                        type="button"
                        onClick={() => mutToggleTipo.mutate({ id: tipo.id, activo: true })}
                        disabled={mutToggleTipo.isPending}
                        title="Reactivar tipo"
                        aria-label={`Reactivar ${tipo.nombre}`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--mc-color-text-secondary)', fontSize: 12, fontWeight: 500,
                          padding: '4px 8px', borderRadius: 'var(--mc-radius-sm)',
                          transition: 'background 0.13s, color 0.13s',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background = 'var(--mc-color-surface-hover)';
                          (e.currentTarget as HTMLButtonElement).style.color = 'var(--mc-color-text)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background = 'none';
                          (e.currentTarget as HTMLButtonElement).style.color = 'var(--mc-color-text-secondary)';
                        }}
                      >
                        <ToggleLeft size={16} aria-hidden />
                        Reactivar
                      </button>
                    </div>
                  ))}
                </>
              )}

              {tiposActivos.length === 0 && tiposInactivos.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--mc-color-text-secondary)', padding: '8px 0' }}>
                  Sin tipos de trabajo configurados.
                </p>
              )}
          </div>
        </div>
      )}

      {/* ── Modal detalle / acciones ────────────────────────────────────── */}
      <Modal
        open={viendoOT !== null}
        onClose={() => setViendoOT(null)}
        title={viendoOT?.numero ?? ''}
        size="md"
        footer={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!esJefe && viendoOT && ['borrador', 'pendiente'].includes(viendoOT.estado) && (
              <Button variant="secondary" size="sm" onClick={() => { setViendoOT(null); abrirEditarOT(viendoOT); }}>Editar</Button>
            )}
            {!esJefe && viendoOT && ['borrador', 'pendiente'].includes(viendoOT.estado) && (
              <Button variant="danger" size="sm" onClick={() => { mutCancelar.mutate(viendoOT.id); setViendoOT(null); }}>Cancelar OT</Button>
            )}
            {!esJefe && viendoOT?.estado === 'aprobada' && (
              <Button size="sm" onClick={() => { mutIniciar.mutate(viendoOT.id); setViendoOT(null); }}>Iniciar ejecución</Button>
            )}
            {!esJefe && viendoOT && ['aprobada', 'en_ejecucion'].includes(viendoOT.estado) && (
              <Button size="sm" onClick={() => { setModalCompletar(viendoOT); setViendoOT(null); }}>Completar OT</Button>
            )}
            {esJefe && viendoOT?.estado === 'pendiente' && (
              <Button size="sm" onClick={() => { mutAprobar.mutate(viendoOT.id); setViendoOT(null); }}>Aprobar</Button>
            )}
            {esJefe && viendoOT?.estado === 'pendiente' && (
              <Button variant="danger" size="sm" onClick={() => { setModalRechazar(viendoOT); setViendoOT(null); }}>Rechazar</Button>
            )}
            {viendoOT && ['aprobada', 'en_ejecucion', 'completada'].includes(viendoOT.estado) && (
              <Button variant="secondary" size="sm" onClick={() => { setImprimiendoOT(viendoOT); setViendoOT(null); }}>Imprimir</Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setViendoOT(null)}>Cerrar</Button>
          </div>
        }
      >
        {viendoOT && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className={`mc-badge ${ESTADO_OT_BADGE[viendoOT.estado]}`}>{ESTADO_OT_LABEL[viendoOT.estado]}</span>
              <span style={{ color: 'var(--mc-color-text-secondary)' }}>{MODALIDAD_OT_LABEL[viendoOT.modalidad]}</span>
            </div>
            {[
              { label: 'Tipo de trabajo',    value: viendoOT.tipo_trabajo?.nombre ?? '—' },
              { label: 'Tarea vinculada',   value: viendoOT.tarea?.titulo ?? '—' },
              { label: 'Descripción',        value: viendoOT.descripcion },
              { label: 'Área destino',       value: viendoOT.area_destino },
              { label: 'Ubicación',          value: viendoOT.ubicacion ?? '—' },
              { label: 'Fecha estimada',     value: viendoOT.fecha_estimada },
              { label: 'Hora inicio',        value: viendoOT.hora_inicio_est ?? '—' },
              { label: 'Duración estimada',  value: viendoOT.duracion_est_min ? `${viendoOT.duracion_est_min} min` : '—' },
              { label: 'Equipos/materiales', value: viendoOT.equipos_materiales ?? '—' },
              { label: 'Observaciones',      value: viendoOT.observaciones ?? '—' },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8 }}>
                <span style={{ color: 'var(--mc-color-text-secondary)', fontWeight: 500 }}>{label}</span>
                <span style={{ color: 'var(--mc-color-text)' }}>{value}</span>
              </div>
            ))}
            {viendoOT.motivo_rechazo && (
              <div style={{ background: 'var(--mc-color-bg)', borderLeft: '3px solid var(--mc-color-danger)', padding: '8px 12px', borderRadius: '0 6px 6px 0' }}>
                <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 600, color: 'var(--mc-color-danger)' }}>Motivo de rechazo</p>
                <p style={{ margin: 0 }}>{viendoOT.motivo_rechazo}</p>
              </div>
            )}
            {viendoOT.estado === 'completada' && (
              <div style={{ borderTop: '1px solid var(--mc-color-border)', paddingTop: 12 }}>
                <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Datos del receptor</p>
                {[
                  { label: 'Nombre', value: viendoOT.receptor_nombre ?? '—' },
                  { label: 'DNI',    value: viendoOT.receptor_dni ?? '—' },
                  { label: 'Cargo',  value: viendoOT.receptor_cargo ?? '—' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, marginBottom: 4 }}>
                    <span style={{ color: 'var(--mc-color-text-secondary)', fontWeight: 500 }}>{label}</span>
                    <span>{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Modal completar OT ──────────────────────────────────────────── */}
      <Modal
        open={modalCompletar !== null}
        onClose={() => setModalCompletar(null)}
        title="Completar orden de trabajo"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalCompletar(null)}>Cancelar</Button>
            <Button onClick={() => mutCompletar.mutate()} disabled={!canCompletar || mutCompletar.isPending}>
              {mutCompletar.isPending ? 'Guardando…' : 'Confirmar cierre'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--mc-color-text-secondary)' }}>
            Ingresa los datos del responsable que recibe el trabajo.
          </p>
          {[
            { label: 'Nombre del receptor', value: receptorNombre, set: setReceptorNombre, placeholder: 'Nombre completo' },
            { label: 'DNI',                 value: receptorDni,    set: setReceptorDni,    placeholder: '12345678' },
            { label: 'Cargo',               value: receptorCargo,  set: setReceptorCargo,  placeholder: 'Jefe de área, etc.' },
          ].map(({ label, value, set, placeholder }) => (
            <label key={label} className="mc-field">
              <span className="mc-field-label">{label}</span>
              <input className="mc-input" value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder} required />
            </label>
          ))}
          <label className="mc-field">
            <span className="mc-field-label">Observaciones de cierre (opcional)</span>
            <textarea className="mc-input" style={{ minHeight: 72 }} value={obsCierre} onChange={(e) => setObsCierre(e.target.value)} />
          </label>
        </div>
      </Modal>

      {/* ── Modal rechazar OT ───────────────────────────────────────────── */}
      <Modal
        open={modalRechazar !== null}
        onClose={() => { setModalRechazar(null); setMotivoRechazo(''); }}
        title="Rechazar orden de trabajo"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setModalRechazar(null); setMotivoRechazo(''); }}>Cancelar</Button>
            <Button
              variant="danger"
              disabled={motivoRechazo.trim().length < MIN_JUSTIFICACION_CHARS || mutRechazar.isPending}
              onClick={() => modalRechazar && mutRechazar.mutate({ otId: modalRechazar.id, motivo: motivoRechazo })}
            >
              {mutRechazar.isPending ? 'Guardando…' : 'Rechazar'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--mc-color-text-secondary)' }}>
            {modalRechazar?.numero} — Indica el motivo (mínimo {MIN_JUSTIFICACION_CHARS} caracteres).
          </p>
          <label className="mc-field">
            <span style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="mc-field-label">Motivo</span>
              <span className={`mc-char-count${motivoRechazo.trim().length < MIN_JUSTIFICACION_CHARS && motivoRechazo.length > 0 ? ' mc-char-count-error' : ''}`}>
                {motivoRechazo.trim().length}/{MIN_JUSTIFICACION_CHARS}
              </span>
            </span>
            <textarea className="mc-input" style={{ minHeight: 80 }} value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)} placeholder="Describe el motivo del rechazo…" autoFocus />
          </label>
        </div>
      </Modal>

      {/* ── Formulario crear/editar OT ──────────────────────────────────── */}
      {modalForm && (
        <OTFormModal
          open={modalForm}
          editando={editandoOT}
          form={form}
          setForm={setForm}
          tiposTrabajo={tiposTrabajo}
          onClose={() => setModalForm(false)}
          tareasVinculables={tareasVinculables}
        onGuardar={(enviar) => editandoOT ? mutActualizar.mutate(enviar) : mutCrear.mutate(enviar)}
          busy={mutCrear.isPending || mutActualizar.isPending}
        />
      )}

      {/* ── Documento impresión ─────────────────────────────────────────── */}
      {imprimiendoOT && (
        <OTImpresion ot={imprimiendoOT} onClose={() => setImprimiendoOT(null)} />
      )}
    </div>
  );
}