import {
  closestCorners,
  DndContext,
  type CollisionDetection,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core';

import { DraggableTareaSemana } from '@/components/semana/DraggableTareaSemana';
import { EventoCard } from '@/components/semana/EventoCard';
import { ModalDetalleTareaSemana } from '@/components/semana/ModalDetalleTareaSemana';
import { ModalMiSemana } from '@/components/semana/ModalMiSemana';
import { SemanaDiaDrop } from '@/components/semana/SemanaDiaDrop';
import { ModalBloquear } from '@/components/tareas/ModalBloquear';
import { ModalCompletarTarea } from '@/components/tareas/ModalCompletarTarea';
import { ModalReprogramar } from '@/components/tareas/ModalReprogramar';
import { TaskItem } from '@/components/tareas/TaskItem';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ModalNuevaTarea } from '@/components/tareas/ModalNuevaTarea';
import { useMiSemanaPage } from '@/hooks/useMiSemanaPage';
import { fechaLocalDdMmYyyy, fechaLocalYmd } from '@/lib/fecha';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { Calendar, StickyNote } from 'lucide-react';
import { agregarDias } from '@/lib/semanas';
import type { Evento, Tarea } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const DIAS_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

type NivelCarga = 'baja' | 'media' | 'alta';
function nivelCarga(n: number): NivelCarga {
  if (n <= 2) return 'baja';
  if (n <= 4) return 'media';
  return 'alta';
}
const CARGA_CONFIG: Record<NivelCarga, { color: string; label: string }> = {
  baja:  { color: 'var(--mc-color-success)', label: 'Carga baja'  },
  media: { color: 'var(--mc-color-warning)', label: 'Carga media' },
  alta:  { color: 'var(--mc-color-danger)',  label: 'Carga alta'  },
};

function CargaIndicator({ n }: { n: number }) {
  const nivel = nivelCarga(n);
  const { color, label } = CARGA_CONFIG[nivel];
  return (
    <span
      title={`${label}: ${n} ${n === 1 ? 'tarea' : 'tareas'}`}
      aria-label={`${label}: ${n} ${n === 1 ? 'tarea' : 'tareas'}`}
      style={{
        display:      'inline-block',
        width:         8,
        height:        8,
        borderRadius: '50%',
        background:    color,
        flexShrink:    0,
      }}
    />
  );
}

function eventosEnDia(eventos: Evento[], ymd: string): Evento[] {
  return eventos.filter((e) => fechaLocalYmd(new Date(e.fecha_inicio)) === ymd);
}

const collisionSemana: CollisionDetection = (args) => {
  const ptr     = pointerWithin(args);
  const zonaPtr = ptr.find((c) => String(c.id).startsWith('day-'));
  if (zonaPtr) return [zonaPtr];
  const corners = closestCorners(args);
  const zona    = corners.find((c) => String(c.id).startsWith('day-'));
  if (zona) return [zona];
  return corners;
};

const CONTEO_CONFIG = [
  { key: 'pendiente',    label: 'Pendientes'    },
  { key: 'en_progreso',  label: 'En progreso'   },
  { key: 'atrasada',     label: 'Atrasadas'     },
  { key: 'reprogramada', label: 'Reprogramadas' },
  { key: 'completada',   label: 'Completadas'   },
] as const;

type FiltroEstado = typeof CONTEO_CONFIG[number]['key'];

// ---------------------------------------------------------------------------
// Sub-componentes de columna
// ---------------------------------------------------------------------------

/** Zona de incidencias — solo visible en la columna del día actual */
function ZonaIncidencias({
  incidencias,
  onRegistrar,
}: {
  incidencias: Tarea[];
  onRegistrar: () => void;
}) {
  return (
    <div className="border-t border-dashed border-[var(--mc-color-border)] mt-1 pt-1">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--mc-color-info)]">
          Incidencias
        </span>
        <button
          type="button"
          onClick={onRegistrar}
          className="text-[10px] text-[var(--mc-color-info)] hover:underline"
        >
          + registrar
        </button>
      </div>
      {incidencias.length === 0 ? (
        <p className="px-2 pb-1 text-[10px] text-[var(--mc-color-text-secondary)]">
          Sin incidencias hoy
        </p>
      ) : (
        <div className="flex flex-col gap-1 px-2 pb-1">
          {incidencias.map((inc) => (
            <div
              key={inc.id}
              className="rounded border border-[var(--mc-state-incidencia-border)] bg-[var(--mc-state-incidencia-bg)] px-2 py-1 text-[10px] text-[var(--mc-color-text)]"
            >
              {inc.titulo}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export function MiSemana() {
  const {
    usuario, esJefe,
    lunes, setLunes, sabado, diasSemana,
    uid, setSeleccionId, usuariosJefe,
    tareasPlan, eventos, isError, hoyYmd, conteos,
    esBannerViernes,
    incidenciasHoy, notasHoy,
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado | null>(null);
  const [notasDrawerOpen, setNotasDrawerOpen] = useState(false);

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
        <div className="flex flex-wrap items-start justify-between gap-4">
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
            <Button variant="secondary" size="sm" onClick={() => setModal({ fecha: hoyYmd })}>
              + Nueva tarea
            </Button>
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

      {/* ── Grilla semanal ───────────────────────────────────────────────── */}
      <div className="min-w-0">
        <DndContext
          sensors={sensors}
          collisionDetection={collisionSemana}
          onDragStart={(e) => setActiveDragId(String(e.active.id))}
          onDragOver={onDragOver}
          onDragEnd={(e) => void onDragEnd(e)}
          onDragCancel={() => { setActiveDragId(null); }}
        >
          <section className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--mc-color-text-secondary)]">
              Agenda semanal
            </div>
            <div className="mc-card !p-0 overflow-hidden">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-6 md:gap-0">
                {diasSemana.map((d, idx) => {
                  const ymd       = fechaLocalYmd(d);
                  const delDia    = tareasPlan.filter((t) => t.fecha_planificada === ymd);
                  const delDiaVis = (filtroEstado
                    ? delDia.filter((t) => estadoEfectivoTablero(t, hoyYmd) === filtroEstado)
                    : delDia
                  ).slice().sort(
                    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
                  );
                  const esHoy     = ymd === hoyYmd;
                  const ph        = Boolean(activeDragId && overId === `day-${ymd}`);

                  return (
                    <div
                      key={ymd}
                      className={[
                        'flex min-h-[220px] min-w-0 flex-col border-b border-[var(--mc-color-border)]',
                        'md:border-b-0 md:border-r md:last:border-r-0',
                        esHoy ? 'bg-[var(--mc-color-accent-soft)]' : '',
                      ].join(' ').trim()}
                    >
                      {/* Cabecera del día */}
                      <div className="flex items-center justify-between gap-1 border-b border-[var(--mc-color-border)] px-2 py-2">
                        <div className="flex items-baseline gap-1.5 text-[12px] text-[var(--mc-color-text)]">
                          <span className="font-medium">{DIAS_CORTO[idx]}</span>
                          <span className="inline-flex items-center gap-1 font-bold tabular-nums">
                            {esHoy ? (
                              <span
                                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--mc-brand-violet)]"
                                title="Hoy"
                                aria-label="Hoy"
                              />
                            ) : null}
                            {d.getDate()}
                          </span>
                        </div>
                        <CargaIndicator n={delDia.length} />
                      </div>

                      {/* Botón añadir tarea */}
                      <Button
                        variant="ghost"
                        size="xs"
                        className="w-full justify-center border-b border-[var(--mc-color-border)] rounded-none !py-2"
                        onClick={() => setModal({ fecha: ymd })}
                      >
                        + Tarea / evento
                      </Button>

                      {/* Tareas y eventos del día */}
                      <SemanaDiaDrop
                        id={`day-${ymd}`}
                        className="flex min-h-[120px] flex-1 flex-col gap-2 p-2"
                        showPlaceholder={ph}
                      >
                        {eventosEnDia(eventos, ymd).map((ev) => (
                          <EventoCard key={ev.id} evento={ev} />
                        ))}
                        {delDiaVis.map((t) => (
                          <DraggableTareaSemana
                            key={t.id}
                            tarea={t}
                            hoyYmd={hoyYmd}
                            objetivoTitulo={t.objetivo_id ? tituloObjetivoPorId.get(t.objetivo_id) ?? null : null}
                            readOnly={!puedeGestionar(t)}
                            onOpenDetalle={(x) => setDetalleTareaId(x.id)}
                          />
                        ))}
                      </SemanaDiaDrop>

                      {/* Zona de incidencias — solo en el día actual */}
                      {esHoy && (
                        <ZonaIncidencias
                          incidencias={incidenciasHoy}
                          onRegistrar={() => setModalInc(true)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <DragOverlay dropAnimation={{ duration: 180, easing: 'ease-out' }}>
            {activeTareaDrag && (
              <div
                className="mc-drag-overlay-card pointer-events-none max-w-[320px]"
                style={{ transform: 'rotate(2deg)', boxShadow: '0 18px 44px -8px rgba(0,0,0,0.28)' }}
              >
                <TaskItem
                  variant="week"
                  tarea={activeTareaDrag}
                  readOnly
                  estadoVisual={estadoEfectivoTablero(activeTareaDrag, hoyYmd)}
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

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
        fechaDia={modal?.fecha}
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
            titulo:      input.titulo,
            prioridad:   input.prioridad,
            descripcion: input.descripcion || null,
            asignado_a:  input.asignado_a,
            ya_resuelta: true,
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
        fechaFija={reprDragTarea?.fecha}
        onClose={() => setReprDragTarea(null)}
        onConfirm={confirmarReprDrag}
      />
      <ModalReprogramar
        tarea={reprDetalleTarea}
        onClose={() => setReprDetalleTarea(null)}
        onConfirm={confirmarReprDetalle}
      />
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