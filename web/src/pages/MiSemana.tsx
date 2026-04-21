import {
  closestCorners,
  DndContext,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { getObjetivosActivos } from '@/api/objetivos';
import { getUsuariosActivosParaAsignacion } from '@/api/usuarios';
import { DraggableTareaSemana } from '@/components/semana/DraggableTareaSemana';
import { ModalDetalleTareaSemana } from '@/components/semana/ModalDetalleTareaSemana';
import { ModalMiSemana } from '@/components/semana/ModalMiSemana';
import { SemanaDiaDrop } from '@/components/semana/SemanaDiaDrop';
import { ModalCompletarTarea } from '@/components/tareas/ModalCompletarTarea';
import { TaskItem } from '@/components/tareas/TaskItem';
import { useMiSemanaData, useMiSemanaMutations } from '@/hooks/useMiSemana';
import { useMarcarAtrasadasAlMontar, useUsuariosParaSelector } from '@/hooks/useTareas';
import { fechaLocalDdMmYyyy, fechaLocalYmd } from '@/lib/fecha';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { agregarDias, inicioSemanaIso, semanaIsoDesdeFecha } from '@/lib/semanas';
import { useAuthStore } from '@/store/authStore';
import type { Evento, Tarea, TipoEvento } from '@/types';

const DIAS_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function contadorCarga(n: number): string {
  if (n <= 2) return '🟢';
  if (n <= 4) return '🟡';
  return '🔴';
}

function eventosEnDia(eventos: Evento[], ymd: string): Evento[] {
  return eventos.filter((e) => fechaLocalYmd(new Date(e.fecha_inicio)) === ymd);
}

/** Incluye `day-` (escritorio) y `day-mob-` (móvil) para no duplicar droppables con el mismo id en el DOM. */
const collisionSemana: CollisionDetection = (args) => {
  const ptr = pointerWithin(args);
  const zonaPtr = ptr.find((c) => c.id === 'backlog' || String(c.id).startsWith('day-'));
  if (zonaPtr) return [zonaPtr];
  const corners = closestCorners(args);
  const zona = corners.find((c) => c.id === 'backlog' || String(c.id).startsWith('day-'));
  if (zona) return [zona];
  return corners;
};

function BacklogDrop({ children, showPlaceholder }: { children: React.ReactNode; showPlaceholder?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'backlog' });
  return (
    <div ref={setNodeRef} className={`mc-semana-backlog min-h-[200px] ${isOver ? 'mc-drop-target-active' : ''}`.trim()}>
      {showPlaceholder ? <div className="mc-drag-placeholder" aria-hidden /> : null}
      {children}
    </div>
  );
}

export function MiSemana() {
  const usuario = useAuthStore((s) => s.usuario);
  const esJefe = usuario?.rol === 'jefe';
  const [lunes, setLunes] = useState(() => inicioSemanaIso(new Date()));
  const [seleccionId, setSeleccionId] = useState<string | undefined>();
  const [modal, setModal] = useState<{ modo: 'libre' | 'dia'; fecha?: string } | null>(null);
  const [detalleTareaId, setDetalleTareaId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [completarTareaId, setCompletarTareaId] = useState<string | null>(null);

  useEffect(() => {
    if (usuario?.id && seleccionId === undefined) {
      setSeleccionId(usuario.id);
    }
  }, [usuario?.id, seleccionId]);

  const { data: usuariosJefe } = useUsuariosParaSelector(Boolean(esJefe));
  const { data: objetivosActivos = [] } = useQuery({
    queryKey: ['objetivos-activos-mi-semana'],
    queryFn: () => getObjetivosActivos(),
  });
  const { data: usuariosAsignables = [] } = useQuery({
    queryKey: ['usuarios-asignacion-mi-semana'],
    queryFn: () => getUsuariosActivosParaAsignacion(),
  });

  const uid = seleccionId ?? usuario?.id;
  const semanaISO = semanaIsoDesdeFecha(lunes);
  useMarcarAtrasadasAlMontar(uid);
  const { tareasPlan, libres, eventos, isLoading, isError } = useMiSemanaData(uid, semanaISO, lunes);
  const mut = useMiSemanaMutations(uid, semanaISO);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 10 } }));

  const diasSemana = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < 7; i++) out.push(agregarDias(lunes, i));
    return out;
  }, [lunes]);

  const tareaPorId = useMemo(() => {
    const m = new Map<string, Tarea>();
    for (const t of tareasPlan) m.set(t.id, t);
    for (const t of libres) m.set(t.id, t);
    return m;
  }, [tareasPlan, libres]);
  const domingo = useMemo(() => agregarDias(lunes, 6), [lunes]);
  const tareaDetalle = detalleTareaId ? tareaPorId.get(detalleTareaId) ?? null : null;
  const tareaCompletar = completarTareaId ? tareaPorId.get(completarTareaId) ?? null : null;
  const activeTareaDrag = useMemo(() => {
    if (!activeDragId) return null;
    const tid = String(activeDragId).replace('tarea-', '');
    return tareaPorId.get(tid) ?? null;
  }, [activeDragId, tareaPorId]);

  if (!usuario) return null;
  const me = usuario;
  if (!uid) {
    return <p className="text-sm text-[var(--mc-color-text-secondary)]">Preparando vista…</p>;
  }

  const hoyYmd = fechaLocalYmd(new Date());

  function puedeGestionarTarea(t: Tarea): boolean {
    return esJefe || t.asignado_a === me.id;
  }

  async function iniciarTareaSemana(t: Tarea) {
    try {
      await mut.iniciarTarea({ tareaId: t.id, usuarioId: me.id });
      toast.success('Tarea en progreso');
    } catch {
      toast.error('No se pudo iniciar la tarea.');
    }
  }

  function onDragOver(ev: DragOverEvent) {
    setOverId(ev.over ? String(ev.over.id) : null);
  }

  async function onDragEnd(ev: DragEndEvent) {
    const { active, over } = ev;
    setActiveDragId(null);
    setOverId(null);
    if (!over || !active.id) return;
    const tid = String(active.id).replace('tarea-', '');
    const t = tareaPorId.get(tid);
    if (!t) return;
    const oid = String(over.id);
    try {
      if (oid === 'backlog') {
        if (t.tipo === 'planificada') await mut.moverBacklog(tid);
        return;
      }
      if (oid.startsWith('day-')) {
        // Primero `day-mob-` (más largo): si se hiciera al revés, `day-mob-…` quedaría `mob-…`.
        const fecha = oid.replace('day-mob-', '').replace('day-', '');
        const sem = semanaIsoDesdeFecha(new Date(`${fecha}T12:00:00`));
        await mut.moverDia({ tareaId: tid, fecha, semana: sem, tipo: t.tipo });
        return;
      }
    } catch {
      toast.error('No se pudo mover la tarea.');
    }
  }

  async function crearTareaDesdeModal(input: {
    titulo: string;
    prioridad: Tarea['prioridad'];
    descripcion: string;
    objetivo_id?: string | null;
    asignado_a?: string | null;
  }) {
    if (!modal || !usuario || !uid) return;
    const asignado = input.asignado_a?.trim() || me.id;
    if (modal.modo === 'libre') {
      await mut.crearLibre({
        titulo: input.titulo,
        prioridad: input.prioridad,
        descripcion: input.descripcion,
        asignado_a: asignado,
        creado_por: me.id,
        objetivo_id: input.objetivo_id ?? null,
      });
      toast.success('Tarea libre creada');
    } else if (modal.fecha) {
      await mut.crearPlan({
        titulo: input.titulo,
        prioridad: input.prioridad,
        descripcion: input.descripcion,
        fecha_planificada: modal.fecha,
        asignado_a: asignado,
        creado_por: me.id,
        objetivo_id: input.objetivo_id ?? null,
      });
      toast.success('Tarea planificada');
    }
  }

  async function crearEventoDesdeModal(input: {
    titulo: string;
    tipo: TipoEvento;
    hora_inicio: string;
    hora_fin: string;
    es_recurrente: boolean;
  }) {
    if (!modal?.fecha || !uid) return;
    await mut.crearEvento({
      titulo: input.titulo,
      tipo: input.tipo,
      fecha_dia: modal.fecha,
      hora_inicio: input.hora_inicio,
      hora_fin: input.hora_fin,
      usuario_id: uid,
      es_recurrente: input.es_recurrente,
    });
    toast.success('Evento creado');
  }

  async function guardarDetalle(input: {
    tareaId: string;
    titulo: string;
    prioridad: Tarea['prioridad'];
    descripcion: string;
    objetivo_id?: string | null;
    asignado_a?: string | null;
  }) {
    try {
      await mut.editarTarea(input);
      toast.success('Tarea actualizada');
    } catch {
      toast.error('No se pudo actualizar la tarea.');
    }
  }

  async function eliminarDesdeDetalle(input: { tareaId: string; motivo: string }) {
    try {
      await mut.eliminarTarea({
        tareaId: input.tareaId,
        usuarioId: me.id,
        motivo: input.motivo,
      });
      setDetalleTareaId(null);
      toast.success('Tarea eliminada');
    } catch {
      toast.error('No se pudo eliminar la tarea.');
    }
  }

  async function confirmarCompletar(input: { tareaId: string; resumen: string }) {
    try {
      await mut.completarTareaConResumen({
        tareaId: input.tareaId,
        usuarioId: me.id,
        resumen: input.resumen,
      });
      setCompletarTareaId(null);
      toast.success('Tarea finalizada');
    } catch {
      toast.error('No se pudo completar la tarea.');
    }
  }

  return (
    <div className={APP_PAGE_CLASS}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-semibold text-[var(--mc-color-text)]" style={{ fontSize: 'var(--mc-text-lg)' }}>
            Mi semana
          </h1>
          <h2 className="mt-2 text-sm font-medium text-[var(--mc-color-text-secondary)]">
            {fechaLocalDdMmYyyy(lunes)} — {fechaLocalDdMmYyyy(domingo)}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {esJefe && usuariosJefe && usuariosJefe.length > 0 ? (
            <label className="flex flex-col gap-1 text-xs text-[var(--mc-color-text-secondary)]">
              Vista
              <select
                className="mc-input !w-auto min-w-[200px]"
                value={uid}
                onChange={(e) => setSeleccionId(e.target.value)}
              >
                {usuariosJefe.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} ({u.email})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="flex items-center gap-2">
            <button type="button" className="mc-btn-secondary text-sm" onClick={() => setLunes((d) => agregarDias(d, -7))}>
              ‹
            </button>
            <button type="button" className="mc-btn-secondary text-sm" onClick={() => setLunes((d) => agregarDias(d, 7))}>
              ›
            </button>
          </div>
        </div>
      </div>

      {isError ? <p className="text-sm text-[var(--mc-color-danger)]">Error al cargar datos.</p> : null}

      <DndContext
        sensors={sensors}
        collisionDetection={collisionSemana}
        onDragStart={(e) => setActiveDragId(String(e.active.id))}
        onDragOver={onDragOver}
        onDragEnd={(e) => void onDragEnd(e)}
        onDragCancel={() => {
          setActiveDragId(null);
          setOverId(null);
        }}
      >
        <div className="flex flex-col gap-6">
          <section className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--mc-color-text-secondary)]">
              Agenda semanal
            </div>
            <div className="mc-card !p-0 hidden overflow-hidden md:block">
              <div className="grid grid-cols-7">
                {diasSemana.map((d, idx) => {
                  const ymd = fechaLocalYmd(d);
                  const delDia = tareasPlan.filter((t) => t.fecha_planificada === ymd);
                  const carga = contadorCarga(delDia.length);
                  const br = (idx + 1) % 7 !== 0 ? 'border-r border-[var(--mc-color-border)]' : '';
                  const esHoy = ymd === hoyYmd;
                  const ph = Boolean(activeDragId && overId === `day-${ymd}`);
                  return (
                    <div
                      key={ymd}
                      className={`flex min-h-[220px] min-w-0 flex-col ${br} ${esHoy ? 'bg-[var(--mc-color-accent-soft)]' : ''}`.trim()}
                    >
                      <div
                        className={`flex items-center justify-between gap-1 border-b border-[var(--mc-color-border)] px-2 py-2 ${esHoy ? 'bg-[var(--mc-color-accent-soft)]' : 'bg-[var(--mc-color-bg)]'}`}
                      >
                        <span className="text-xs font-semibold text-[var(--mc-color-text)]">
                          {DIAS_CORTO[idx]} {d.getDate()}
                        </span>
                        <span className="text-xs" aria-hidden>
                          {carga}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="mc-btn-ghost w-full justify-center border-b border-[var(--mc-color-border)] !py-2 text-xs"
                        onClick={() => setModal({ modo: 'dia', fecha: ymd })}
                      >
                        +
                      </button>
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
                            readOnly={!puedeGestionarTarea(t)}
                            onOpenDetalle={(x) => setDetalleTareaId(x.id)}
                            onEditar={(x) => setDetalleTareaId(x.id)}
                            onEliminar={(x) => setDetalleTareaId(x.id)}
                            onCompletar={puedeGestionarTarea(t) ? (x) => setCompletarTareaId(x.id) : undefined}
                            onIniciar={puedeGestionarTarea(t) ? (x) => void iniciarTareaSemana(x) : undefined}
                          />
                        ))}
                        {eventosEnDia(eventos, ymd).map((ev) => (
                          <div key={ev.id} className="mc-entity-card !text-xs text-[var(--mc-color-text-secondary)]">
                            <span className="font-medium text-[var(--mc-color-text)]">{ev.titulo}</span>
                            <span className="block">
                              {new Date(ev.fecha_inicio).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))}
                      </SemanaDiaDrop>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3 md:hidden">
              {diasSemana.map((d, idx) => {
                const ymd = fechaLocalYmd(d);
                const delDia = tareasPlan.filter((t) => t.fecha_planificada === ymd);
                const carga = contadorCarga(delDia.length);
                const esHoy = ymd === hoyYmd;
                const ph = Boolean(activeDragId && overId === `day-mob-${ymd}`);
                return (
                  <div key={ymd} className={`mc-card !p-3 ${esHoy ? 'bg-[var(--mc-color-accent-soft)]' : ''}`.trim()}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-semibold">
                        {DIAS_CORTO[idx]} {fechaLocalYmd(d)}
                      </span>
                      <span>{carga}</span>
                    </div>
                    <button type="button" className="mc-btn-secondary mb-2 w-full text-xs" onClick={() => setModal({ modo: 'dia', fecha: ymd })}>
                      + Tarea / evento
                    </button>
                    <SemanaDiaDrop id={`day-mob-${ymd}`} className="flex flex-col gap-2" showPlaceholder={ph}>
                      {delDia.map((t) => (
                        <DraggableTareaSemana
                          key={t.id}
                          tarea={t}
                          hoyYmd={hoyYmd}
                          readOnly={!puedeGestionarTarea(t)}
                          onOpenDetalle={(x) => setDetalleTareaId(x.id)}
                          onEditar={(x) => setDetalleTareaId(x.id)}
                          onEliminar={(x) => setDetalleTareaId(x.id)}
                          onCompletar={puedeGestionarTarea(t) ? (x) => setCompletarTareaId(x.id) : undefined}
                          onIniciar={puedeGestionarTarea(t) ? (x) => void iniciarTareaSemana(x) : undefined}
                        />
                      ))}
                      {eventosEnDia(eventos, ymd).map((ev) => (
                        <div key={ev.id} className="mc-entity-card !py-3 text-xs">
                          <span className="font-medium text-[var(--mc-color-text)]">{ev.titulo}</span>
                        </div>
                      ))}
                    </SemanaDiaDrop>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--mc-color-text-secondary)]">
                Backlog
              </div>
              <button type="button" className="mc-btn-secondary !px-3 !py-2 text-xs" onClick={() => setModal({ modo: 'libre' })}>
                + Nueva libre
              </button>
            </div>
            <BacklogDrop showPlaceholder={Boolean(activeDragId && overId === 'backlog')}>
              {isLoading ? (
                <p className="text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
              ) : libres.length === 0 ? (
                <p className="text-sm text-[var(--mc-color-text-secondary)]">Sin tareas libres.</p>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {libres.map((t) => (
                    <li key={t.id}>
                      <DraggableTareaSemana
                        tarea={t}
                        hoyYmd={hoyYmd}
                        readOnly={!puedeGestionarTarea(t)}
                        onOpenDetalle={(x) => setDetalleTareaId(x.id)}
                        onEditar={(x) => setDetalleTareaId(x.id)}
                        onEliminar={(x) => setDetalleTareaId(x.id)}
                        onCompletar={puedeGestionarTarea(t) ? (x) => setCompletarTareaId(x.id) : undefined}
                        onIniciar={puedeGestionarTarea(t) ? (x) => void iniciarTareaSemana(x) : undefined}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </BacklogDrop>
          </section>

          <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
            {activeTareaDrag ? (
              <div className="mc-drag-overlay-card pointer-events-none max-w-[320px]">
                <TaskItem
                  variant="week"
                  tarea={activeTareaDrag}
                  readOnly
                  estadoVisual={estadoEfectivoTablero(activeTareaDrag, hoyYmd)}
                />
              </div>
            ) : null}
          </DragOverlay>
        </div>
      </DndContext>

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
      <ModalDetalleTareaSemana
        open={detalleTareaId !== null}
        tarea={tareaDetalle}
        objetivos={objetivosActivos}
        usuariosAsignables={usuariosAsignables}
        readOnly={Boolean(tareaDetalle && !esJefe && tareaDetalle.asignado_a !== me.id)}
        onClose={() => setDetalleTareaId(null)}
        onGuardar={guardarDetalle}
        onEliminar={eliminarDesdeDetalle}
      />
    </div>
  );
}
