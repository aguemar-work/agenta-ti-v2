import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { insertarNotaBitacoraRapida } from '@/api/hoyColumnas';
import { eliminarTareaConMotivo, actualizarTarea } from '@/api/semana';
import { getObjetivosActivos } from '@/api/objetivos';
import { getUsuariosActivosParaAsignacion } from '@/api/usuarios';
import { ModalDetalleTareaSemana } from '@/components/semana/ModalDetalleTareaSemana';
import { ModalBloquear } from '@/components/tareas/ModalBloquear';
import { ModalCompletarTarea } from '@/components/tareas/ModalCompletarTarea';
import { ModalReprogramar } from '@/components/tareas/ModalReprogramar';
import { ModalNuevaTarea } from '@/components/tareas/ModalNuevaTarea';
import { TaskItem } from '@/components/tareas/TaskItem';
import {
  crearIncidenciaHoy,
  Q_INC_HOY,
  Q_NOTAS_HOY,
  useEventosHoy,
  useIncidenciasDelDia,
  useNotasBitacoraHoy,
} from '@/hooks/useHoyColumnas';
import { Q_KPIS, Q_OBJ_PROG } from '@/hooks/useObjetivosMetricas';
import { useMoverColumnaMutation } from '@/hooks/useTablero';
import {
  bloquearTarea,
  completarTareaConResumen,
  reprogramarTareaConLog,
  useMarcarAtrasadasAlMontar,
  useTareasHoy,
  useUsuariosParaSelector,
} from '@/hooks/useTareas';
import { fechaLocalDdMmYyyy, fechaLocalYmd } from '@/lib/fecha';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { useAuthStore } from '@/store/authStore';
import type { Tarea, VisibilidadBitacora } from '@/types';

const visLabel: Record<VisibilidadBitacora, string> = {
  todos: 'Equipo',
  solo_jefe: 'Jefe',
  privado: 'Privado',
};

export function Hoy() {
  const qc = useQueryClient();
  const usuario = useAuthStore((s) => s.usuario);
  const esJefe = usuario?.rol === 'jefe';

  const [seleccionId, setSeleccionId] = useState<string | undefined>();
  const [reprTarea, setReprTarea] = useState<Tarea | null>(null);
  const [modalInc, setModalInc] = useState(false);
  const [completarTarea, setCompletarTarea] = useState<Tarea | null>(null);
  const [bloquearTareaState, setBloquearTareaState] = useState<Tarea | null>(null);
  const [detalleTareaId, setDetalleTareaId] = useState<string | null>(null);
  const [notaRapida, setNotaRapida] = useState('');

  useEffect(() => {
    if (usuario?.id && seleccionId === undefined) {
      setSeleccionId(usuario.id);
    }
  }, [usuario?.id, seleccionId]);

  const { data: usuariosJefe } = useUsuariosParaSelector(Boolean(esJefe));

  const asignado = seleccionId ?? usuario?.id;
  const hoyYmd = fechaLocalYmd(new Date());

  useMarcarAtrasadasAlMontar(asignado);
  const { data: tareas = [], isLoading, isError } = useTareasHoy(asignado);
  const { data: incidenciasHist = [], isLoading: loadInc } = useIncidenciasDelDia(asignado, hoyYmd);
  const { data: eventos = [], isLoading: loadEv } = useEventosHoy(asignado, hoyYmd);
  const { data: notas = [], isLoading: loadNotas } = useNotasBitacoraHoy(asignado);

  const { data: objetivosActivos = [] } = useQuery({
    queryKey: ['objetivos-activos-hoy'],
    queryFn: () => getObjetivosActivos(),
  });
  const { data: usuariosAsignables = [] } = useQuery({
    queryKey: ['usuarios-asignacion-hoy'],
    queryFn: () => getUsuariosActivosParaAsignacion(),
  });

  const moverCol = useMoverColumnaMutation();

  const mutGuardarDetalle = useMutation({
    mutationFn: (input: {
      tareaId: string;
      titulo: string;
      prioridad: Tarea['prioridad'];
      descripcion: string;
      objetivo_id?: string | null;
      asignado_a?: string | null;
    }) => actualizarTarea(input),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['tareas-hoy', asignado] });
      await qc.invalidateQueries({ queryKey: ['tablero'] });
      await qc.invalidateQueries({ queryKey: ['semana'] });
    },
  });

  const mutEliminarDetalle = useMutation({
    mutationFn: (input: { tareaId: string; usuarioId: string; motivo: string }) => eliminarTareaConMotivo(input),
    onSuccess: async () => {
      setDetalleTareaId(null);
      await qc.invalidateQueries({ queryKey: ['tareas-hoy', asignado] });
      await qc.invalidateQueries({ queryKey: ['tablero'] });
    },
  });

  const { atrasadas, delDia } = useMemo(() => {
    const a: Tarea[] = [];
    const d: Tarea[] = [];
    for (const t of tareas) {
      if (t.estado === 'atrasada') a.push(t);
      else if (t.fecha_planificada === hoyYmd) d.push(t);
    }
    return { atrasadas: a, delDia: d };
  }, [tareas, hoyYmd]);

  const crearInc = useMutation({
    mutationFn: crearIncidenciaHoy,
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: [Q_INC_HOY, asignado, hoyYmd] }),
        qc.invalidateQueries({ queryKey: ['tareas-hoy', asignado, hoyYmd] }),
        qc.invalidateQueries({ queryKey: [Q_KPIS] }),
        qc.invalidateQueries({ queryKey: [Q_OBJ_PROG] }),
      ]);
    },
  });

  const mutNotaRapida = useMutation({
    mutationFn: insertarNotaBitacoraRapida,
    onSuccess: async () => {
      setNotaRapida('');
      await qc.invalidateQueries({ queryKey: [Q_NOTAS_HOY, asignado] });
      toast.success('Nota guardada');
    },
    onError: () => toast.error('No se pudo guardar la nota.'),
  });

  if (!usuario) return null;
  const me = usuario;

  const puedeEditarTarea = (t: Tarea) => me.rol === 'jefe' || t.asignado_a === me.id;

  const tareaDetalle = detalleTareaId ? tareas.find((x) => x.id === detalleTareaId) ?? null : null;

  async function iniciarTareaHoy(t: Tarea) {
    try {
      await moverCol.mutateAsync({ tareaId: t.id, nuevoEstado: 'en_progreso', usuarioActorId: me.id });
      toast.success('Tarea en progreso');
    } catch {
      toast.error('No se pudo iniciar la tarea.');
    }
  }

  async function confirmarCompletar(input: { tareaId: string; resumen: string }) {
    try {
      await completarTareaConResumen({
        tareaId: input.tareaId,
        usuarioId: me.id,
        resumen: input.resumen,
      });
      setCompletarTarea(null);
      toast.success('Tarea completada');
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['tareas-hoy', asignado] }),
        qc.invalidateQueries({ queryKey: [Q_INC_HOY, asignado, hoyYmd] }),
        qc.invalidateQueries({ queryKey: [Q_KPIS] }),
        qc.invalidateQueries({ queryKey: [Q_OBJ_PROG] }),
      ]);
    } catch {
      toast.error('No se pudo completar la tarea.');
    }
  }

  async function onConfirmarReprogramacion(input: {
    tareaId: string;
    nuevaFecha: string;
    justificacion: string;
  }) {
    try {
      await reprogramarTareaConLog({
        ...input,
        usuarioId: me.id,
      });
      toast.success('Tarea reprogramada');
      await qc.invalidateQueries({ queryKey: ['tareas-hoy', asignado] });
    } catch {
      toast.error('No se pudo reprogramar. Revisa permisos o datos.');
    }
  }

  async function onConfirmarBloqueo(input: { tareaId: string; justificacion: string }) {
    try {
      await bloquearTarea({ ...input, usuarioId: me.id });
      setBloquearTareaState(null);
      toast.success('Tarea bloqueada');
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['tareas-hoy', asignado] }),
        qc.invalidateQueries({ queryKey: ['tablero'] }),
        qc.invalidateQueries({ queryKey: ['semana'] }),
      ]);
    } catch {
      toast.error('No se pudo bloquear la tarea.');
    }
  }

  async function onCrearIncidencia(input: {
    titulo: string;
    prioridad: Tarea['prioridad'];
    descripcion: string;
    objetivo_id?: string | null;
    asignado_a: string;
  }) {
    if (!asignado) return;
    try {
      await crearInc.mutateAsync({
        titulo: input.titulo,
        prioridad: input.prioridad,
        descripcion: input.descripcion,
        asignado_a: input.asignado_a.trim() || asignado,
        creado_por: me.id,
        fecha_planificada: hoyYmd,
      });
      toast.success('Incidencia registrada');
    } catch {
      toast.error('No se pudo crear la incidencia.');
    }
  }

  function guardarNotaRapida() {
    if (!asignado || !notaRapida.trim()) return;
    mutNotaRapida.mutate({ usuario_id: asignado, contenido: notaRapida.trim(), visibilidad: 'todos' });
  }

  const colLoading = isLoading || loadInc || loadEv || loadNotas;

  return (
    <div className={APP_PAGE_CLASS}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-semibold text-[var(--mc-color-text)]" style={{ fontSize: 'var(--mc-text-lg)' }}>
            Hoy
          </h1>
          <h2 className="mt-2 text-sm font-medium text-[var(--mc-color-text-secondary)]">{fechaLocalDdMmYyyy(new Date())}</h2>
        </div>
        {esJefe && usuariosJefe && usuariosJefe.length > 0 ? (
          <label className="flex flex-col gap-1 text-xs text-[var(--mc-color-text-secondary)]">
            Miembro
            <select className="mc-input !w-auto min-w-[200px]" value={asignado} onChange={(e) => setSeleccionId(e.target.value)}>
              {usuariosJefe.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre} ({u.email})
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {isError ? <p className="text-sm text-[var(--mc-color-danger)]">No se pudieron cargar las tareas.</p> : null}

      {eventos.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--mc-color-border)] bg-[var(--mc-color-bg)] px-4 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--mc-color-text-secondary)]">Eventos</span>
          {eventos.map((ev) => (
            <span
              key={ev.id}
              className="flex items-center gap-2 rounded-full border border-[var(--mc-color-border)] bg-[var(--mc-color-bg-secondary)] px-3 py-1 text-xs text-[var(--mc-color-text)]"
            >
              <span className="text-[var(--mc-color-text-secondary)]">
                {new Date(ev.fecha_inicio).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
              </span>
              {ev.titulo}
            </span>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="mc-hoy-col">
          <div className="mc-hoy-col-head">
            <span>Tareas planificadas</span>
          </div>
          <div className="mc-hoy-col-body">
            {colLoading ? (
              <p className="p-4 text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
            ) : (
              <>
                {atrasadas.length > 0 ? (
                  <div className="border-b border-[var(--mc-color-border)]">
                    <div className="bg-[var(--mc-color-bg)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--mc-color-text-secondary)]">
                      Atrasadas
                    </div>
                    <div className="flex flex-col gap-2 p-2">
                      {atrasadas.map((t) => (
                        <TaskItem
                          key={t.id}
                          variant="week"
                          tarea={t}
                          readOnly={!puedeEditarTarea(t)}
                          estadoVisual={estadoEfectivoTablero(t, hoyYmd)}
                          onOpenDetalle={() => setDetalleTareaId(t.id)}
                          onReprogramar={puedeEditarTarea(t) ? (x) => setReprTarea(x) : undefined}
                          onBloquear={puedeEditarTarea(t) ? (x) => setBloquearTareaState(x) : undefined}
                          onCompletar={puedeEditarTarea(t) ? (x) => setCompletarTarea(x) : undefined}
                          onIniciar={puedeEditarTarea(t) ? (_x) => void iniciarTareaHoy(t) : undefined}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="min-h-0">
                  {delDia.length > 0 ? (
                    <div className="bg-[var(--mc-color-bg)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--mc-color-text-secondary)]">
                      Hoy
                    </div>
                  ) : null}
                  {delDia.length === 0 && atrasadas.length === 0 ? (
                    <p className="p-4 text-sm text-[var(--mc-color-text-secondary)]">Sin tareas planificadas.</p>
                  ) : delDia.length === 0 ? (
                    <p className="p-4 text-sm text-[var(--mc-color-text-secondary)]">Sin tareas para hoy.</p>
                  ) : (
                    <div className="flex flex-col gap-2 p-2">
                      {delDia.map((t) => (
                        <TaskItem
                          key={t.id}
                          variant="week"
                          tarea={t}
                          readOnly={!puedeEditarTarea(t)}
                          estadoVisual={estadoEfectivoTablero(t, hoyYmd)}
                          onOpenDetalle={() => setDetalleTareaId(t.id)}
                          onReprogramar={puedeEditarTarea(t) ? (x) => setReprTarea(x) : undefined}
                          onBloquear={puedeEditarTarea(t) ? (x) => setBloquearTareaState(x) : undefined}
                          onCompletar={puedeEditarTarea(t) ? (x) => setCompletarTarea(x) : undefined}
                          onIniciar={puedeEditarTarea(t) ? (_x) => void iniciarTareaHoy(t) : undefined}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </section>

        <section className="mc-hoy-col">
          <div className="mc-hoy-col-head">
            <span>Incidencias del día</span>
            <button type="button" className="mc-btn !px-3 !py-2 text-xs" onClick={() => setModalInc(true)} disabled={!asignado}>
              +
            </button>
          </div>
          <div className="mc-hoy-col-body">
            {loadInc ? (
              <p className="p-4 text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
            ) : incidenciasHist.length === 0 ? (
              <p className="p-4 text-sm text-[var(--mc-color-text-secondary)]">Sin incidencias del día.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {incidenciasHist.map((t) => (
                  <TaskItem key={t.id} variant="week" tarea={t} readOnly />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mc-hoy-col">
          <div className="mc-hoy-col-head">
            <span>Bitácora</span>
          </div>
          <div className="mc-hoy-col-body flex flex-col">
            <div className="min-h-0 flex-1">
              <div className="border-b border-[var(--mc-color-border)] bg-[var(--mc-color-bg)] px-3 py-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--mc-color-text-secondary)]">Bitácora</span>
              </div>
              <div className="flex items-center gap-2 border-b border-[var(--mc-color-border)] px-3 py-2">
                <input
                  className="mc-input flex-1 !py-2 text-sm"
                  placeholder="Nota rápida…"
                  value={notaRapida}
                  onChange={(e) => setNotaRapida(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      guardarNotaRapida();
                    }
                  }}
                />
                <button
                  type="button"
                  className="mc-btn !px-3 !py-2 text-sm font-medium"
                  disabled={!asignado || !notaRapida.trim() || mutNotaRapida.isPending}
                  onClick={guardarNotaRapida}
                  aria-label="Agregar nota"
                >
                  +
                </button>
              </div>
              {loadNotas ? (
                <p className="p-4 text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
              ) : notas.length === 0 ? (
                <p className="p-4 text-sm text-[var(--mc-color-text-secondary)]">Sin notas recientes.</p>
              ) : (
                <div className="flex flex-col gap-2 p-2">
                {notas.map((n) => (
                  <div key={n.id} className="mc-entity-card">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="mc-badge mc-badge-neutral text-[11px]">{visLabel[n.visibilidad]}</span>
                      <span className="text-xs text-[var(--mc-color-text-secondary)]">
                        {new Date(n.created_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--mc-color-text)]">{n.contenido}</p>
                  </div>
                ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <ModalReprogramar tarea={reprTarea} onClose={() => setReprTarea(null)} onConfirm={onConfirmarReprogramacion} />
      <ModalBloquear
        tarea={bloquearTareaState}
        onClose={() => setBloquearTareaState(null)}
        onConfirm={onConfirmarBloqueo}
      />
      <ModalCompletarTarea
        open={completarTarea !== null}
        tarea={completarTarea}
        onClose={() => setCompletarTarea(null)}
        onConfirm={confirmarCompletar}
      />
      <ModalNuevaTarea
        open={modalInc}
        modo="incidencia"
        fechaReferencia={hoyYmd}
        usuarioActualId={me.id}
        usuariosAsignables={usuariosAsignables}
        objetivos={objetivosActivos}
        onClose={() => setModalInc(false)}
        onSubmit={onCrearIncidencia}
      />

      <ModalDetalleTareaSemana
        open={detalleTareaId !== null}
        tarea={tareaDetalle}
        objetivos={objetivosActivos}
        usuariosAsignables={usuariosAsignables}
        readOnly={Boolean(tareaDetalle && me.rol !== 'jefe' && tareaDetalle.asignado_a !== me.id)}
        onClose={() => setDetalleTareaId(null)}
        onGuardar={async (input) => {
          await mutGuardarDetalle.mutateAsync(input);
          toast.success('Tarea actualizada');
        }}
        onEliminar={async (input) => {
          await mutEliminarDetalle.mutateAsync({ ...input, usuarioId: me.id });
          toast.success('Tarea eliminada');
        }}
      />
    </div>
  );
}
