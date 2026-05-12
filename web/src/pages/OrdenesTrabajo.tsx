/**
 * pages/OrdenesTrabajo.tsx
 * Lista de OTs + panel de configuración de tipos (solo jefe).
 */

import { useState, type ReactNode } from 'react';
import { AlertTriangle, ChevronDown, ClipboardCheck, Plus, Settings2, ToggleLeft, ToggleRight } from 'lucide-react';
import { MIN_JUSTIFICACION_CHARS } from '@/lib/constants';

import { Modal } from '@/components/ui/Modal';
import { Button, CancelButton } from '@/components/ui/Button';
import { JustificacionField } from '@/components/ui/JustificacionField';
import { OTFormModal } from '@/components/ot/OTFormModal';
import { OTImpresion } from '@/components/ot/OTImpresion';
import { useOrdenesTrabajoPage } from '@/hooks/useOrdenesTrabajoPage';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { fechaLocalYmd } from '@/lib/fecha';
import { otVencida } from '@/lib/otHelpers';
import { ESTADO_OT_BADGE, ESTADO_OT_LABEL, MODALIDAD_OT_LABEL, PRIORIDAD_OT_BADGE, PRIORIDAD_OT_LABEL } from '@/lib/otConfig';
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

// ---------------------------------------------------------------------------
// Sub-componentes del modal de detalle OT
// ---------------------------------------------------------------------------

function OTCampo({ label, valor }: { label: string; valor: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, alignItems: 'start' }}>
      <span style={{ color: 'var(--mc-color-text-secondary)', fontWeight: 500, fontSize: 12 }}>
        {label}
      </span>
      <span style={{ color: 'var(--mc-color-text)', fontSize: 13 }}>{valor}</span>
    </div>
  );
}

function OTSeccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{
        margin: 0, fontSize: 10, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '.06em',
        color: 'var(--mc-color-text-secondary)',
      }}>
        {titulo}
      </p>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 8,
        padding: '10px 12px',
        background: 'var(--mc-color-bg-secondary)',
        borderRadius: 'var(--mc-radius-md)',
        border: '0.5px solid var(--mc-color-border)',
      }}>
        {children}
      </div>
    </div>
  );
}

function OTSeccionColapsable({ titulo, children }: { titulo: string; children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '4px 0', textAlign: 'left',
        }}
      >
        <span style={{
          fontSize: 10, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '.06em',
          color: 'var(--mc-color-text-secondary)',
        }}>
          {titulo}
        </span>
        <ChevronDown
          size={12}
          aria-hidden
          style={{
            color: 'var(--mc-color-text-secondary)',
            transition: 'transform 0.15s',
            transform: abierto ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>
      {abierto && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 8,
          padding: '10px 12px',
          background: 'var(--mc-color-bg-secondary)',
          borderRadius: 'var(--mc-radius-md)',
          border: '0.5px solid var(--mc-color-border)',
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

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

  const hoy = fechaLocalYmd(new Date());
  const urgentesCount = ordenes.filter((o) => o.prioridad === 'urgente' && !['completada','cancelada','rechazada'].includes(o.estado)).length;
  const vencidasCount = ordenes.filter((o) => otVencida(o, hoy)).length;

  const subtituloJefe = [
    pendientesCount > 0 && `${pendientesCount} pendiente${pendientesCount !== 1 ? 's' : ''}`,
    urgentesCount  > 0 && `${urgentesCount} urgente${urgentesCount !== 1 ? 's' : ''}`,
    vencidasCount  > 0 && `${vencidasCount} vencida${vencidasCount !== 1 ? 's' : ''}`,
  ].filter(Boolean).join(' · ') || 'Gestión de órdenes';

  return (
    <div className={APP_PAGE_CLASS}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <PageHeader
        title="Órdenes de trabajo"
        subtitle={esJefe ? subtituloJefe : 'Mis órdenes de trabajo'}
        actions={
          <Button variant="primary" onClick={abrirNuevaOT} size="sm">
            <Plus size={14} style={{ marginRight: 6 }} aria-hidden />
            Nueva OT
          </Button>
        }
      />

      {isError && (
        <p style={{ fontSize: 13, color: 'var(--mc-color-danger)', margin: '0 0 12px' }}>
          No se pudieron cargar las órdenes de trabajo.
        </p>
      )}

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

      {/* ── Lista de OTs ─────────────────────────────────────────────────── */}
      <div className="mc-card !p-0 overflow-hidden">

        {/* Cabecera */}
        <div style={{
          display:             'grid',
          gridTemplateColumns: '110px 1fr 110px 160px',
          gap:                  12,
          padding:             '6px 16px',
          borderBottom:        '1px solid var(--mc-color-border)',
          background:          'var(--mc-color-bg)',
        }}>
          {['Número', 'Descripción', 'Fecha', 'Estado'].map((h) => (
            <span key={h} style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--mc-color-text-secondary)' }}>
              {h}
            </span>
          ))}
        </div>

        {isLoading ? (
          <p style={{ padding: 16, fontSize: 13, color: 'var(--mc-color-text-secondary)' }}>Cargando…</p>
        ) : ordenes.length === 0 ? (
          <div className="mc-empty">
            <ClipboardCheck size={28} style={{ color: 'var(--mc-color-border-strong)', marginBottom: 4 }} aria-hidden />
            <p className="mc-empty-title">Sin órdenes de trabajo</p>
            <p className="mc-empty-desc">Crea una nueva OT para registrar un trabajo.</p>
          </div>
        ) : (
          ordenes.map((ot) => {
            const esUrgente  = ot.prioridad === 'urgente';
            const esVencida  = otVencida(ot, hoy);

            return (
              <div
                key={ot.id}
                className="mc-ot-row"
                style={{
                  display:             'grid',
                  gridTemplateColumns: '110px 1fr 110px 160px',
                  gap:                  12,
                  padding:             '10px 16px',
                  borderBottom:        '1px solid var(--mc-color-border)',
                  alignItems:          'center',
                  background:          esVencida
                    ? 'var(--mc-ot-vencida-bg)'
                    : esUrgente
                    ? 'var(--mc-ot-urgente-bg)'
                    : undefined,
                  borderLeft: esVencida
                    ? '3px solid var(--mc-ot-vencida-border)'
                    : esUrgente
                    ? '3px solid var(--mc-ot-urgente-border)'
                    : undefined,
                  paddingLeft: (esVencida || esUrgente) ? 13 : 16,
                }}
                onClick={() => setViendoOT(ot)}
              >
                {/* Número */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {(esUrgente || esVencida) && (
                    <AlertTriangle
                      size={12}
                      style={{ color: esVencida ? 'var(--mc-ot-vencida-border)' : 'var(--mc-ot-urgente-border)', flexShrink: 0 }}
                      aria-hidden
                    />
                  )}
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--mc-color-accent)', fontFamily: 'monospace' }}>
                    {ot.numero}
                  </span>
                </div>

                {/* Descripción */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--mc-color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ot.tipo_trabajo?.nombre ?? ot.descripcion}
                    </p>
                    {esUrgente && (
                      <span className="mc-badge mc-badge-warning" style={{ fontSize: 10, flexShrink: 0 }}>
                        Urgente
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--mc-color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ot.tipo_trabajo?.nombre ? ot.descripcion : ''}
                  </p>
                  {esJefe && ot.creador && (
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--mc-color-text-secondary)' }}>
                      {ot.creador.nombre}
                    </p>
                  )}
                </div>

                {/* Fecha */}
                <div>
                  <span style={{
                    fontSize:   12,
                    fontWeight: esVencida ? 600 : 400,
                    color:      esVencida ? 'var(--mc-ot-vencida-border)' : 'var(--mc-color-text-secondary)',
                  }}>
                    {ot.fecha_estimada}
                  </span>
                  {esVencida && (
                    <span style={{ display: 'block', fontSize: 10, color: 'var(--mc-ot-vencida-border)' }}>
                      Vencida
                    </span>
                  )}
                </div>

                {/* Estado + acciones */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                  <span className={`mc-badge ${ESTADO_OT_BADGE[ot.estado]}`} style={{ fontSize: 10 }}>
                    {ESTADO_OT_LABEL[ot.estado]}
                  </span>
                  {esJefe && ot.estado === 'pendiente' && (
                    <Button variant="primary" size="xs" onClick={() => mutAprobar.mutate(ot.id)} disabled={mutAprobar.isPending}>
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
            );
          })
        )}
      </div>

      {/* ── Panel tipos de trabajo (solo jefe) ──────────────────────────── */}
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
            <Button variant="primary" size="sm" disabled={!canCrearTipo} onClick={() => mutCrearTipo.mutate()}>
              <Plus size={14} aria-hidden /> Agregar
            </Button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {tiposActivos.map((tipo) => (
              <div key={tipo.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', borderRadius: 'var(--mc-radius-md)',
                border: '1px solid var(--mc-color-border)', background: 'var(--mc-color-surface)',
              }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--mc-color-text)' }}>{tipo.nombre}</span>
                <button type="button"
                  onClick={() => mutToggleTipo.mutate({ id: tipo.id, activo: false })}
                  disabled={mutToggleTipo.isPending}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mc-color-success)', fontSize: 12, fontWeight: 500, padding: '4px 8px', borderRadius: 'var(--mc-radius-sm)' }}
                >
                  <ToggleRight size={16} aria-hidden /> Activo
                </button>
              </div>
            ))}

            {tiposInactivos.length > 0 && (
              <>
                <div style={{ padding: '8px 0 4px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--mc-color-text-secondary)' }}>
                  Inactivos
                </div>
                {tiposInactivos.map((tipo) => (
                  <div key={tipo.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', borderRadius: 'var(--mc-radius-md)',
                    border: '1px solid var(--mc-color-border)', background: 'var(--mc-color-bg)', opacity: 0.6,
                  }}>
                    <span style={{ fontSize: 13, color: 'var(--mc-color-text-secondary)', textDecoration: 'line-through' }}>{tipo.nombre}</span>
                    <button type="button"
                      onClick={() => mutToggleTipo.mutate({ id: tipo.id, activo: true })}
                      disabled={mutToggleTipo.isPending}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mc-color-text-secondary)', fontSize: 12, fontWeight: 500, padding: '4px 8px', borderRadius: 'var(--mc-radius-sm)' }}
                    >
                      <ToggleLeft size={16} aria-hidden /> Reactivar
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

      {/* ── Modal detalle / acciones ───────────────────────────────────── */}
      <Modal
        open={viendoOT !== null}
        onClose={() => setViendoOT(null)}
        title={viendoOT ? `${viendoOT.numero}${viendoOT.prioridad === 'urgente' ? ' · Urgente' : ''}` : ''}
        size="md"
        footer={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Acción primaria según estado — 1 por panel */}
            {!esJefe && viendoOT?.estado === 'aprobada' && (
              <Button variant="primary" size="lg" fullWidth onClick={() => { mutIniciar.mutate(viendoOT.id); setViendoOT(null); }}>Iniciar ejecución</Button>
            )}
            {!esJefe && viendoOT && ['aprobada', 'en_ejecucion'].includes(viendoOT.estado) && (
              <Button variant="primary" size="lg" fullWidth onClick={() => { setModalCompletar(viendoOT); setViendoOT(null); }}>Completar OT</Button>
            )}
            {esJefe && viendoOT?.estado === 'pendiente' && (
              <Button variant="primary" size="lg" fullWidth onClick={() => { mutAprobar.mutate(viendoOT.id); setViendoOT(null); }}>Aprobar</Button>
            )}
            {/* Acciones secundarias */}
            {viendoOT && ['aprobada', 'en_ejecucion', 'completada'].includes(viendoOT.estado) && (
              <Button variant="secondary" size="sm" onClick={() => { setImprimiendoOT(viendoOT); setViendoOT(null); }}>Imprimir</Button>
            )}
            {!esJefe && viendoOT && ['borrador', 'pendiente'].includes(viendoOT.estado) && (
              <Button variant="secondary" size="sm" onClick={() => { setViendoOT(null); abrirEditarOT(viendoOT); }}>Editar</Button>
            )}
            {/* Zona destructive separada */}
            {((!esJefe && viendoOT && ['borrador', 'pendiente'].includes(viendoOT.estado)) ||
              (esJefe && viendoOT?.estado === 'pendiente')) && (
              <div className="mc-danger-zone">
                {!esJefe && viendoOT && ['borrador', 'pendiente'].includes(viendoOT.estado) && (
                  <Button variant="danger" size="sm" fullWidth onClick={() => { mutCancelar.mutate(viendoOT.id); setViendoOT(null); }}>Cancelar OT</Button>
                )}
                {esJefe && viendoOT?.estado === 'pendiente' && (
                  <Button variant="danger" size="sm" fullWidth onClick={() => { setModalRechazar(viendoOT); setViendoOT(null); }}>Rechazar</Button>
                )}
              </div>
            )}
            <CancelButton onClick={() => setViendoOT(null)} label="Cerrar" />
          </div>
        }
      >
        {viendoOT && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 13 }}>

            {/* Badges de estado + prioridad + modalidad */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className={`mc-badge ${ESTADO_OT_BADGE[viendoOT.estado]}`}>
                {ESTADO_OT_LABEL[viendoOT.estado]}
              </span>
              {viendoOT.prioridad === 'urgente' && (
                <span className={`mc-badge ${PRIORIDAD_OT_BADGE[viendoOT.prioridad]}`}>
                  {PRIORIDAD_OT_LABEL[viendoOT.prioridad]}
                </span>
              )}
              <span className="mc-badge mc-badge-neutral">
                {MODALIDAD_OT_LABEL[viendoOT.modalidad]}
              </span>
            </div>

            {/* Alerta de vencimiento */}
            {otVencida(viendoOT, hoy) && (
              <div style={{
                background:   'var(--mc-ot-vencida-bg)',
                borderLeft:   '3px solid var(--mc-ot-vencida-border)',
                padding:      '8px 12px',
                borderRadius: '0 6px 6px 0',
                display:      'flex',
                alignItems:   'center',
                gap:           6,
              }}>
                <AlertTriangle size={14} style={{ color: 'var(--mc-ot-vencida-border)', flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: 12, color: 'var(--mc-color-danger)' }}>
                  Fecha estimada vencida — requiere atención
                </p>
              </div>
            )}

            {/* Motivo de rechazo */}
            {viendoOT.motivo_rechazo && (
              <div style={{
                background:   'var(--mc-ot-rechazo-bg)',
                borderLeft:   '3px solid var(--mc-color-danger)',
                padding:      '8px 12px',
                borderRadius: '0 6px 6px 0',
              }}>
                <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 600, color: 'var(--mc-color-danger)' }}>
                  Motivo de rechazo
                </p>
                <p style={{ margin: 0 }}>{viendoOT.motivo_rechazo}</p>
              </div>
            )}

            {/* ── Información general ──────────────────────────────────── */}
            <OTSeccion titulo="Información general">
              <OTCampo label="Tipo de trabajo"    valor={viendoOT.tipo_trabajo?.nombre ?? '—'} />
              <OTCampo label="Descripción"        valor={viendoOT.descripcion} />
              <OTCampo label="Área destino"       valor={viendoOT.area_destino} />
              <OTCampo label="Fecha estimada"     valor={viendoOT.fecha_estimada} />
              {viendoOT.tarea?.titulo && (
                <OTCampo label="Tarea vinculada"    valor={viendoOT.tarea.titulo} />
              )}
              {viendoOT.objetivo?.titulo && (
                <OTCampo label="Objetivo vinculado" valor={viendoOT.objetivo.titulo} />
              )}
            </OTSeccion>

            {/* ── Detalles técnicos (colapsable) ───────────────────────── */}
            <OTSeccionColapsable titulo="Detalles técnicos">
              <OTCampo label="Ubicación"          valor={viendoOT.ubicacion ?? '—'} />
              <OTCampo label="Hora inicio"        valor={viendoOT.hora_inicio_est ?? '—'} />
              <OTCampo label="Duración estimada"  valor={viendoOT.duracion_est_min ? `${viendoOT.duracion_est_min} min` : '—'} />
              <OTCampo label="Equipos/materiales" valor={viendoOT.equipos_materiales ?? '—'} />
              <OTCampo label="Observaciones"      valor={viendoOT.observaciones ?? '—'} />
            </OTSeccionColapsable>

            {/* ── Datos del receptor (solo completada) ─────────────────── */}
            {viendoOT.estado === 'completada' && (
              <OTSeccion titulo="Datos del receptor">
                <OTCampo label="Nombre" valor={viendoOT.receptor_nombre ?? '—'} />
                <OTCampo label="DNI"    valor={viendoOT.receptor_dni    ?? '—'} />
                <OTCampo label="Cargo"  valor={viendoOT.receptor_cargo  ?? '—'} />
              </OTSeccion>
            )}
          </div>
        )}
      </Modal>

      {/* ── Modal completar OT ─────────────────────────────────────────── */}
      <Modal
        open={modalCompletar !== null}
        onClose={() => setModalCompletar(null)}
        title="Completar orden de trabajo"
        size="sm"
        footer={
          <>
            <Button variant="primary" size="lg" fullWidth onClick={() => mutCompletar.mutate()} disabled={!canCompletar || mutCompletar.isPending}>
              {mutCompletar.isPending ? 'Guardando…' : 'Confirmar cierre'}
            </Button>
            <CancelButton onClick={() => setModalCompletar(null)} />
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

      {/* ── Modal rechazar OT ──────────────────────────────────────────── */}
      <Modal
        open={modalRechazar !== null}
        onClose={() => { setModalRechazar(null); setMotivoRechazo(''); }}
        title="Rechazar orden de trabajo"
        size="sm"
        footer={
          <>
            <Button
              variant="danger" size="lg" fullWidth
              disabled={motivoRechazo.trim().length < MIN_JUSTIFICACION_CHARS || mutRechazar.isPending}
              onClick={() => modalRechazar && mutRechazar.mutate({ otId: modalRechazar.id, motivo: motivoRechazo })}
            >
              {mutRechazar.isPending ? 'Guardando…' : 'Rechazar orden'}
            </Button>
            <CancelButton onClick={() => { setModalRechazar(null); setMotivoRechazo(''); }} />
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--mc-color-text-secondary)' }}>
            {modalRechazar?.numero} — Indica el motivo (mínimo {MIN_JUSTIFICACION_CHARS} caracteres).
          </p>
          <JustificacionField
            label="Motivo"
            value={motivoRechazo}
            onChange={setMotivoRechazo}
            placeholder="Describe el motivo del rechazo…"
            disabled={mutRechazar.isPending}
            autoFocus
          />
        </div>
      </Modal>

      {/* ── Formulario crear/editar OT ─────────────────────────────────── */}
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

      {/* ── Documento impresión ────────────────────────────────────────── */}
      {imprimiendoOT && (
        <OTImpresion ot={imprimiendoOT} onClose={() => setImprimiendoOT(null)} />
      )}
    </div>
  );
}