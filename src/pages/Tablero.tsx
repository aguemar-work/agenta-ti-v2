import {
  closestCorners,
  DndContext,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import type { ColumnaTableroId, FiltrosTablero } from '@/api/tablero';
import { eliminarTareaConMotivo, actualizarTarea } from '@/api/semana';
import { snapTareaFechaAlPorHacer } from '@/api/tablero';
import { getUsuariosActivosParaAsignacion } from '@/api/usuarios';
import { ColumnaKanban } from '@/components/tablero/ColumnaKanban';
import { DraggableTareaTablero } from '@/components/tablero/DraggableTareaTablero';
import { ModalDetalleTareaSemana } from '@/components/semana/ModalDetalleTareaSemana';
import { ModalCompletarTarea } from '@/components/tareas/ModalCompletarTarea';
import { ModalJustificacion } from '@/components/tareas/ModalJustificacion';
import { TaskItem } from '@/components/tareas/TaskItem';
import { agruparTareasTablero, useMoverColumnaMutation, useObjetivosTablero, useTareasTableroQuery, useUsuariosNombreTablero } from '@/hooks/useTablero';
import { completarTareaConResumen } from '@/hooks/useTareas';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { fechaLocalYmd } from '@/lib/fecha';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import { useAuthStore } from '@/store/authStore';
import type { EstadoTarea, Tarea } from '@/types';

const COLUMNAS: ColumnaTableroId[] = ['pendiente', 'en_progreso', 'bloqueada', 'completada'];

const collisionTablero: CollisionDetection = (args) => {
  const ptr = pointerWithin(args);
  const colPtr = ptr.find((c) => String(c.id).startsWith('col:'));
  if (colPtr) return [colPtr];
  const corners = closestCorners(args);
  const col = corners.find((c) => String(c.id).startsWith('col:'));
  if (col) return [col];
  return corners;
};

export function Tablero() {
  const qc = useQueryClient();
  const usuario = useAuthStore((s) => s.usuario);
  const esJefe = usuario?.rol === 'jefe';

  const [usuarioFiltro, setUsuarioFiltro] = useState<string | 'todos'>('todos');
  const [objetivoFiltro, setObjetivoFiltro] = useState<string | 'todos'>('todos');
  const [mostrarCompletadas, setMostrarCompletadas] = useState(false);
  const [modalJust, setModalJust] = useState<{ tareaId: string; nuevo: EstadoTarea } | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [overColId, setOverColId] = useState<string | null>(null);
  const [detalleTareaId, setDetalleTareaId] = useState<string | null>(null);
  const [completarTarea, setCompletarTarea] = useState<Tarea | null>(null);

  const filtros: FiltrosTablero = useMemo(() => {
    return {
      usuarioId: esJefe ? usuarioFiltro : (usuario?.id ?? ''),
      objetivoId: objetivoFiltro,
      mostrarCompletadas,
    };
  }, [esJefe, usuarioFiltro, objetivoFiltro, mostrarCompletadas, usuario?.id]);

  const { data: tareas = [], isLoading, isError } = useTareasTableroQuery(filtros, Boolean(usuario?.id));
  const { data: objetivos = [] } = useObjetivosTablero();
  const { data: nombres = {} } = useUsuariosNombreTablero();
  const { data: usuariosAsignables = [] } = useQuery({
    queryKey: ['usuarios-asignacion-tablero'],
    queryFn: () => getUsuariosActivosParaAsignacion(),
  });
  const mover = useMoverColumnaMutation();

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
      await qc.invalidateQueries({ queryKey: ['tablero'] });
      await qc.invalidateQueries({ queryKey: ['semana'] });
      await qc.invalidateQueries({ queryKey: ['tareas-hoy'] });
    },
  });

  const mutEliminar = useMutation({
    mutationFn: (input: { tareaId: string; usuarioId: string; motivo: string }) => eliminarTareaConMotivo(input),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['tablero'] });
      setDetalleTareaId(null);
    },
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 10 } }));

  const hoy = fechaLocalYmd(new Date());
  const columnas = useMemo(() => agruparTareasTablero(tareas, hoy), [tareas, hoy]);

  const objetivoTitulo = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of objetivos) m.set(o.id, o.titulo);
    return m;
  }, [objetivos]);

  const tareaDragOverlay = useMemo(() => {
    if (!activeDragId) return null;
    const tid = String(activeDragId).replace('kanban-', '');
    return tareas.find((x) => x.id === tid) ?? null;
  }, [activeDragId, tareas]);

  const tareaDetalle = useMemo(() => (detalleTareaId ? tareas.find((x) => x.id === detalleTareaId) ?? null : null), [detalleTareaId, tareas]);

  if (!usuario) return null;
  const me = usuario;

  function puedeGestionar(t: Tarea): boolean {
    return me.rol === 'jefe' || t.asignado_a === me.id;
  }

  function onDragOver(ev: DragOverEvent) {
    const o = ev.over?.id;
    setOverColId(o && String(o).startsWith('col:') ? String(o) : null);
  }

  async function onDragEnd(ev: DragEndEvent) {
    const { active, over } = ev;
    setActiveDragId(null);
    setOverColId(null);
    if (!over || !active.id) return;
    const tid = String(active.id).replace('kanban-', '');
    const t = tareas.find((x) => x.id === tid);
    if (!t) return;
    const m = /^col:(.+)$/.exec(String(over.id));
    if (!m) return;
    const nuevo = m[1] as ColumnaTableroId;
    const actual = estadoEfectivoTablero(t, hoy);
    if (!puedeGestionar(t)) return;

    if (nuevo === actual) return;

    if (nuevo === 'completada') {
      setCompletarTarea(t);
      return;
    }

    if (nuevo === 'pendiente' && actual === 'atrasada') {
      try {
        await snapTareaFechaAlPorHacer(tid, hoy);
        await qc.invalidateQueries({ queryKey: ['tablero'] });
        await qc.invalidateQueries({ queryKey: ['semana'] });
        await qc.invalidateQueries({ queryKey: ['tareas-hoy'] });
        toast.success('Tarea reubicada en el día actual');
      } catch {
        toast.error('No se pudo actualizar la tarea.');
      }
      return;
    }

    if (nuevo === 'bloqueada') {
      setModalJust({ tareaId: tid, nuevo: 'bloqueada' });
      return;
    }

    try {
      await mover.mutateAsync({ tareaId: tid, nuevoEstado: nuevo as EstadoTarea, usuarioActorId: me.id });
    } catch {
      toast.error('No se pudo actualizar el estado.');
    }
  }

  async function confirmarJustificacion(just: string) {
    if (!modalJust) return;
    try {
      await mover.mutateAsync({
        tareaId: modalJust.tareaId,
        nuevoEstado: modalJust.nuevo,
        usuarioActorId: me.id,
        justificacion: just,
      });
      setModalJust(null);
    } catch {
      toast.error('No se pudo guardar.');
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
      await qc.invalidateQueries({ queryKey: ['tablero'] });
      await qc.invalidateQueries({ queryKey: ['semana'] });
      await qc.invalidateQueries({ queryKey: ['tareas-hoy'] });
    } catch {
      toast.error('No se pudo completar la tarea.');
    }
  }

  async function iniciarDesdeTablero(t: Tarea) {
    try {
      await mover.mutateAsync({ tareaId: t.id, nuevoEstado: 'en_progreso', usuarioActorId: me.id });
      toast.success('Tarea en progreso');
    } catch {
      toast.error('No se pudo iniciar la tarea.');
    }
  }

  return (
    <div className={APP_PAGE_CLASS}>
      <div>
        <h1 className="font-semibold text-[var(--mc-color-text)]" style={{ fontSize: 'var(--mc-text-lg)' }}>
          Tablero
        </h1>
        <h2 className="mt-2 text-sm font-medium text-[var(--mc-color-text-secondary)]">Vista kanban</h2>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-xs text-[var(--mc-color-text-secondary)]">
          Usuario
          <select
            className="mc-input !w-auto min-w-[180px]"
            value={esJefe ? usuarioFiltro : me.id}
            onChange={(e) => setUsuarioFiltro(e.target.value as 'todos' | string)}
            disabled={!esJefe}
          >
            {esJefe ? <option value="todos">Todos</option> : null}
            {Object.entries(nombres).map(([id, nombre]) => (
              <option key={id} value={id}>
                {nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--mc-color-text-secondary)]">
          Objetivo
          <select
            className="mc-input !w-auto min-w-[180px]"
            value={objetivoFiltro}
            onChange={(e) => setObjetivoFiltro(e.target.value as 'todos' | string)}
          >
            <option value="todos">Todos</option>
            {objetivos.map((o) => (
              <option key={o.id} value={o.id}>
                {o.titulo}
              </option>
            ))}
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--mc-color-text-secondary)]">
          <input type="checkbox" checked={mostrarCompletadas} onChange={(e) => setMostrarCompletadas(e.target.checked)} />
          Mostrar completadas (7 días)
        </label>
      </div>

      {isError ? <p className="text-sm text-[var(--mc-color-danger)]">Error al cargar tareas.</p> : null}

      <DndContext
        sensors={sensors}
        collisionDetection={collisionTablero}
        onDragStart={(e) => setActiveDragId(String(e.active.id))}
        onDragOver={onDragOver}
        onDragCancel={() => {
          setActiveDragId(null);
          setOverColId(null);
        }}
        onDragEnd={(e) => void onDragEnd(e)}
      >
        <div className="flex min-h-0 flex-col gap-4">
          {isLoading ? <p className="text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p> : null}
          <div className="min-h-0 overflow-x-auto">
            <div className="mc-kanban-board min-w-[960px]">
              {COLUMNAS.map((col) => (
                <ColumnaKanban
                  key={col}
                  columna={col}
                  showPlaceholder={Boolean(activeDragId && overColId === `col:${col}`)}
                >
                  {(columnas[col] ?? []).map((t) => (
                    <DraggableTareaTablero
                      key={t.id}
                      tarea={t}
                      hoyYmd={hoy}
                      canDrag={puedeGestionar(t)}
                      asignadoNombre={nombres[t.asignado_a]}
                      objetivoTitulo={t.objetivo_id ? objetivoTitulo.get(t.objetivo_id) ?? null : null}
                      onOpenDetalle={() => setDetalleTareaId(t.id)}
                      onIniciar={() => void iniciarDesdeTablero(t)}
                      onCompletar={() => setCompletarTarea(t)}
                    />
                  ))}
                </ColumnaKanban>
              ))}
            </div>
          </div>
          <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
            {tareaDragOverlay ? (
              <div className="mc-drag-overlay-card pointer-events-none max-w-[300px]">
                <TaskItem
                  variant="kanban"
                  tarea={tareaDragOverlay}
                  readOnly
                  estadoVisual={estadoEfectivoTablero(tareaDragOverlay, hoy)}
                  asignadoNombre={nombres[tareaDragOverlay.asignado_a]}
                  objetivoTitulo={
                    tareaDragOverlay.objetivo_id ? objetivoTitulo.get(tareaDragOverlay.objetivo_id) ?? null : null
                  }
                />
              </div>
            ) : null}
          </DragOverlay>
        </div>
      </DndContext>

      <ModalJustificacion
        open={modalJust !== null}
        titulo="Bloquear tarea"
        descripcion="Indica el motivo (mínimo 10 caracteres)."
        onClose={() => setModalJust(null)}
        onConfirm={confirmarJustificacion}
      />

      <ModalCompletarTarea
        open={completarTarea !== null}
        tarea={completarTarea}
        onClose={() => setCompletarTarea(null)}
        onConfirm={confirmarCompletar}
      />

      <ModalDetalleTareaSemana
        open={detalleTareaId !== null}
        tarea={tareaDetalle}
        objetivos={objetivos}
        usuariosAsignables={usuariosAsignables}
        readOnly={!tareaDetalle || (me.rol !== 'jefe' && tareaDetalle.asignado_a !== me.id)}
        onClose={() => setDetalleTareaId(null)}
        onGuardar={async (input) => {
          await mutGuardarDetalle.mutateAsync(input);
          toast.success('Tarea actualizada');
        }}
        onEliminar={async (input) => {
          await mutEliminar.mutateAsync({ ...input, usuarioId: me.id });
          toast.success('Tarea eliminada');
        }}
      />
    </div>
  );
}
