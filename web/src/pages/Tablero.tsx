import {
  closestCorners,
  DndContext,
  type CollisionDetection,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core';

import { ColumnaKanban } from '@/components/tablero/ColumnaKanban';
import { DraggableTareaTablero } from '@/components/tablero/DraggableTareaTablero';
import { ModalDetalleTareaSemana } from '@/components/semana/ModalDetalleTareaSemana';
import { ModalCompletarTarea } from '@/components/tareas/ModalCompletarTarea';
import { ModalDesbloquear } from '@/components/tareas/ModalDesbloquear';
import { ModalJustificacion } from '@/components/tareas/ModalJustificacion';
import { useTableroPage } from '@/hooks/useTableroPage';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { TAREA_BADGE, TAREA_LABEL } from '@/lib/estadoConfig';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import type { ColumnaTableroId } from '@/api/tablero';

// ---------------------------------------------------------------------------
// Configuración de presentación
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------

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
  );

  if (!usuario) return null;

  return (
    <div className={APP_PAGE_CLASS}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="mc-page-header">
        <div>
          <h1 className="mc-page-title">Tablero</h1>
          <h2 className="mc-page-subtitle">Vista kanban</h2>
        </div>
      </header>

      {/* ── Filtros ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="mc-field">
          <label className="mc-field-label" htmlFor="tablero-usuario">Usuario</label>
          <select
            id="tablero-usuario"
            className="mc-input !w-auto min-w-[180px]"
            value={esJefe ? usuarioFiltro : usuario.id}
            onChange={(e) => setUsuarioFiltro(e.target.value as 'todos' | string)}
            disabled={!esJefe}
          >
            {esJefe && <option value="todos">Todos</option>}
            {Object.entries(nombres).map(([id, nombre]) => (
              <option key={id} value={id}>{nombre}</option>
            ))}
          </select>
        </div>
        <div className="mc-field">
          <label className="mc-field-label" htmlFor="tablero-objetivo">Objetivo</label>
          <select
            id="tablero-objetivo"
            className="mc-input !w-auto min-w-[180px]"
            value={objetivoFiltro}
            onChange={(e) => setObjetivoFiltro(e.target.value as 'todos' | string)}
          >
            <option value="todos">Todos</option>
            {objetivos.map((o) => (
              <option key={o.id} value={o.id}>{o.titulo}</option>
            ))}
          </select>
        </div>
        <div className="mc-field flex items-center !mb-0 h-[40px]">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--mc-color-text-secondary)]">
            <input
              type="checkbox"
              checked={mostrarCompletadas}
              onChange={(e) => setMostrarCompletadas(e.target.checked)}
            />
            Mostrar completadas (7 días)
          </label>
        </div>
      </div>

      {isError && <p className="text-sm text-[var(--mc-color-danger)]">Error al cargar tareas.</p>}

      {/* ── Kanban ─────────────────────────────────────────────────────── */}
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

          {/* Drag overlay */}
          <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
            {tareaDragOverlay && (() => {
              const est         = estadoEfectivoTablero(tareaDragOverlay, hoy);
              const atrasadaBar = est === 'atrasada'  ? 'border-l-2 border-[var(--mc-color-danger)]'  : '';
              const bloqueadaBar= est === 'bloqueada' ? 'border-l-2 border-[var(--mc-color-warning)]' : '';
              return (
                <div
                  className="mc-drag-overlay-card pointer-events-none max-w-[300px]"
                  style={{ transform: 'rotate(2deg)', boxShadow: '0 18px 44px -8px rgba(0,0,0,0.28)' }}
                >
                  <div className={`mc-card !p-3 flex flex-col gap-2 ${atrasadaBar} ${bloqueadaBar}`.trim()}>
                    <p className="text-xs font-medium text-[var(--mc-color-text)] leading-snug line-clamp-2">
                      {tareaDragOverlay.titulo}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`mc-badge ${TAREA_BADGE[est] ?? 'mc-badge-neutral'} text-[10px]`}>
                        {TAREA_LABEL[est] ?? est}
                      </span>
                      {nombres[tareaDragOverlay.asignado_a] && (
                        <span className="text-[10px] text-[var(--mc-color-text-secondary)]">
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

      {/* ── Modales ────────────────────────────────────────────────────── */}
      <ModalJustificacion
        open={modalJust !== null}
        titulo={modalJust?.nuevo === 'bloqueada' ? 'Bloquear tarea' : 'Mover tarea completada'}
        descripcion={
          modalJust?.nuevo === 'bloqueada'
            ? 'Indica el motivo (mínimo 10 caracteres).'
            : 'Indica la justificación del cambio de estado (mínimo 10 caracteres).'
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