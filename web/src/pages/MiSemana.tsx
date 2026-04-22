import {
  closestCorners,
  DndContext,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  pointerWithin,
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
import { ModalBloquear } from '@/components/tareas/ModalBloquear';
import { ModalCompletarTarea } from '@/components/tareas/ModalCompletarTarea';
import { ModalReprogramar } from '@/components/tareas/ModalReprogramar';
import { TaskItem } from '@/components/tareas/TaskItem';
import { useMiSemanaData, useMiSemanaMutations } from '@/hooks/useMiSemana';
import { bloquearTarea, reprogramarTareaConLog, useMarcarAtrasadasAlMontar, useUsuariosParaSelector } from '@/hooks/useTareas';
import { fechaLocalDdMmYyyy, fechaLocalYmd } from '@/lib/fecha';
import { resolverEstadoReprogramacion } from '@/lib/tareaEstado';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { agregarDias, inicioSemanaIso, semanaIsoDesdeFecha } from '@/lib/semanas';
import { useAuthStore } from '@/store/authStore';
import type { Evento, Tarea, TipoEvento } from '@/types';

const DIAS_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function contadorCarga(n: number): string {
  if (n <= 2) return '🟢';
  if (n <= 4) return '🟡';
  return '🔴';
}

function eventosEnDia(eventos: Evento[], ymd: string): Evento[] {
  return eventos.filter((e) => fechaLocalYmd(new Date(e.fecha_inicio)) === ymd);
}

/** Prioriza zonas de día (`day-*`) y backlog en la detección de colisiones. */
const collisionSemana: CollisionDetection = (args) => {
  const ptr = pointerWithin(args);
  const zonaPtr = ptr.find((c) => String(c.id).startsWith('day-'));
  if (zonaPtr) return [zonaPtr];
  const corners = closestCorners(args);
  const zona = corners.find((c) => String(c.id).startsWith('day-'));
  if (zona) return [zona];
  return corners;
};

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
  const [bloquearTareaState, setBloquearTareaState] = useState<Tarea | null>(null);
  const [reprDetalleTarea, setReprDetalleTarea] = useState<Tarea | null>(null);
  const [reprDragTarea, setReprDragTarea] = useState<{ tarea: Tarea; fecha: string; semana: string } | null>(null);

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
  const { tareasPlan, eventos, isError } = useMiSemanaData(uid, semanaISO, lunes);
  const mut = useMiSemanaMutations(uid, semanaISO);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

  const diasSemana = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < 6; i++) out.push(agregarDias(lunes, i));
    return out;
  }, [lunes]);

  const tareaPorId = useMemo(() => {
    const m = new Map<string, Tarea>();
    for (const t of tareasPlan) m.set(t.id, t);
    return m;
  }, [tareasPlan]);
  const sabado = useMemo(() => agregarDias(lunes, 5), [lunes]);
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
      if (oid.startsWith('day-')) {
        const fecha = oid.slice(4);
        const sem = semanaIsoDesdeFecha(new Date(`${fecha}T12:00:00`));
        if (t.tipo === 'planificada' && t.fecha_planificada && t.fecha_planificada !== fecha) {
          setReprDragTarea({ tarea: t, fecha, semana: sem });
          return;
        }
        await mut.moverDia({ tareaId: tid, fecha, semana: sem, tipo: t.tipo });
      }
    } catch {
      toast.error('No se pudo mover la tarea.');
    }
  }

  async function confirmarReprDrag(input: { tareaId: string; nuevaFecha: string; justificacion: string }) {
    if (!reprDragTarea) return;
    const { tarea: t, semana } = reprDragTarea;
    try {
      const nuevoEstado = resolverEstadoReprogramacion(t, hoyYmd);
      await reprogramarTareaConLog({
        tareaId: input.tareaId,
        usuarioId: me.id,
        nuevaFecha: input.nuevaFecha,
        justificacion: input.justificacion,
        nuevoEstado,
      });
      setReprDragTarea(null);
      toast.success('Tarea reprogramada');
      await mut.moverDia({ tareaId: input.tareaId, fecha: input.nuevaFecha, semana, tipo: t.tipo });
    } catch {
      toast.error('No se pudo reprogramar la tarea.');
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
            {fechaLocalDdMmYyyy(lunes)} — {fechaLocalDdMmYyyy(sabado)}
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
          {(() => {
            const conteos = { pendiente: 0, en_progreso: 0, atrasada: 0, reprogramada: 0, completada: 0 };
            for (const t of tareasPlan) {
              const est = estadoEfectivoTablero(t, hoyYmd);
              if (est in conteos) conteos[est as keyof typeof conteos]++;
            }
            return (
              <div className="flex flex-wrap gap-3">
                {[
                  { key: 'pendiente', label: 'Pendientes', color: 'text-[var(--mc-color-text)]' },
                  { key: 'en_progreso', label: 'En progreso', color: 'text-[var(--mc-color-accent)]' },
                  { key: 'atrasada', label: 'Atrasadas', color: 'text-[var(--mc-color-danger)]' },
                  { key: 'reprogramada', label: 'Reprogramadas', color: 'text-[var(--mc-color-text-secondary)]' },
                  { key: 'completada', label: 'Completadas', color: 'text-[var(--mc-color-success)]' },
                ].map(({ key, label, color }) => (
                  <div key={key} className="mc-card flex min-w-[90px] flex-col gap-1 !p-3">
                    <span className={`text-xl font-semibold ${color}`}>{conteos[key as keyof typeof conteos]}</span>
                    <span className="text-xs text-[var(--mc-color-text-secondary)]">{label}</span>
                  </div>
                ))}
              </div>
            );
          })()}
          <section className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--mc-color-text-secondary)]">
              Agenda semanal
            </div>
            <div className="mc-card !p-0 overflow-hidden">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-6 md:gap-0">
              {diasSemana.map((d, idx) => {
                const ymd = fechaLocalYmd(d);
                const delDia = tareasPlan.filter((t) => t.fecha_planificada === ymd);
                const carga = contadorCarga(delDia.length);
                const esHoy = ymd === hoyYmd;
                const ph = Boolean(activeDragId && overId === `day-${ymd}`);
                return (
                  <div
                    key={ymd}
                    className={`flex min-h-[220px] min-w-0 flex-col border-b border-[var(--mc-color-border)] md:border-b-0 md:border-r md:last:border-r-0 ${esHoy ? 'bg-[var(--mc-color-accent-soft)]' : ''}`.trim()}
                  >
                    <div className="flex items-center justify-between gap-1 border-b border-[var(--mc-color-border)] px-2 py-2">
                      <div className="flex flex-col gap-1">
                        <span className={`text-xs font-semibold ${esHoy ? 'text-[var(--mc-color-accent)]' : 'text-[var(--mc-color-text)]'}`}>
                          {DIAS_CORTO[idx]} {d.getDate()}
                          {esHoy ? ' · hoy' : ''}
                        </span>
                        {eventosEnDia(eventos, ymd).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {eventosEnDia(eventos, ymd).map((ev) => (
                              <span key={ev.id} className="flex items-center gap-1 text-[10px] text-[var(--mc-color-warning)]">
                                <span className="inline-block h-[6px] w-[6px] rounded-full bg-[var(--mc-color-warning)]" />
                                {new Date(ev.fecha_inicio).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <span className="text-xs" aria-hidden>
                        {carga}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="mc-btn-ghost w-full justify-center border-b border-[var(--mc-color-border)] !py-2 text-xs"
                      onClick={() => setModal({ modo: 'dia', fecha: ymd })}
                    >
                      + Tarea / evento
                    </button>
                    <SemanaDiaDrop id={`day-${ymd}`} className="flex min-h-[120px] flex-1 flex-col gap-2 p-2" showPlaceholder={ph}>
                      {delDia.map((t) => (
                        <DraggableTareaSemana
                          key={t.id}
                          tarea={t}
                          hoyYmd={hoyYmd}
                          readOnly={!puedeGestionarTarea(t)}
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

          <DragOverlay dropAnimation={{ duration: 180, easing: 'ease-out' }}>
            {activeTareaDrag ? (
              <div
                className="mc-drag-overlay-card pointer-events-none max-w-[320px]"
                style={{ transform: 'rotate(2deg)', boxShadow: '0 18px 44px -8px rgba(0, 0, 0, 0.28)' }}
              >
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
      <ModalBloquear
        tarea={bloquearTareaState}
        onClose={() => setBloquearTareaState(null)}
        onConfirm={async (input) => {
          try {
            await bloquearTarea({ ...input, usuarioId: me.id });
            setBloquearTareaState(null);
            toast.success('Tarea bloqueada');
          } catch {
            toast.error('No se pudo bloquear la tarea.');
          }
        }}
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
        onConfirm={async (input) => {
          if (!reprDetalleTarea) return;
          const nuevoEstado = resolverEstadoReprogramacion(reprDetalleTarea, hoyYmd);
          await reprogramarTareaConLog({ ...input, usuarioId: me.id, nuevoEstado });
          setReprDetalleTarea(null);
          toast.success('Tarea reprogramada');
        }}
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
        onIniciar={async (t) => {
          await mut.iniciarTarea({ tareaId: t.id, usuarioId: me.id });
          toast.success('Tarea en progreso');
          setDetalleTareaId(null);
        }}
        onCompletar={(t) => {
          setCompletarTareaId(t.id);
          setDetalleTareaId(null);
        }}
        onReprogramar={(t) => {
          setReprDetalleTarea(t);
          setDetalleTareaId(null);
        }}
        onBloquear={(t) => {
          setBloquearTareaState(t);
          setDetalleTareaId(null);
        }}
        onPlanificar={async (t, fecha) => {
          const sem = semanaIsoDesdeFecha(new Date(`${fecha}T12:00:00`));
          await mut.moverDia({ tareaId: t.id, fecha, semana: sem, tipo: t.tipo });
          toast.success('Tarea planificada');
          setDetalleTareaId(null);
        }}
      />
    </div>
  );
}
