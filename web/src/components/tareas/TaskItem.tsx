import { CalendarClock, Clock, Flame, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

import { PopoverMenu, type PopoverMenuItem } from '@/components/ui/PopoverMenu';
import { URGENCIA_LABEL, getEstadoStyles } from '@/lib/estadoConfig';
import { TareaEstadoIndicator } from '@/components/tareas/TareaEstadoIndicator';
import { urgenciaHoraria } from '@/lib/tareaUrgencia';
import type { ClaveVisualTarea, Tarea } from '@/types';

export type TaskItemVariant = 'card' | 'week' | 'kanban';

export type TaskItemProps = {
  variant:              TaskItemVariant;
  tarea:                Tarea;
  readOnly?:            boolean;
  estadoVisual?:        ClaveVisualTarea;
  sinAccionesRapidas?:  boolean;
  asignadoNombre?:      string;
  objetivoTitulo?:      string | null;
  dragHandle?:          ReactNode;
  /** Si true, el usuario es jefe — muestra CTAs adicionales (Eliminar) */
  esJefe?:              boolean;
  onOpenDetalle?:       (t: Tarea) => void;
  onEditar?:            (t: Tarea) => void;
  onEliminar?:          (t: Tarea) => void;
  onReprogramar?:       (t: Tarea) => void;
  onCompletar?:         (t: Tarea) => void;
  onIniciar?:           (t: Tarea) => void;
  completandoEsta?:     boolean;
  iniciandoEsta?:       boolean;
};

// ---------------------------------------------------------------------------
// TaskItem
// ---------------------------------------------------------------------------

export function TaskItem({
  variant, tarea, readOnly = false, estadoVisual,
  sinAccionesRapidas = false, asignadoNombre, objetivoTitulo,
  dragHandle,
  onOpenDetalle, onEditar, onEliminar,
  onReprogramar, onCompletar, onIniciar,
  completandoEsta = false,
  iniciandoEsta   = false,
}: TaskItemProps) {
  const est      = estadoVisual ?? tarea.estado;
  const urgencia = urgenciaHoraria(est);
  const estilos  = getEstadoStyles(est, urgencia);

  const incidenciaEstatica = tarea.es_imprevisto && tarea.tipo === 'no_planificada';
  const sinQuick           = sinAccionesRapidas || incidenciaEstatica;
  const estaCompletada     = est === 'completada' || est === 'cancelada';

  const flagColor =
    tarea.prioridad === 'critica' ? 'var(--mc-color-danger)'  :
    tarea.prioridad === 'alta'    ? 'var(--mc-color-danger)'  :
    tarea.prioridad === 'media'   ? 'var(--mc-color-warning)' :
                                    'var(--mc-color-text-secondary)';

  const lineThrough = est === 'completada' ? 'line-through opacity-60' : '';

  // ── Indicador de urgencia horaria ────────────────────────────────────────
  const urgenciaLabel = URGENCIA_LABEL[urgencia];
  const urgenciaTag = urgenciaLabel ? (
    <span
      style={{
        display:       'inline-flex',
        alignItems:    'center',
        gap:           3,
        fontSize:      10,
        fontWeight:    600,
        padding:       '1px 6px',
        borderRadius:  10,
        background:    estilos.badgeBg,
        color:          estilos.badgeFg,
        letterSpacing: '.02em',
      }}
    >
      <Clock size={9} />
      {urgenciaLabel}
    </span>
  ) : null;

  // ── Meta row ──────────────────────────────────────────────────────────────
  const textColorStyle = estilos.fg
    ? { color: estilos.fg }
    : { color: 'var(--mc-color-text-secondary)' };

  const meta = (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs" style={textColorStyle}>
      <TareaEstadoIndicator estado={est} />
      {urgenciaTag}
      {asignadoNombre && <span>{asignadoNombre}</span>}
      {objetivoTitulo && <span>· {objetivoTitulo}</span>}
      {tarea.fecha_planificada && <span>· {tarea.fecha_planificada}</span>}
    </div>
  );

  // ── CTAs principales ──────────────────────────────────────────────────────
  const ctaPrincipal = !sinQuick && !readOnly && !estaCompletada ? (
    <>
      {(est === 'pendiente' || est === 'atrasada' || est === 'reprogramada') && onIniciar && (
        <Button variant="primary" size="sm" loading={iniciandoEsta} onClick={(e) => { e.stopPropagation(); onIniciar(tarea); }}>
          Iniciar
        </Button>
      )}
      {est === 'en_progreso' && onCompletar && (
        <Button variant="primary" size="sm" loading={completandoEsta} onClick={(e) => { e.stopPropagation(); onCompletar(tarea); }}>
          Completar
        </Button>
      )}
    </>
  ) : null;

  // ── Menú de opciones ──────────────────────────────────────────────────────
  const menuItems = useMemo((): PopoverMenuItem[] => {
    const items: PopoverMenuItem[] = [];
    if (!readOnly && !estaCompletada) {
      if (onReprogramar) {
        items.push({ id: 'reprogramar', label: 'Reprogramar', icon: CalendarClock, onClick: () => onReprogramar(tarea) });
      }
      if (onEditar) {
        items.push({ id: 'editar', label: 'Editar', icon: Pencil, onClick: () => onEditar(tarea) });
      }
      if (onEliminar) {
        items.push({ id: 'eliminar', label: 'Eliminar', icon: Trash2, danger: true, onClick: () => onEliminar(tarea) });
      }
    }
    return items;
  }, [readOnly, estaCompletada, onReprogramar, onEditar, onEliminar, tarea]);

  // ── Variante KANBAN ───────────────────────────────────────────────────────
  // Usa borderLeft inline directo — igual que week y card.
  // El div absoluto anterior no funcionaba porque mc-task-kanban no tiene
  // position: relative en el CSS global.
  if (variant === 'kanban') {
    return (
      <article
        className={`mc-task-kanban ${readOnly ? 'opacity-70' : ''} ${estilos.containerClass}`}
        style={{
          borderLeft:  estilos.borderAlerta ? `3px solid ${estilos.borderAlerta}` : undefined,
          paddingLeft: estilos.borderAlerta ? 17 : undefined,     // 20px token - 3px del borde
          background:  estilos.bg ?? undefined,
          cursor:      readOnly ? 'not-allowed' : undefined,
          transition:  'background 0.2s, border-color 0.2s',
        }}
      >
        <div className="flex gap-2">
          <div
            className={`min-w-0 flex-1 ${onOpenDetalle ? 'cursor-pointer rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--mc-color-accent)]' : ''}`}
            role={onOpenDetalle ? 'button' : undefined}
            tabIndex={onOpenDetalle ? 0 : undefined}
            onClick={() => onOpenDetalle?.(tarea)}
            onKeyDown={(e) => { if (!onOpenDetalle) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDetalle(tarea); } }}
          >
            <div className="flex items-start gap-2">
              <h3
                className={`text-sm font-medium ${lineThrough}`}
                style={{ color: estilos.fg || 'var(--mc-color-text)' }}
              >
                {tarea.titulo}
              </h3>
              {tarea.prioridad === 'critica' && (
                <Flame size={14} style={{ color: flagColor, flexShrink: 0 }} aria-hidden />
              )}
            </div>
            {meta}
          </div>
          {dragHandle}
        </div>
        {ctaPrincipal && <div className="mt-2 flex flex-wrap gap-2">{ctaPrincipal}</div>}
      </article>
    );
  }

  // ── Variante WEEK ─────────────────────────────────────────────────────────
  // Meta reducido: solo estado + urgencia. Asignado/objetivo/fecha van al detalle.
  const metaWeek = est !== 'pendiente' || urgenciaTag ? (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs" style={textColorStyle}>
      {est !== 'pendiente' && <TareaEstadoIndicator estado={est} />}
      {urgenciaTag}
    </div>
  ) : null;

  if (variant === 'week') {
    return (
      <article
        className={`mc-task-item ${readOnly ? 'opacity-70' : ''} ${estilos.containerClass}`}
        style={{
          borderLeft:   estilos.borderAlerta ? `3px solid ${estilos.borderAlerta}` : undefined,
          paddingLeft:  estilos.borderAlerta ? 17 : undefined,
          background:   estilos.bg ?? undefined,
          borderRadius: 'var(--mc-radius-md)',
          transition:   'background 0.2s, border-color 0.2s',
        }}
      >
        {dragHandle && <div className="shrink-0 pt-0.5">{dragHandle}</div>}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div
              className={`min-w-0 flex-1 ${onOpenDetalle ? 'cursor-pointer rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--mc-color-accent)]' : ''}`}
              role={onOpenDetalle ? 'button' : undefined}
              tabIndex={onOpenDetalle ? 0 : undefined}
              onClick={() => onOpenDetalle?.(tarea)}
              onKeyDown={(e) => {
                if (!onOpenDetalle) return;
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDetalle(tarea); }
              }}
            >
              <div className={`flex items-start gap-1.5 ${lineThrough}`}>
                <h3
                  className="text-sm font-medium leading-snug"
                  style={{ color: estilos.fg || 'var(--mc-color-text)' }}
                >
                  {tarea.titulo}
                </h3>
                {tarea.prioridad === 'critica' && (
                  <Flame size={12} style={{ color: flagColor, flexShrink: 0, marginTop: 3 }} aria-hidden />
                )}
              </div>
              {metaWeek}
            </div>
            {!estaCompletada && (
              <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                <PopoverMenu
                  items={menuItems}
                  trigger={
                    <button
                      type="button"
                      className="mc-semana-task-card__menu-trigger"
                      aria-label="Más opciones"
                      style={{ color: estilos.fg || 'var(--mc-color-text-secondary)' }}
                    >
                      <MoreHorizontal size={16} aria-hidden />
                    </button>
                  }
                />
              </div>
            )}
          </div>
          {!estaCompletada && (
            <div className="mt-2" onClick={(e) => e.stopPropagation()}>{ctaPrincipal}</div>
          )}
        </div>
      </article>
    );
  }

  // ── Variante CARD (default) ───────────────────────────────────────────────
  return (
    <article
      className={`mc-task-card ${estilos.containerClass}`}
      style={{
        borderLeft:  estilos.borderAlerta ? `3px solid ${estilos.borderAlerta}` : undefined,
        paddingLeft: estilos.borderAlerta ? 17 : undefined,       // 20px token - 3px del borde
        background:  estilos.bg ?? undefined,
        transition:  'background 0.2s, border-color 0.2s',
      }}
    >
      <div
        role={onOpenDetalle ? 'button' : undefined}
        tabIndex={onOpenDetalle ? 0 : undefined}
        className={onOpenDetalle ? 'cursor-pointer rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--mc-color-accent)]' : ''}
        onClick={() => onOpenDetalle?.(tarea)}
        onKeyDown={(e) => { if (!onOpenDetalle) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDetalle(tarea); } }}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3
            className={`text-sm font-medium ${lineThrough}`}
            style={{ color: estilos.fg || 'var(--mc-color-text)' }}
          >
            {tarea.titulo}
          </h3>
          {tarea.prioridad === 'critica' && (
            <Flame size={14} style={{ color: flagColor }} aria-hidden />
          )}
        </div>
        {tarea.descripcion && (
          <p className="mt-1 line-clamp-2 text-xs text-[var(--mc-color-text-secondary)]">{tarea.descripcion}</p>
        )}
        {meta}
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        {ctaPrincipal && <div className="mt-2 flex flex-wrap gap-2">{ctaPrincipal}</div>}
      </div>
    </article>
  );
}
