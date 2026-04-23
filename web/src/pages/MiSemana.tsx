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
import { ModalDetalleTareaSemana } from '@/components/semana/ModalDetalleTareaSemana';
import { ModalMiSemana } from '@/components/semana/ModalMiSemana';
import { SemanaDiaDrop } from '@/components/semana/SemanaDiaDrop';
import { ModalBloquear } from '@/components/tareas/ModalBloquear';
import { ModalCompletarTarea } from '@/components/tareas/ModalCompletarTarea';
import { ModalReprogramar } from '@/components/tareas/ModalReprogramar';
import { TaskItem } from '@/components/tareas/TaskItem';
import { Button } from '@/components/ui/Button';
import { useMiSemanaPage } from '@/hooks/useMiSemanaPage';
import { fechaLocalDdMmYyyy, fechaLocalYmd } from '@/lib/fecha';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { agregarDias } from '@/lib/semanas';
import type { Evento } from '@/types';

// ---------------------------------------------------------------------------
// Helpers de presentación (sin lógica de negocio)
// ---------------------------------------------------------------------------
const DIAS_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function contadorCarga(n: number): string {
  if (n <= 2) return '🟢';
  if (n <= 4) return '🟡';
  return '🔴';
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
    guardarDetalle, eliminarDesdeDetalle, iniciarDesdeDetalle, planificarDesdeDetalle,
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
      <header className="mc-page-header">
        <div>
          <h1 className="mc-page-title">Mi semana</h1>
          <h2 className="mc-page-subtitle">
            {fechaLocalDdMmYyyy(lunes)} — {fechaLocalDdMmYyyy(sabado)}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {esJefe && usuariosJefe && usuariosJefe.length > 0 && (
            <div className="mc-field !mb-0">
              <label className="mc-field-label" htmlFor="semana-miembro">Vista</label>
              <select
                id="semana-miembro"
                className="mc-input !w-auto min-w-[200px]"
                value={uid}
                onChange={(e) => setSeleccionId(e.target.value)}
              >
                {usuariosJefe.map((u) => (
                  <option key={u.id} value={u.id}>{u.nombre} ({u.email})</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setLunes((d) => agregarDias(d, -7))}>‹</Button>
            <Button variant="secondary" size="sm" onClick={() => setLunes((d) => agregarDias(d, 7))}>›</Button>
          </div>
        </div>
      </header>

      {isError && <p className="text-sm text-[var(--mc-color-danger)]">Error al cargar datos.</p>}

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
                        <div className="flex flex-col gap-1">
                          <span className={`text-xs font-semibold ${esHoy ? 'text-[var(--mc-color-accent)]' : 'text-[var(--mc-color-text)]'}`}>
                            {DIAS_CORTO[idx]} {d.getDate()}{esHoy ? ' · hoy' : ''}
                          </span>
                          {eventosEnDia(eventos, ymd).length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {eventosEnDia(eventos, ymd).map((ev) => (
                                <span key={ev.id} className="flex items-center gap-1 text-[10px] text-[var(--mc-color-warning)]">
                                  <span className="inline-block h-[6px] w-[6px] rounded-full bg-[var(--mc-color-warning)]" />
                                  {new Date(ev.fecha_inicio).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <span className="text-xs" aria-hidden>{contadorCarga(delDia.length)}</span>
                      </div>

                      {/* Botón añadir */}
                      <Button
                        variant="ghost"
                        size="xs"
                        className="w-full justify-center border-b border-[var(--mc-color-border)] rounded-none !py-2"
                        onClick={() => setModal({ modo: 'dia', fecha: ymd })}
                      >
                        + Tarea / evento
                      </Button>

                      {/* Drop zone */}
                      <SemanaDiaDrop
                        id={`day-${ymd}`}
                        className="flex min-h-[120px] flex-1 flex-col gap-2 p-2"
                        showPlaceholder={ph}
                      >
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

      {/* ── Modales ────────────────────────────────────────────────────── */}
      <ModalMiSemana
        open={modal !== null}
        modoOrigen={modal?.modo ?? 'libre'}
        fechaDia={modal?.fecha}
        objetivos={objetivosActivos}
        usuariosAsignables={usuariosAsignables}
        asignadoPorDefectoId={uid}
        onClose={() => setModal(null)}
        onCrearTarea={crearTareaDesdeModal}
        onCrearEvento={crearEventoDesdeModal}
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
        onPlanificar={planificarDesdeDetalle}
      />
    </div>
  );
}