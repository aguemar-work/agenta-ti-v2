/**
 * pages/OrdenesTrabajo.tsx
 * Lista de OTs + panel contextual al seleccionar + tipos (jefe).
 */

import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { MIN_JUSTIFICACION_CHARS } from '@/lib/constants';

import { markModalCompleted, Modal } from '@/components/ui/Modal';
import { Button, CancelButton } from '@/components/ui/Button';
import { JustificacionField } from '@/components/ui/JustificacionField';
import { ModalTiposOT } from '@/components/ot/ModalTiposOT';
import { OTFormModal } from '@/components/ot/OTFormModal';
import { OTDetalleSidebar } from '@/components/ot/OTDetalleSidebar';
import { OTDetalleMobile } from '@/components/ot/OTDetalleMobile';
import { OTHeader } from '@/components/ot/OTHeader';
import { OTToolbar } from '@/components/ot/OTToolbar';
import { OTTablaFila, OT_TABLA_GRID_COLS } from '@/components/ot/OTTablaFila';
import { OTListaMobileItem } from '@/components/ot/OTListaMobileItem';

const OTImpresion = lazy(() =>
  import('@/components/ot/OTImpresion').then((m) => ({ default: m.OTImpresion })),
);
import { useOrdenesTrabajoPage } from '@/hooks/useOrdenesTrabajoPage';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { EmptyState } from '@/components/ui/EmptyState';
import { fechaLocalYmd } from '@/lib/fecha';
import { buildOTDetalleAcciones } from '@/lib/otDetalleAcciones';
import type { FiltroEstadoOT } from '@/hooks/useOrdenesTrabajoPage';
import type { EstadoOT, OrdenTrabajo } from '@/api/ordenTrabajo';

const FILTROS_PRINCIPALES: { value: FiltroEstadoOT; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'activas', label: 'Activas' },
  { value: 'completadas', label: 'Completadas' },
];

const FILTROS_ESPECIFICOS: { value: EstadoOT; label: string }[] = [
  { value: 'borrador', label: 'Borrador' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'aprobada', label: 'Aprobada' },
  { value: 'en_ejecucion', label: 'En ejecución' },
  { value: 'rechazada', label: 'Rechazada' },
  { value: 'cancelada', label: 'Cancelada' },
];

const FILTRO_LABELS: Record<FiltroEstadoOT, string> = {
  todos: 'todos',
  activas: 'activas',
  completadas: 'completadas',
  urgentes: 'urgentes',
  vencidas: 'vencidas',
  borrador: 'borrador',
  pendiente: 'pendientes',
  aprobada: 'aprobadas',
  en_ejecucion: 'en ejecución',
  completada: 'completadas',
  rechazada: 'rechazadas',
  cancelada: 'canceladas',
};

type StatFiltroKey = 'activas' | 'pendientes' | 'urgentes' | 'vencidas';

const STAT_TO_FILTRO: Record<StatFiltroKey, FiltroEstadoOT> = {
  activas: 'activas',
  pendientes: 'pendiente',
  urgentes: 'urgentes',
  vencidas: 'vencidas',
};

export function OrdenesTrabajo() {
  const [modalTiposOpen, setModalTiposOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const {
    usuario,
    esJefe,
    ordenes,
    isLoading,
    isError,
    pendientesCount,
    resumenOT,
    tiposActivos,
    tiposInactivos,
    filtroEstado,
    setFiltroEstado,
    modalForm,
    editandoOT,
    borradorCargando,
    draftSaveStatus,
    draftSavedLabel,
    hasUnsavedChanges,
    cerrarFormularioOT,
    viendoOT,
    setViendoOT,
    imprimiendoOT,
    setImprimiendoOT,
    modalCompletar,
    setModalCompletar,
    modalRechazar,
    setModalRechazar,
    motivoRechazo,
    setMotivoRechazo,
    receptorNombre,
    setReceptorNombre,
    receptorDni,
    setReceptorDni,
    receptorCargo,
    setReceptorCargo,
    obsCierre,
    setObsCierre,
    canCompletar,
    nuevoTipoNombre,
    setNuevoTipoNombre,
    canCrearTipo,
    abrirNuevaOT,
    abrirEditarOT,
    form,
    setForm,
    tiposTrabajo,
    tareasVinculables,
    mutCrear,
    mutActualizar,
    mutAprobar,
    mutRechazar,
    mutIniciar,
    mutCompletar,
    mutCancelar,
    mutCrearTipo,
    mutToggleTipo,
  } = useOrdenesTrabajoPage();

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const fn = () => setIsMobile(mq.matches);
    fn();
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  useEffect(() => {
    if (!viendoOT) return;
    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') setViendoOT(null);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [viendoOT, setViendoOT]);

  const hoy = fechaLocalYmd(new Date());

  const otActiva = useMemo(() => {
    if (!viendoOT) return null;
    return ordenes.find((o) => o.id === viendoOT.id) ?? viendoOT;
  }, [viendoOT, ordenes]);

  const handlersDetalle = useMemo(
    () => ({
      onAprobar: (id: string) => mutAprobar.mutate(id),
      onRechazar: (ot: OrdenTrabajo) => setModalRechazar(ot),
      onIniciar: (id: string) => {
        mutIniciar.mutate(id);
        setViendoOT(null);
      },
      onCompletar: (ot: OrdenTrabajo) => setModalCompletar(ot),
      onEditar: (ot: OrdenTrabajo) => {
        setViendoOT(null);
        abrirEditarOT(ot);
      },
      onCancelar: (id: string) => {
        mutCancelar.mutate(id);
        setViendoOT(null);
      },
      onImprimir: (ot: OrdenTrabajo) => setImprimiendoOT(ot),
      aprobarPending: mutAprobar.isPending,
    }),
    [mutAprobar, mutIniciar, mutCancelar, setModalRechazar, setModalCompletar, setViendoOT, abrirEditarOT, setImprimiendoOT],
  );

  const accionesDetalle = useMemo(
    () => (otActiva ? buildOTDetalleAcciones(otActiva, esJefe, usuario?.id, handlersDetalle) : null),
    [otActiva, esJefe, usuario?.id, handlersDetalle],
  );

  const toggleOT = useCallback(
    (ot: OrdenTrabajo) => setViendoOT(viendoOT?.id === ot.id ? null : ot),
    [viendoOT, setViendoOT],
  );

  const toggleStatFiltro = useCallback(
    (key: StatFiltroKey) => {
      const next = STAT_TO_FILTRO[key];
      setFiltroEstado(filtroEstado === next ? 'todos' : next);
    },
    [filtroEstado, setFiltroEstado],
  );

  const statsItems = useMemo(() => {
    const defs: { key: StatFiltroKey; label: string; value: number }[] = [
      { key: 'activas', label: 'Activas', value: resumenOT.activas },
      ...(esJefe ? [{ key: 'pendientes' as const, label: 'Pendientes', value: resumenOT.pendientes }] : []),
      { key: 'urgentes', label: 'Urgentes', value: resumenOT.urgentes },
      { key: 'vencidas', label: 'Vencidas', value: resumenOT.vencidas },
    ];
    return defs.map(({ key, label, value }) => {
      const filtroKey = STAT_TO_FILTRO[key];
      const disabled = value === 0 && filtroEstado !== filtroKey;
      const active = filtroEstado === filtroKey;
      return {
        key,
        label,
        value,
        active,
        disabled,
        onClick: disabled ? undefined : () => toggleStatFiltro(key),
      };
    });
  }, [resumenOT, esJefe, filtroEstado, toggleStatFiltro]);

  const filtroActivoLabel = filtroEstado !== 'todos' ? FILTRO_LABELS[filtroEstado] : null;

  const subtitulo = useMemo(() => {
    if (!esJefe) return 'Mis órdenes de trabajo';
    const partes = [
      pendientesCount > 0 && `${pendientesCount} pendiente${pendientesCount !== 1 ? 's' : ''}`,
      resumenOT.urgentes > 0 && `${resumenOT.urgentes} urgente${resumenOT.urgentes !== 1 ? 's' : ''}`,
      resumenOT.vencidas > 0 && `${resumenOT.vencidas} vencida${resumenOT.vencidas !== 1 ? 's' : ''}`,
    ].filter(Boolean);
    return partes.length > 0 ? partes.join(' · ') : 'Aprobación, ejecución y cierre formal';
  }, [esJefe, pendientesCount, resumenOT]);

  if (!usuario) return null;

  const showSidebar = Boolean(otActiva && accionesDetalle && !isMobile);

  const pillOptions = FILTROS_PRINCIPALES.map(({ value, label }) => ({
    value,
    label,
    ...(value === 'activas' && pendientesCount > 0 ? { badge: pendientesCount } : {}),
  }));

  const filtroEspecificoValue = FILTROS_ESPECIFICOS.some((f) => f.value === filtroEstado) ? filtroEstado : '';

  return (
    <div className={`${APP_PAGE_CLASS} mc-ot-page`}>
      <OTHeader
        subtitulo={subtitulo}
        esJefe={esJefe}
        onNuevaOT={abrirNuevaOT}
        {...(esJefe ? { onTiposTrabajo: () => setModalTiposOpen(true) } : {})}
      />

      <OTToolbar
        statsItems={statsItems}
        filtroActivoLabel={filtroActivoLabel}
        onLimpiarFiltro={() => setFiltroEstado('todos')}
        filtroPillsValue={FILTROS_PRINCIPALES.some((f) => f.value === filtroEstado) ? filtroEstado : 'todos'}
        onFiltroPillsChange={setFiltroEstado}
        pillOptions={pillOptions}
        filtroEspecificoValue={filtroEspecificoValue}
        onFiltroEspecificoChange={(v) => setFiltroEstado((v || 'todos') as FiltroEstadoOT)}
        estadosEspecificos={FILTROS_ESPECIFICOS}
        estadoFlujoDestacado={otActiva?.estado ?? null}
      />

      {isError && (
        <p className="m-0 text-[13px] text-[var(--mc-color-danger)]">
          No se pudieron cargar las órdenes de trabajo.
        </p>
      )}

      <div className={['mc-ot-layout', showSidebar ? 'mc-ot-layout--split' : ''].filter(Boolean).join(' ')}>
        <div className="mc-ot-layout__main">
          <div className="mc-card !p-0 overflow-hidden">
            {!isMobile && (
              <div className="mc-ot-table-head" style={{ gridTemplateColumns: OT_TABLA_GRID_COLS }}>
                {['Número', 'Descripción', 'Fecha'].map((h) => (
                  <span key={h} className="mc-ot-table-head__cell">
                    {h}
                  </span>
                ))}
              </div>
            )}

            {isLoading ? (
              <p className="p-4 text-[13px] text-[var(--mc-color-text-secondary)]">Cargando…</p>
            ) : ordenes.length === 0 ? (
              <EmptyState
                icon={ClipboardCheck}
                title={filtroEstado !== 'todos' ? 'Sin resultados' : 'Sin órdenes de trabajo'}
                desc={
                  filtroEstado !== 'todos'
                    ? 'Prueba otro filtro o limpia la selección.'
                    : 'Crea una nueva OT para registrar un trabajo.'
                }
              />
            ) : isMobile ? (
              <div className="mc-ot-mobile-list">
                {ordenes.map((ot) => (
                  <OTListaMobileItem
                    key={ot.id}
                    ot={ot}
                    hoy={hoy}
                    selected={viendoOT?.id === ot.id}
                    onSelect={() => toggleOT(ot)}
                  />
                ))}
              </div>
            ) : (
              ordenes.map((ot) => (
                <OTTablaFila
                  key={ot.id}
                  ot={ot}
                  hoy={hoy}
                  selected={viendoOT?.id === ot.id}
                  onSelect={() => toggleOT(ot)}
                />
              ))
            )}
          </div>
        </div>

        {showSidebar && otActiva && accionesDetalle && (
          <OTDetalleSidebar ot={otActiva} hoy={hoy} acciones={accionesDetalle} onClose={() => setViendoOT(null)} />
        )}
      </div>

      {isMobile && otActiva && accionesDetalle && (
        <OTDetalleMobile ot={otActiva} hoy={hoy} acciones={accionesDetalle} onClose={() => setViendoOT(null)} />
      )}

      <ModalTiposOT
        open={modalTiposOpen}
        tiposActivos={tiposActivos}
        tiposInactivos={tiposInactivos}
        nuevoTipoNombre={nuevoTipoNombre}
        setNuevoTipoNombre={setNuevoTipoNombre}
        canCrearTipo={canCrearTipo}
        onClose={() => setModalTiposOpen(false)}
        onCrear={() => mutCrearTipo.mutate()}
        onToggle={(input) => mutToggleTipo.mutate(input)}
        isPendingToggle={mutToggleTipo.isPending}
        isPendingCrear={mutCrearTipo.isPending}
      />

      <Modal
        open={modalCompletar !== null}
        onClose={() => setModalCompletar(null)}
        stackLevel={1}
        title="Completar orden de trabajo"
        analyticsId="modal-ot-completar"
        descriptionElementId="modal-ot-completar-desc"
        size="sm"
        footer={
          <>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => mutCompletar.mutate(undefined, { onSuccess: () => markModalCompleted('modal-ot-completar') })}
              disabled={!canCompletar || mutCompletar.isPending}
            >
              {mutCompletar.isPending ? 'Guardando…' : 'Confirmar cierre'}
            </Button>
            <CancelButton onClick={() => setModalCompletar(null)} />
          </>
        }
      >
        <div className="flex flex-col gap-[14px]">
          <p id="modal-ot-completar-desc" className="m-0 text-[13px] text-[var(--mc-color-text-secondary)]">
            Ingresa los datos del responsable que recibe el trabajo.
          </p>
          {[
            { label: 'Nombre del receptor', value: receptorNombre, set: setReceptorNombre, placeholder: 'Nombre completo', optional: false },
            { label: 'DNI', value: receptorDni, set: setReceptorDni, placeholder: '12345678', optional: false },
            { label: 'Cargo (opcional)', value: receptorCargo, set: setReceptorCargo, placeholder: 'Jefe de área, etc.', optional: true },
          ].map(({ label, value, set, placeholder, optional }) => (
            <label key={label} className="mc-field">
              <span className="mc-field-label">{label}</span>
              <input
                className="mc-input"
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder={placeholder}
                required={!optional}
              />
            </label>
          ))}
          <label className="mc-field">
            <span className="mc-field-label">Observaciones de cierre (opcional)</span>
            <textarea className="mc-input" style={{ minHeight: 72 }} value={obsCierre} onChange={(e) => setObsCierre(e.target.value)} />
          </label>
        </div>
      </Modal>

      <Modal
        open={modalRechazar !== null}
        onClose={() => {
          setModalRechazar(null);
          setMotivoRechazo('');
        }}
        stackLevel={1}
        title="Rechazar orden de trabajo"
        analyticsId="modal-ot-rechazar"
        descriptionElementId="modal-ot-rechazar-desc"
        size="sm"
        footer={
          <>
            <Button
              variant="danger"
              size="lg"
              fullWidth
              disabled={motivoRechazo.trim().length < MIN_JUSTIFICACION_CHARS || mutRechazar.isPending}
              onClick={() =>
                modalRechazar &&
                mutRechazar.mutate(
                  { otId: modalRechazar.id, motivo: motivoRechazo },
                  { onSuccess: () => markModalCompleted('modal-ot-rechazar') },
                )
              }
            >
              {mutRechazar.isPending ? 'Guardando…' : 'Rechazar orden'}
            </Button>
            <CancelButton
              onClick={() => {
                setModalRechazar(null);
                setMotivoRechazo('');
              }}
            />
          </>
        }
      >
        <div className="flex flex-col gap-[14px]">
          <p id="modal-ot-rechazar-desc" className="m-0 text-[13px] text-[var(--mc-color-text-secondary)]">
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

      {modalForm && (
        <OTFormModal
          open={modalForm}
          editando={editandoOT}
          form={form}
          setForm={setForm}
          tiposTrabajo={tiposTrabajo}
          onClose={cerrarFormularioOT}
          tareasVinculables={tareasVinculables}
          onGuardar={() => (editandoOT ? mutActualizar.mutate() : mutCrear.mutate())}
          busy={mutCrear.isPending || mutActualizar.isPending}
          hasUnsavedChanges={hasUnsavedChanges}
          borradorCargando={borradorCargando}
          draftSaveStatus={draftSaveStatus}
          draftSavedLabel={draftSavedLabel}
        />
      )}

      {imprimiendoOT && (
        <Suspense fallback={null}>
          <OTImpresion ot={imprimiendoOT} onClose={() => setImprimiendoOT(null)} />
        </Suspense>
      )}
    </div>
  );
}
