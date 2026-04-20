import { Flag, Lock } from 'lucide-react';
import type { ReactNode } from 'react';

import type { EstadoTarea, Tarea } from '@/types';

const estadoLabel: Record<EstadoTarea, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  completada: 'Completada',
  bloqueada: 'Bloqueada',
  atrasada: 'Atrasada',
  cancelada: 'Cancelada',
};

const estadoBadge: Record<EstadoTarea, string> = {
  pendiente: 'mc-badge-neutral',
  en_progreso: 'mc-badge-neutral',
  completada: 'mc-badge-success',
  bloqueada: 'mc-badge-warning',
  atrasada: 'mc-badge-danger',
  cancelada: 'mc-badge-neutral',
};

export type TaskItemVariant = 'card' | 'week' | 'kanban';

export type TaskItemProps = {
  variant: TaskItemVariant;
  tarea: Tarea;
  readOnly?: boolean;
  /** Estado mostrado (p. ej. efectivo en tablero); por defecto `tarea.estado`. */
  estadoVisual?: EstadoTarea;
  /** Oculta Iniciar/Completar (p. ej. incidencias como registro). */
  sinAccionesRapidas?: boolean;
  asignadoNombre?: string;
  objetivoTitulo?: string | null;
  dragHandle?: ReactNode;
  onOpenDetalle?: (t: Tarea) => void;
  onEditar?: (t: Tarea) => void;
  onEliminar?: (t: Tarea) => void;
  onReprogramar?: (t: Tarea) => void;
  onCompletar?: (t: Tarea) => void;
  onIniciar?: (t: Tarea) => void;
};

export function TaskItem({
  variant,
  tarea,
  readOnly = false,
  estadoVisual,
  sinAccionesRapidas = false,
  asignadoNombre,
  objetivoTitulo,
  dragHandle,
  onOpenDetalle,
  onEditar,
  onEliminar,
  onReprogramar,
  onCompletar,
  onIniciar,
}: TaskItemProps) {
  const est = estadoVisual ?? tarea.estado;
  const incidenciaEstatica = tarea.es_imprevisto && tarea.tipo === 'no_planificada';
  const sinQuick = sinAccionesRapidas || incidenciaEstatica;

  const flagColor =
    tarea.prioridad === 'alta'
      ? 'var(--mc-color-danger)'
      : tarea.prioridad === 'media'
        ? 'var(--mc-color-warning)'
        : 'var(--mc-color-text-secondary)';

  const lineThrough = est === 'completada' ? 'line-through opacity-60' : '';
  const atrasadaBar = est === 'atrasada' ? 'border-l-2 border-[var(--mc-color-danger)] pl-2' : '';

  const meta = (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--mc-color-text-secondary)]">
      <span className={`mc-badge ${estadoBadge[est]}`}>{estadoLabel[est]}</span>
      {asignadoNombre ? <span>{asignadoNombre}</span> : null}
      {objetivoTitulo ? <span>· {objetivoTitulo}</span> : null}
      {tarea.fecha_planificada ? <span>· {tarea.fecha_planificada}</span> : null}
      {readOnly ? <Lock className="inline" size={16} color="var(--mc-color-text-secondary)" aria-label="Solo lectura" /> : null}
    </div>
  );

  const quickAcciones =
    !sinQuick && !readOnly && (onIniciar || onCompletar) && est !== 'completada' && est !== 'cancelada' ? (
      <div className="mt-2 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
        {(est === 'pendiente' || est === 'atrasada') && onIniciar ? (
          <button type="button" className="mc-btn !px-3 !py-2 text-xs" onClick={() => onIniciar(tarea)}>
            Iniciar
          </button>
        ) : null}
        {est === 'en_progreso' && onCompletar ? (
          <button type="button" className="mc-btn !px-3 !py-2 text-xs" onClick={() => onCompletar(tarea)}>
            Completar
          </button>
        ) : null}
      </div>
    ) : null;

  const repr =
    !readOnly && est === 'atrasada' && onReprogramar ? (
      <button
        type="button"
        className="mc-btn-ghost mt-2 px-0 text-xs font-medium !text-[var(--mc-color-accent)]"
        onClick={(e) => {
          e.stopPropagation();
          onReprogramar(tarea);
        }}
      >
        Reprogramar…
      </button>
    ) : null;

  const cuerpoClicable = (childrenTitle: ReactNode) => (
    <div
      role={onOpenDetalle ? 'button' : undefined}
      tabIndex={onOpenDetalle ? 0 : undefined}
      className={onOpenDetalle ? 'cursor-pointer rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--mc-color-accent)]' : ''}
      onClick={() => onOpenDetalle?.(tarea)}
      onKeyDown={(e) => {
        if (!onOpenDetalle) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenDetalle(tarea);
        }
      }}
    >
      {childrenTitle}
      {meta}
    </div>
  );

  if (variant === 'kanban') {
    return (
      <article
        className={`mc-task-kanban ${readOnly ? 'opacity-70' : ''}`}
        style={{ cursor: readOnly ? 'not-allowed' : undefined }}
      >
        <div className="flex gap-2">
          <div
            className={`min-w-0 flex-1 ${onOpenDetalle ? 'cursor-pointer rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--mc-color-accent)]' : ''}`}
            role={onOpenDetalle ? 'button' : undefined}
            tabIndex={onOpenDetalle ? 0 : undefined}
            onClick={() => onOpenDetalle?.(tarea)}
            onKeyDown={(e) => {
              if (!onOpenDetalle) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenDetalle(tarea);
              }
            }}
          >
            <div className={`flex items-start gap-2 ${atrasadaBar}`}>
              <h3 className={`text-sm font-medium text-[var(--mc-color-text)] ${lineThrough}`}>{tarea.titulo}</h3>
              {tarea.prioridad !== 'baja' ? <Flag size={16} style={{ color: flagColor }} aria-hidden /> : null}
            </div>
            {meta}
          </div>
          {dragHandle}
        </div>
        {quickAcciones}
      </article>
    );
  }

  if (variant === 'week') {
    return (
      <article className={`mc-task-item ${readOnly ? 'opacity-70' : ''} ${atrasadaBar}`}>
        {dragHandle ? <div className="shrink-0 pt-0.5">{dragHandle}</div> : null}
        <div className="min-w-0 flex-1">
          {cuerpoClicable(
            <div className={`flex items-start gap-2 ${lineThrough}`}>
              <h3 className="text-sm font-medium text-[var(--mc-color-text)]">{tarea.titulo}</h3>
              {tarea.prioridad !== 'baja' ? <Flag size={16} style={{ color: flagColor }} aria-hidden /> : null}
            </div>,
          )}
          {quickAcciones}
          {!readOnly && (onEditar || onEliminar) ? (
            <div className="mt-2 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
              {onEditar ? (
                <button
                  type="button"
                  className="mc-btn-ghost px-0 text-xs font-medium !text-[var(--mc-color-accent)]"
                  onClick={() => onEditar(tarea)}
                >
                  Editar
                </button>
              ) : null}
              {onEliminar ? (
                <button
                  type="button"
                  className="mc-btn-ghost px-0 text-xs font-medium !text-[var(--mc-color-danger)]"
                  onClick={() => onEliminar(tarea)}
                >
                  Eliminar
                </button>
              ) : null}
            </div>
          ) : null}
          {repr}
        </div>
      </article>
    );
  }

  return (
    <article className={`mc-task-card ${atrasadaBar}`}>
      <div
        role={onOpenDetalle ? 'button' : undefined}
        tabIndex={onOpenDetalle ? 0 : undefined}
        className={onOpenDetalle ? 'cursor-pointer rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--mc-color-accent)]' : ''}
        onClick={() => onOpenDetalle?.(tarea)}
        onKeyDown={(e) => {
          if (!onOpenDetalle) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenDetalle(tarea);
          }
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className={`text-sm font-medium text-[var(--mc-color-text)] ${lineThrough}`}>{tarea.titulo}</h3>
          {tarea.prioridad !== 'baja' ? <Flag size={16} style={{ color: flagColor }} aria-hidden /> : null}
        </div>
        {tarea.descripcion ? (
          <p className="mt-1 line-clamp-2 text-xs text-[var(--mc-color-text-secondary)]">{tarea.descripcion}</p>
        ) : null}
        {meta}
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        {quickAcciones}
        {repr}
      </div>
    </article>
  );
}
