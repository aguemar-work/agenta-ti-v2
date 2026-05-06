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
import { HoyPanel } from '@/components/semana/HoyPanel';
import { ModalDetalleTareaSemana } from '@/components/semana/ModalDetalleTareaSemana';
import { ModalMiSemana } from '@/components/semana/ModalMiSemana';
import { SemanaDiaDrop } from '@/components/semana/SemanaDiaDrop';
import { ModalBloquear } from '@/components/tareas/ModalBloquear';
import { ModalCompletarTarea } from '@/components/tareas/ModalCompletarTarea';
import { ModalReprogramar } from '@/components/tareas/ModalReprogramar';
import { TaskItem } from '@/components/tareas/TaskItem';
import { Button } from '@/components/ui/Button';
import { ModalNuevaTarea } from '@/components/tareas/ModalNuevaTarea';
import { useMiSemanaPage } from '@/hooks/useMiSemanaPage';
import { fechaLocalDdMmYyyy, fechaLocalYmd } from '@/lib/fecha';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { agregarDias } from '@/lib/semanas';
import type { Evento } from '@/types';

// ---------------------------------------------------------------------------
// Helpers de presentación (sin lógica de negocio)
// ---------------------------------------------------------------------------
const DIAS_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

type NivelCarga = 'baja' | 'media' | 'alta';

function nivelCarga(n: number): NivelCarga {
  if (n <= 2) return 'baja';
  if (n <= 4) return 'media';
  return 'alta';
}

const CARGA_CONFIG: Record<NivelCarga, { emoji: string; label: string }> = {
  baja:  { emoji: '🟢', label: 'Carga baja'  },
  media: { emoji: '🟡', label: 'Carga media' },
  alta:  { emoji: '🔴', label: 'Carga alta'  },
};

function CargaIndicator({ n }: { n: number }) {
  const nivel = nivelCarga(n);
  const { emoji, label } = CARGA_CONFIG[nivel];
  return (
    <span
      role="img"
      aria-label={`${label}: ${n} ${n === 1 ? 'tarea' : 'tareas'}`}
      title={`${label}: ${n} ${n === 1 ? 'tarea' : 'tareas'}`}
      className="text-xs"
    >
      {emoji}
    </span>
  );
}

function eventosEnDia(eventos: Evento[], ymd: string): Evento[] {
  return eventos.filter((e) => fechaLocalYmd(new Date(e.fecha_inicio)) === ymd);
}

const collisionSemana: CollisionDetection = (args) => {
  const ptr    = pointerWithin(args);
  const zonaPtr = ptr.find((c) => String(c.id).startsWith('day-'));
  if (zonaPtr) return [zonaPtr];
  const corners = closestCorners(args);
  const zona    = corners.find((c) => String(c.id).startsWith('day-'));
  if (zona) return [zona];
  return corners;
};

const CONTEO_CONFIG = [
  { key: 'pendiente',   label: 'Pendientes',   color: 'text-[var(--mc-color-text)]' },
  { key: 'en_progreso', label: 'En progreso',  color: 'text-[var(--mc-color-accent)]' },
  { key: 'atrasada',    label: 'Atrasadas',    color: 'text-[var(--mc-color-danger)]' },
  { key: 'reprogramada',label: 'Reprogramadas',color: 'text-[var(--mc-color-text-secondary)]' },
  { key: 'completada',  label: 'Completadas',  color: 'text-[var(--mc-color-success)]' },
] as const;

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------
export function MiSemana() {
  const {
    usuario, esJefe,
    lunes, setLunes, sabado, diasSemana,
    uid, setSeleccionId, usuariosJefe,
    tareasPlan, eventos, isError, hoyYmd, conteos,
    setModo, esModoHoy, esBannerViernes,
    incidenciasHoy, notasHoy, eventosHoy,
    modalInc, setModalInc,
    notaRapida, setNotaRapida,
    crearIncidenciaHoy, guardarNotaRapida,
    objetivosActivos, usuariosAsignables,
    tareaDetalle, tareaCompletar, activeTareaDrag,
    activeDragId, setActiveDragId, overId,
    onDragOver, onDragEnd,
    modal,             setModal,
    detalleTareaId,    setDetalleTareaId,
    completarTareaId,  setCompletarTareaId,
    bloquearTareaState,setBloquearTareaState,
    reprDetalleTarea,  setReprDetalleTarea,
    reprDragTarea,     setReprDragTarea,
    puedeGestionar,
    confirmarReprDrag, confirmarReprDetalle, confirmarBloqueo,
    confirmarCompletar, crearTareaDesdeModal, crearEventoDesdeModal,
    guardarDetalle, eliminarDesdeDetalle, iniciarDesdeDetalle,
  } = useMiSemanaPage();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  if (!usuario) return null;
  if (!uid) return <p className="text-sm text-[var(--mc-color-text-secondary)]">Preparando vista…</p>;

  return (
    <div className={APP_PAGE_CLASS}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <PageHeader
        title={esModoHoy ? 'Ahora' : 'Mi semana'}
        subtitle={esModoHoy
          ? fechaLocalDdMmYyyy(new Date())
          : `${fechaLocalDdMmYyyy(lunes)} — ${fechaLocalDdMmYyyy(sabado)}`
        }
        left={
          <>
            {/* Toggle Hoy / Semana */}
            <div className="mc-toggle-pill">
              <button
                type="button"
                className="mc-toggle-pill-btn"
                aria-pressed={esModoHoy}
                onClick={() => setModo('hoy')}
              >
                Ahora
              </button>
              <button
                type="button"
                className="mc-toggle-pill-btn"
                aria-pressed={!esModoHoy}
                onClick={() => setModo('semana')}
              >
                Semana
              </button>
            </div>
            {/* Flechas semana — solo en modo Semana */}
            {!esModoHoy && (
              <div className="mc-nav-arrows">
                <button className="mc-nav-arrow-btn" onClick={() => setLunes((d) => agregarDias(d, -7))} aria-label="Semana anterior">‹</button>
                <button className="mc-nav-arrow-btn" onClick={() => setLunes((d) => agregarDias(d, 7))} aria-label="Semana siguiente">›</button>
              </div>
            )}
          </>
        }
        actions={
          <div className="flex items-center gap-3">
            {esJefe && usuariosJefe && usuariosJefe.length > 0 && (
              <select
                id="semana-miembro"
                aria-label="Ver semana de"
                className="mc-input !w-auto min-w-[180px]"
                value={uid}
                onChange={(e) => setSeleccionId(e.target.value)}
              >
                {usuariosJefe.map((u) => (
                  <option key={u.id} value={u.id}>{u.nombre}</option>
                ))}
              </select>
            )}
            <Button
              variant={esModoHoy ? 'quaternary' : 'secondary'}
              size="sm"
              onClick={() => setModal({ fecha: hoyYmd })}
            >
              + Nueva tarea
            </Button>
          </div>
        }
      />

      {/* Banner viernes */}
      {esBannerViernes && !esModoHoy && (
        <div className="flex items-center gap-3 rounded-lg border border-[var(--mc-color-accent)] bg-[color-mix(in_srgb,var(--mc-color-accent)_8%,transparent)] px-4 py-3">
          <span className="text-lg">📅</span>
          <p className="text-sm font-medium text-[var(--mc-color-accent)]">
            ¡Es viernes! Buen momento para planificar la próxima semana.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="ml-auto"
            onClick={() => setLunes((d) => agregarDias(d, 7))}
          >
            Ver próxima semana
          </Button>
        </div>
      )}

      {isError && <p className="text-sm text-[var(--mc-color-danger)]">Error al cargar datos.</p>}

      {/* ── Panel Hoy ──────────────────────────────────────────────────── */}
      {esModoHoy && (
        <div className="flex flex-col gap-4">
          {/* Eventos del día */}
          {eventosHoy.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--mc-color-border)] bg-[var(--mc-color-bg)] px-4 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--mc-color-text-secondary)]">Eventos</span>
              {eventosHoy.map((ev) => (
                <span key={ev.id} className="flex items-center gap-2 rounded-full border border-[var(--mc-color-border)] bg-[var(--mc-color-bg-secondary)] px-3 py-1 text-xs text-[var(--mc-color-text)]">
                  <span className="text-[var(--mc-color-text-secondary)]">
                    {new Date(ev.fecha_inicio).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {ev.titulo}
                </span>
              ))}
            </div>
          )}

          {/* ── Panel Hoy: tabs en móvil · 3 columnas en md+ ───────────── */}
          <HoyPanel
            hoyYmd={hoyYmd}
            tareasPlan={tareasPlan}
            incidenciasHoy={incidenciasHoy}
            notasHoy={notasHoy}
            notaRapida={notaRapida}
            setNotaRapida={setNotaRapida}
            guardarNotaRapida={guardarNotaRapida}
            puedeGestionar={puedeGestionar}
            esJefe={esJefe}
            setDetalleTareaId={setDetalleTareaId}
            setReprDetalleTarea={setReprDetalleTarea}
            setBloquearTareaState={setBloquearTareaState}
            setCompletarTareaId={setCompletarTareaId}
            setModalInc={setModalInc}
            onIniciarTarea={(t) => void iniciarDesdeDetalle(t)}
          />
        </div>
      )}

      {/* ── Panel Semana (con DnD) ───────────────────────────────────────── */}
      {!esModoHoy && (
      <DndContext
        sensors={sensors}
        collisionDetection={collisionSemana}
        onDragStart={(e) => setActiveDragId(String(e.active.id))}
        onDragOver={onDragOver}
        onDragEnd={(e) => void onDragEnd(e)}
        onDragCancel={() => { setActiveDragId(null); }}
      >
        <div className="flex flex-col gap-6">

          {/* ── Contadores ───────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-3">
            {CONTEO_CONFIG.map(({ key, label, color }) => (
              <div key={key} className="mc-card flex min-w-[90px] flex-col gap-1 !p-3">
                <span className={`text-xl font-semibold ${color}`}>
                  {conteos[key]}
                </span>
                <span className="text-xs text-[var(--mc-color-text-secondary)]">{label}</span>
              </div>
            ))}
          </div>

          {/* ── Agenda semanal ───────────────────────────────────────── */}
          <section className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--mc-color-text-secondary)]">
              Agenda semanal
            </div>
            <div className="mc-card !p-0 overflow-hidden">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-6 md:gap-0">
                {diasSemana.map((d, idx) => {
                  const ymd    = fechaLocalYmd(d);
                  const delDia = tareasPlan.filter((t) => t.fecha_planificada === ymd);
                  const esHoy  = ymd === hoyYmd;
                  const ph     = Boolean(activeDragId && overId === `day-${ymd}`);

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
                        <span className={`text-xs font-semibold ${esHoy ? 'text-[var(--mc-color-accent)]' : 'text-[var(--mc-color-text)]'}`}>
                          {DIAS_CORTO[idx]} {d.getDate()}{esHoy ? ' · hoy' : ''}
                        </span>
                        <CargaIndicator n={delDia.length} />
                      </div>

                      {/* Botón añadir */}
                      <Button
                        variant="ghost"
                        size="xs"
                        className="w-full justify-center border-b border-[var(--mc-color-border)] rounded-none !py-2"
                        onClick={() => setModal({ fecha: ymd })}
                      >
                        + Tarea / evento
                      </Button>

                      {/* Drop zone: eventos primero (no arrastrables), luego tareas */}
                      <SemanaDiaDrop
                        id={`day-${ymd}`}
                        className="flex min-h-[120px] flex-1 flex-col gap-2 p-2"
                        showPlaceholder={ph}
                      >
                        {eventosEnDia(eventos, ymd).map((ev) => (
                          <EventoCard key={ev.id} evento={ev} />
                        ))}
                        {delDia.map((t) => (
                          <DraggableTareaSemana
                            key={t.id}
                            tarea={t}
                            hoyYmd={hoyYmd}
                            readOnly={!puedeGestionar(t)}
                            onOpenDetalle={(x) => setDetalleTareaId(x.id)}
                          />
                        ))}
                      </SemanaDiaDrop>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ── Drag overlay ─────────────────────────────────────────── */}
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
        </div>
      </DndContext>
      )}

      {/* ── Modales ────────────────────────────────────────────────────── */}
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
            titulo:       input.titulo,
            prioridad:    input.prioridad,
            descripcion:  input.descripcion || null,
            asignado_a:   input.asignado_a,
            ya_resuelta:  true,
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