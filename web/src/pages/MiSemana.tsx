import { lazy, Suspense, useEffect, useMemo, useState } from 'react';

import type { OrdenTrabajo } from '@/api/ordenTrabajo';
import { MiSemanaResumenDia } from '@/components/semana/MiSemanaResumenDia';
import { ModalDetalleTareaSemana } from '@/components/semana/ModalDetalleTareaSemana';
import { ModalMiSemana } from '@/components/semana/ModalMiSemana';
import { Modal } from '@/components/ui/Modal';
import { ESTADO_OT_LABEL } from '@/lib/otConfig';
import { ModalBloquear } from '@/components/tareas/ModalBloquear';
import { ModalCompletarTarea } from '@/components/tareas/ModalCompletarTarea';
import { ModalReprogramar } from '@/components/tareas/ModalReprogramar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ModalNuevaTarea } from '@/components/tareas/ModalNuevaTarea';
import { useMiSemanaPage } from '@/hooks/useMiSemanaPage';
import { fechaLocalDdMmYyyy, fechaLocalYmd } from '@/lib/fecha';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { Calendar, ChevronLeft, ChevronRight, EyeOff, StickyNote } from 'lucide-react';
import { agregarDias } from '@/lib/semanas';

const MiSemanaGrillaDnD = lazy(() =>
  import('@/components/semana/MiSemanaGrillaDnD').then((m) => ({ default: m.MiSemanaGrillaDnD })),
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const DIAS_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const CONTEO_CONFIG = [
  { key: 'pendiente',    label: 'Pendientes'    },
  { key: 'en_progreso',  label: 'En progreso'   },
  { key: 'atrasada',     label: 'Atrasadas'     },
  { key: 'reprogramada', label: 'Reprogramadas' },
  { key: 'completada',   label: 'Completadas'   },
] as const;

type FiltroEstado = typeof CONTEO_CONFIG[number]['key'];

// ---------------------------------------------------------------------------
export function MiSemana() {
  const {
    usuario, esJefe,
    lunes, setLunes, sabado, diasSemana,
    uid, setSeleccionId, usuariosJefe,
    tareasPlan, eventos, isError, hoyYmd, conteos,
    esBannerViernes,
    incidenciasSemana, notasHoy,
    ordenesPorTarea, nombresPorId, resumenDia,
    ocultarCompletadas, toggleOcultarCompletadas,
    modalInc, setModalInc,
    notaRapida, setNotaRapida,
    crearIncidenciaHoy, guardarNotaRapida,
    objetivosActivos, usuariosAsignables,
    tareaDetalle, tareaCompletar, activeTareaDrag,
    activeDragId, setActiveDragId, overId,
    onDragOver, onDragEnd,
    modal,              setModal,
    detalleTareaId,     setDetalleTareaId,
    completarTareaId,   setCompletarTareaId,
    bloquearTareaState, setBloquearTareaState,
    reprDetalleTarea,   setReprDetalleTarea,
    reprDragTarea,      setReprDragTarea,
    puedeGestionar,
    confirmarReprDrag, confirmarReprDetalle, confirmarBloqueo,
    confirmarCompletar, crearTareaDesdeModal, crearEventoDesdeModal,
    guardarDetalle, eliminarDesdeDetalle, iniciarDesdeDetalle,
  } = useMiSemanaPage();

  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado | null>(null);
  const [notasDrawerOpen, setNotasDrawerOpen] = useState(false);
  const [otViendo, setOtViendo] = useState<OrdenTrabajo | null>(null);
  /** Vista móvil: un día a la vez; al cambiar de semana se prioriza hoy si cae en la semana. */
  const [diaMobileYmd, setDiaMobileYmd] = useState(hoyYmd);

  useEffect(() => {
    const ids = diasSemana.map((d) => fechaLocalYmd(d));
    if (ids.includes(hoyYmd)) setDiaMobileYmd(hoyYmd);
    else setDiaMobileYmd(ids[0] ?? hoyYmd);
  }, [lunes, hoyYmd, diasSemana]);

  const tituloObjetivoPorId = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of objetivosActivos) m.set(o.id, o.titulo);
    return m;
  }, [objetivosActivos]);

  function toggleFiltro(key: FiltroEstado) {
    setFiltroEstado((prev) => (prev === key ? null : key));
  }

  if (!usuario) return null;
  if (!uid) return <p className="text-sm text-[var(--mc-color-text-secondary)]">Preparando vista…</p>;

  return (
    <div className={APP_PAGE_CLASS}>

      {/* ── Cabecera módulo ─────────────────────────────────────────────── */}
      <header className="flex flex-col gap-4">
        {/* Móvil: título + CTA, fila de semana, pills de día */}
        <div className="flex flex-col gap-3 md:hidden">
          <div className="flex items-start justify-between gap-3">
            <h1 className="m-0 text-[20px] font-medium leading-tight text-[var(--mc-color-text)]">
              Mi semana
            </h1>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="primary" size="sm" onClick={() => setModal({ fecha: hoyYmd })}>
                + Nueva tarea
              </Button>
              <button
                type="button"
                className="mc-btn-secondary mc-btn-sm inline-flex items-center gap-1.5"
                onClick={toggleOcultarCompletadas}
                aria-pressed={ocultarCompletadas}
                title={ocultarCompletadas ? 'Mostrar completadas' : 'Ocultar completadas'}
              >
                <EyeOff size={14} aria-hidden />
              </button>
              <button
                type="button"
                className="mc-btn-secondary mc-btn-sm inline-flex items-center gap-1.5"
                onClick={() => setNotasDrawerOpen(true)}
                aria-expanded={notasDrawerOpen}
                aria-controls="mc-misemana-notas-drawer"
              >
                <StickyNote size={14} aria-hidden />
                Notas
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className="mc-nav-arrow-btn inline-flex items-center justify-center"
              onClick={() => setLunes((d) => agregarDias(d, -7))}
              aria-label="Semana anterior"
            >
              <ChevronLeft size={18} strokeWidth={2} aria-hidden />
            </button>
            <span className="min-w-0 flex-1 text-center text-sm text-[var(--mc-color-text-secondary)]">
              {fechaLocalDdMmYyyy(lunes)} – {fechaLocalDdMmYyyy(sabado)}
            </span>
            <button
              type="button"
              className="mc-nav-arrow-btn inline-flex items-center justify-center"
              onClick={() => setLunes((d) => agregarDias(d, 7))}
              aria-label="Semana siguiente"
            >
              <ChevronRight size={18} strokeWidth={2} aria-hidden />
            </button>
          </div>
          <div
            className="flex touch-pan-x gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="group"
            aria-label="Elegir día de la semana"
          >
            {diasSemana.map((d, i) => {
              const ymd = fechaLocalYmd(d);
              const esHoy = ymd === hoyYmd;
              const esActivo = ymd === diaMobileYmd;
              return (
                <button
                  key={ymd}
                  type="button"
                  aria-pressed={esActivo}
                  onClick={() => setDiaMobileYmd(ymd)}
                  className={[
                    'shrink-0 rounded-[var(--mc-radius-md)] px-3 py-1.5 text-xs font-medium transition-colors',
                    esActivo
                      ? 'bg-[var(--mc-color-accent)] text-white'
                      : 'bg-[var(--mc-color-bg-secondary)] text-[var(--mc-color-text-secondary)]',
                    esHoy && !esActivo
                      ? 'ring-1 ring-[var(--mc-color-accent)] ring-offset-1 ring-offset-[var(--mc-color-bg)]'
                      : '',
                  ].join(' ')}
                >
                  {DIAS_CORTO[i]}
                  {esHoy ? <span className="ml-1 text-[9px] opacity-80">· hoy</span> : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* Desktop / tablet: cabecera en una franja */}
        <div className="hidden flex-wrap items-start justify-between gap-4 md:flex">
          <h1 className="text-[20px] font-medium leading-tight text-[var(--mc-color-text)] m-0">
            Mi semana
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <div className="mc-nav-arrows flex items-center gap-1">
              <button type="button" className="mc-nav-arrow-btn" onClick={() => setLunes((d) => agregarDias(d, -7))} aria-label="Semana anterior">‹</button>
              <button type="button" className="mc-nav-arrow-btn" onClick={() => setLunes((d) => agregarDias(d, 7))} aria-label="Semana siguiente">›</button>
            </div>
            <span className="text-sm text-[var(--mc-color-text-secondary)] whitespace-nowrap">
              {fechaLocalDdMmYyyy(lunes)} – {fechaLocalDdMmYyyy(sabado)}
            </span>
            <Button variant="primary" onClick={() => setModal({ fecha: hoyYmd })}>
              + Nueva tarea
            </Button>
            <button
              type="button"
              className="mc-btn-secondary mc-btn-sm inline-flex items-center gap-1.5"
              onClick={toggleOcultarCompletadas}
              aria-pressed={ocultarCompletadas}
              title={ocultarCompletadas ? 'Mostrar completadas' : 'Ocultar completadas'}
            >
              <EyeOff size={14} aria-hidden />
              {ocultarCompletadas ? 'Mostrar completadas' : 'Ocultar completadas'}
            </button>
            <button
              type="button"
              className="mc-btn-secondary mc-btn-sm inline-flex items-center gap-1.5"
              onClick={() => setNotasDrawerOpen(true)}
              aria-expanded={notasDrawerOpen}
              aria-controls="mc-misemana-notas-drawer"
            >
              <StickyNote size={14} aria-hidden />
              Notas
            </button>
          </div>
        </div>
        {esJefe && usuariosJefe && usuariosJefe.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[var(--mc-color-text-secondary)]">Ver semana de</span>
            <select
              aria-label="Ver semana de"
              className="mc-input !w-auto min-w-[180px]"
              value={uid}
              onChange={(e) => setSeleccionId(e.target.value)}
            >
              {usuariosJefe.map((u) => (
                <option key={u.id} value={u.id}>{u.nombre}</option>
              ))}
            </select>
          </div>
        )}
      </header>

      <MiSemanaResumenDia
        pendientesHoy={resumenDia.pendientesHoy}
        atrasadas={resumenDia.atrasadas}
        bloqueadas={resumenDia.bloqueadas}
      />

      {/* Banner viernes */}
      {esBannerViernes && (
        <div className="flex items-center gap-3 rounded-lg border border-[var(--mc-color-accent)] bg-[color-mix(in_srgb,var(--mc-color-accent)_8%,transparent)] px-4 py-3">
          <Calendar size={18} aria-hidden className="text-[var(--mc-color-accent)] flex-shrink-0" />
          <p className="text-sm font-medium text-[var(--mc-color-accent)]">
            ¡Es viernes! Buen momento para planificar la próxima semana.
          </p>
          <Button variant="secondary" size="sm" className="ml-auto" onClick={() => setLunes((d) => agregarDias(d, 7))}>
            Ver próxima semana
          </Button>
        </div>
      )}

      {isError && <p className="text-sm text-[var(--mc-color-danger)]">Error al cargar datos.</p>}

      {/* ── Resumen por estado (cards compactas) ─────────────────────────── */}
      <div className="flex flex-wrap items-stretch gap-3">
        {CONTEO_CONFIG.map(({ key, label }) => {
          const n        = conteos[key] ?? 0;
          const disabled = n === 0 && filtroEstado !== key;
          const active   = filtroEstado === key;
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={disabled ? undefined : () => toggleFiltro(key)}
              className={[
                'flex min-w-[100px] flex-1 flex-col justify-center rounded-lg border border-[var(--mc-color-border)]',
                'bg-[var(--mc-color-bg-secondary)] px-3 py-3 text-left transition-colors',
                active ? 'border-[var(--mc-brand-violet)] ring-1 ring-[var(--mc-brand-violet-soft)]' : '',
                disabled ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer hover:border-[var(--mc-color-border-hover)]',
              ].join(' ')}
            >
              <span className="text-[22px] font-semibold leading-none tabular-nums text-[var(--mc-color-text)]">{n}</span>
              <span className="mt-1 text-[11px] font-medium text-[var(--mc-color-text-secondary)]">{label}</span>
            </button>
          );
        })}
        {filtroEstado && (
          <Button
            variant="quaternary"
            size="sm"
            onClick={() => setFiltroEstado(null)}
            aria-label="Limpiar filtro"
          >
            Limpiar filtro
          </Button>
        )}
      </div>
      {filtroEstado && (
        <p className="text-xs text-[var(--mc-color-text-secondary)]" role="status" aria-live="polite">
          Mostrando solo tareas <strong className="text-[var(--mc-color-text)]">{CONTEO_CONFIG.find((c) => c.key === filtroEstado)?.label.toLowerCase()}</strong>. Los eventos siguen visibles.
        </p>
      )}

      {/* ── Grilla semanal (chunk @dnd-kit) ─────────────────────────────── */}
      <Suspense
        fallback={
          <div className="mc-page-loading min-h-[220px]" role="status">
            Cargando agenda…
          </div>
        }
      >
        <MiSemanaGrillaDnD
          diasSemana={diasSemana}
          hoyYmd={hoyYmd}
          diaMobileYmd={diaMobileYmd}
          tareasPlan={tareasPlan}
          eventos={eventos}
          filtroEstado={filtroEstado}
          tituloObjetivoPorId={tituloObjetivoPorId}
          incidenciasSemana={incidenciasSemana}
          nombresPorId={nombresPorId}
          ordenesPorTarea={ordenesPorTarea}
          ocultarCompletadas={ocultarCompletadas}
          activeDragId={activeDragId}
          setActiveDragId={setActiveDragId}
          overId={overId}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          activeTareaDrag={activeTareaDrag}
          puedeGestionar={puedeGestionar}
          onAbrirModalDia={(fecha) => setModal({ fecha })}
          onAbrirDetalle={setDetalleTareaId}
          onRegistrarIncidencia={() => setModalInc(true)}
          onOtClick={setOtViendo}
        />
      </Suspense>
      {notasDrawerOpen && (
        <>
          <div
            className="mc-drawer-overlay"
            onClick={() => setNotasDrawerOpen(false)}
            aria-hidden
          />
          <aside
            id="mc-misemana-notas-drawer"
            className="mc-drawer-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Notas del día"
          >
            <div className="mc-drawer-panel-header">
              <h2 className="mc-drawer-panel-title">Notas</h2>
              <button
                type="button"
                className="mc-modal-close"
                onClick={() => setNotasDrawerOpen(false)}
                aria-label="Cerrar panel de notas"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="mc-drawer-panel-body">
              {notasHoy.length === 0 ? (
                <EmptyState compact title="Sin notas" />
              ) : (
                <div className="flex flex-col gap-1">
                  {notasHoy.slice(0, 20).map((n) => (
                    <div
                      key={n.id}
                      className="rounded border border-[var(--mc-color-border)] bg-[var(--mc-color-bg-secondary)] px-2 py-1.5 text-[11px] text-[var(--mc-color-text)]"
                    >
                      {n.contenido.length > 200 ? `${n.contenido.slice(0, 200)}…` : n.contenido}
                    </div>
                  ))}
                </div>
              )}
              <textarea
                rows={3}
                className="mc-input resize-none text-xs"
                placeholder="Nota rápida…"
                value={notaRapida}
                onChange={(e) => setNotaRapida(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) guardarNotaRapida();
                }}
              />
              <Button variant="secondary" size="sm" onClick={guardarNotaRapida} disabled={!notaRapida.trim()}>
                Guardar nota
              </Button>
            </div>
          </aside>
        </>
      )}

      {/* ── Modales ────────────────────────────────────────────────────────── */}
      <ModalMiSemana
        open={modal !== null}
        modoOrigen="dia"
        {...(modal?.fecha ? { fechaDia: modal.fecha } : {})}
        objetivos={objetivosActivos}
        usuariosAsignables={usuariosAsignables}
        asignadoPorDefectoId={uid}
        onClose={() => setModal(null)}
        onCrearTarea={crearTareaDesdeModal}
        onCrearEvento={crearEventoDesdeModal}
      />
      <ModalNuevaTarea
        open={modalInc}
        modo="incidencia"
        fechaReferencia={hoyYmd}
        usuarioActualId={uid ?? ''}
        usuariosAsignables={usuariosAsignables}
        objetivos={objetivosActivos}
        onClose={() => setModalInc(false)}
        onSubmit={async (input) => {
          await crearIncidenciaHoy({
            titulo:              input.titulo,
            prioridad:           input.prioridad,
            descripcion:         input.descripcion || null,
            asignado_a:          input.asignado_a,
            fecha_planificada:   input.fecha_planificada ?? hoyYmd,
            ya_resuelta:         true,
          });
        }}
      />
      <ModalCompletarTarea
        open={completarTareaId !== null}
        tarea={tareaCompletar}
        onClose={() => setCompletarTareaId(null)}
        onConfirm={confirmarCompletar}
      />
      <ModalBloquear
        tarea={bloquearTareaState}
        onClose={() => setBloquearTareaState(null)}
        onConfirm={confirmarBloqueo}
      />
      <ModalReprogramar
        tarea={reprDragTarea?.tarea ?? null}
        {...(reprDragTarea?.fecha ? { fechaFija: reprDragTarea.fecha } : {})}
        onClose={() => setReprDragTarea(null)}
        onConfirm={confirmarReprDrag}
      />
      <ModalReprogramar
        tarea={reprDetalleTarea}
        onClose={() => setReprDetalleTarea(null)}
        onConfirm={confirmarReprDetalle}
      />
      <Modal
        open={otViendo !== null}
        onClose={() => setOtViendo(null)}
        title={otViendo ? `OT ${otViendo.numero}` : ''}
        analyticsId="modal-ot-resumen-semana"
        size="sm"
        footer={(
          <Button variant="ghost" onClick={() => setOtViendo(null)}>Cerrar</Button>
        )}
      >
        {otViendo && (
          <p className="text-sm text-[var(--mc-color-text)]">
            Estado: <strong>{ESTADO_OT_LABEL[otViendo.estado]}</strong>
          </p>
        )}
      </Modal>

      <ModalDetalleTareaSemana
        open={detalleTareaId !== null}
        tarea={tareaDetalle}
        objetivos={objetivosActivos}
        usuariosAsignables={usuariosAsignables}
        readOnly={Boolean(tareaDetalle && !esJefe && tareaDetalle.asignado_a !== usuario.id)}
        onClose={() => setDetalleTareaId(null)}
        onGuardar={guardarDetalle}
        onEliminar={eliminarDesdeDetalle}
        onIniciar={iniciarDesdeDetalle}
        onCompletar={(t) => { setCompletarTareaId(t.id); setDetalleTareaId(null); }}
        onReprogramar={(t) => { setReprDetalleTarea(t); setDetalleTareaId(null); }}
        onBloquear={(t) => { setBloquearTareaState(t); setDetalleTareaId(null); }}
      />
    </div>
  );
}