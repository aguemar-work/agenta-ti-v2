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

import { MIN_JUSTIFICACION_CHARS } from '@/lib/constants';

import { ColumnaKanban } from '@/components/tablero/ColumnaKanban';
import { DraggableTareaTablero } from '@/components/tablero/DraggableTareaTablero';
import { ModalDetalleTareaSemana } from '@/components/semana/ModalDetalleTareaSemana';
import { ModalCompletarTarea } from '@/components/tareas/ModalCompletarTarea';
import { ModalDesbloquear } from '@/components/tareas/ModalDesbloquear';
import { ModalJustificacion } from '@/components/tareas/ModalJustificacion';
import { CheckSquare, Square } from 'lucide-react';
import { useTableroPage } from '@/hooks/useTableroPage';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { FilterBar } from '@/components/ui/FilterBar';
import { PageHeader } from '@/components/layout/PageHeader';
import { TAREA_BADGE, TAREA_LABEL } from '@/lib/estadoConfig';
import type { ColumnaTableroId } from '@/api/tablero';

const COLUMNAS: ColumnaTableroId[] = ['pendiente', 'en_progreso', 'bloqueada', 'completada'];

const collisionTablero: CollisionDetection = (args) => {
  const ptr    = pointerWithin(args);
  const colPtr = ptr.find((c) => String(c.id).startsWith('col:'));
  if (colPtr) return [colPtr];
  const corners = closestCorners(args);
  const col     = corners.find((c) => String(c.id).startsWith('col:'));
  if (col) return [col];
  return corners;
};

export function Tablero() {
  const {
    usuario, esJefe, hoy,
    usuarioFiltro, setUsuarioFiltro,
    objetivoFiltro, setObjetivoFiltro,
    mostrarCompletadas, setMostrarCompletadas,
    columnas, isLoading, isError,
    objetivos, nombres, usuariosAsignables,
    tareaDragOverlay, tareaDetalle,
    activeDragId, setActiveDragId, overColId,
    onDragOver, onDragEnd,
    modalJust,        setModalJust,
    detalleTareaId,   setDetalleTareaId,
    completarTarea,   setCompletarTarea,
    desbloquearTarea, setDesbloquearTarea,
    puedeGestionar,
    confirmarJustificacion, confirmarDesbloqueo,
    confirmarCompletar, iniciarDesdeTablero,
    guardarDetalle, eliminarDetalle,
  } = useTableroPage();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  if (!usuario) return null;

  // Conteo de atrasadas para el badge en la columna pendiente
  const atrasadasEnPendiente = (columnas['pendiente'] ?? []).filter(
    (t) => t.estado === 'atrasada'
  ).length;

  return (
    <div className={APP_PAGE_CLASS}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <PageHeader
        title="Tablero"
        actions={
          <FilterBar>
            {esJefe && (
              <FilterBar.Select
                id="tablero-usuario"
                label="Miembro"
                value={usuarioFiltro}
                onChange={(v) => setUsuarioFiltro(v as 'todos' | string)}
                options={[
                  { value: 'todos', label: 'Todos' },
                  ...Object.entries(nombres).map(([id, nombre]) => ({ value: id, label: nombre })),
                ]}
              />
            )}
            <FilterBar.Select
              id="tablero-objetivo"
              label="Objetivo"
              value={objetivoFiltro}
              onChange={(v) => setObjetivoFiltro(v as 'todos' | string)}
              options={[
                { value: 'todos', label: 'Todos' },
                ...objetivos.map((o) => ({ value: o.id, label: o.titulo })),
              ]}
            />
            <FilterBar.Action
              onClick={() => setMostrarCompletadas((v) => !v)}
              active={mostrarCompletadas}
              variant="toggle"
              title={mostrarCompletadas
                ? 'Mostrando completadas de los últimos 7 días'
                : 'Mostrar tareas completadas (últimos 7 días)'}
            >
              {mostrarCompletadas
                ? <><CheckSquare size={13} aria-hidden /> Completadas <span style={{ opacity: 0.65, fontSize: 11 }}>(últ. 7 días)</span></>
                : <><Square size={13} aria-hidden /> Completadas</>}
            </FilterBar.Action>
          </FilterBar>
        }
      />

      {isError && (
        <p style={{ fontSize: 13, color: 'var(--mc-color-danger)', margin: '0 0 12px' }}>
          Error al cargar tareas.
        </p>
      )}

      {/* ── Kanban ──────────────────────────────────────────────────────── */}
      <DndContext
        sensors={sensors}
        collisionDetection={collisionTablero}
        onDragStart={(e) => setActiveDragId(String(e.active.id))}
        onDragOver={onDragOver}
        onDragCancel={() => { setActiveDragId(null); }}
        onDragEnd={(e) => void onDragEnd(e)}
      >
        <div className="flex min-h-0 flex-col gap-4">
          {isLoading && (
            <div className="mc-empty">
              <p className="mc-empty-title">Cargando tablero…</p>
            </div>
          )}
          <div className="min-h-0 overflow-x-auto">
            <div className="mc-kanban-board min-w-[960px]">
              {COLUMNAS.map((col) => (
                <ColumnaKanban
                  key={col}
                  columna={col}
                  count={(columnas[col] ?? []).length}
                  showPlaceholder={Boolean(activeDragId && overColId === `col:${col}`)}
                  atrasadasCount={col === 'pendiente' ? atrasadasEnPendiente : 0}
                >
                  {(columnas[col] ?? []).map((t) => (
                    <DraggableTareaTablero
                      key={t.id}
                      tarea={t}
                      hoyYmd={hoy}
                      canDrag={puedeGestionar(t)}
                      esJefe={esJefe}
                      asignadoNombre={nombres[t.asignado_a]}
                      onOpenDetalle={() => setDetalleTareaId(t.id)}
                      onIniciar={() => void iniciarDesdeTablero(t)}
                      onCompletar={() => setCompletarTarea(t)}
                      onBloquear={() => setModalJust({ tareaId: t.id, nuevo: 'bloqueada' })}
                      onDesbloquear={esJefe ? () => setDesbloquearTarea(t) : undefined}
                    />
                  ))}
                </ColumnaKanban>
              ))}
            </div>
          </div>

          {/* ── Drag overlay ──────────────────────────────────────────────── */}
          <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
            {tareaDragOverlay && (() => {
              const est         = tareaDragOverlay.estado;
              const borderColor = est === 'atrasada' ? '#E24B4A' :
                                  est === 'bloqueada' ? '#EF9F27' : 'transparent';
              return (
                <div
                  className="mc-drag-overlay-card pointer-events-none max-w-[300px]"
                  style={{ transform: 'rotate(2deg)', boxShadow: '0 18px 44px -8px rgba(0,0,0,0.28)' }}
                >
                  <div
                    className="mc-card !p-3 flex flex-col gap-2"
                    style={{
                      borderLeft:  `3px solid ${borderColor}`,
                      paddingLeft: borderColor !== 'transparent' ? 10 : undefined,
                    }}
                  >
                    <p className="text-xs font-medium text-[var(--mc-color-text)] leading-snug line-clamp-2">
                      {tareaDragOverlay.titulo}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`mc-badge ${TAREA_BADGE[est] ?? 'mc-badge-neutral'}`} style={{ fontSize: 10 }}>
                        {TAREA_LABEL[est] ?? est}
                      </span>
                      {nombres[tareaDragOverlay.asignado_a] && (
                        <span style={{ fontSize: 10, color: 'var(--mc-color-text-secondary)' }}>
                          {nombres[tareaDragOverlay.asignado_a]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </DragOverlay>
        </div>
      </DndContext>

      {/* ── Modales ─────────────────────────────────────────────────────── */}
      <ModalJustificacion
        open={modalJust !== null}
        titulo={modalJust?.nuevo === 'bloqueada' ? 'Bloquear tarea' : 'Mover tarea completada'}
        descripcion={
          modalJust?.nuevo === 'bloqueada'
            ? `Indica el motivo (mínimo ${MIN_JUSTIFICACION_CHARS} caracteres).`
            : `Indica la justificación del cambio de estado (mínimo ${MIN_JUSTIFICACION_CHARS} caracteres).`
        }
        onClose={() => setModalJust(null)}
        onConfirm={confirmarJustificacion}
      />
      <ModalDesbloquear
        tarea={desbloquearTarea}
        onClose={() => setDesbloquearTarea(null)}
        onConfirm={confirmarDesbloqueo}
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
        readOnly={!tareaDetalle || (usuario.rol !== 'jefe' && tareaDetalle.asignado_a !== usuario.id)}
        onClose={() => setDetalleTareaId(null)}
        onGuardar={guardarDetalle}
        onEliminar={eliminarDetalle}
      />
    </div>
  );
}