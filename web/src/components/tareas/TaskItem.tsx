import { Flag, Lock, MoreHorizontal } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

import { useMenuPosition } from '@/hooks/useMenuPosition';
import { TAREA_BADGE, TAREA_LABEL } from '@/lib/estadoConfig';
import type { EstadoTarea, Tarea } from '@/types';

export type TaskItemVariant = 'card' | 'week' | 'kanban';

export type TaskItemProps = {
  variant: TaskItemVariant;
  tarea: Tarea;
  readOnly?: boolean;
  estadoVisual?: EstadoTarea;
  sinAccionesRapidas?: boolean;
  asignadoNombre?: string;
  objetivoTitulo?: string | null;
  dragHandle?: ReactNode;
  onOpenDetalle?: (t: Tarea) => void;
  onEditar?: (t: Tarea) => void;
  onEliminar?: (t: Tarea) => void;
  onBloquear?: (t: Tarea) => void;
  onReprogramar?: (t: Tarea) => void;
  onCompletar?: (t: Tarea) => void;
  onIniciar?: (t: Tarea) => void;
};

export function TaskItem({
  variant, tarea, readOnly = false, estadoVisual,
  sinAccionesRapidas = false, asignadoNombre, objetivoTitulo,
  dragHandle, onOpenDetalle, onEditar, onEliminar,
  onBloquear, onReprogramar, onCompletar, onIniciar,
}: TaskItemProps) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { triggerRef, menuStyle, calcularPosicion } = useMenuPosition();

  useEffect(() => {
    if (!menuAbierto) return;
    function onPointerDown(ev: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(ev.target as Node)) {
        setMenuAbierto(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [menuAbierto]);

  const est = estadoVisual ?? tarea.estado;
  const incidenciaEstatica = tarea.es_imprevisto && tarea.tipo === 'no_planificada';
  const sinQuick = sinAccionesRapidas || incidenciaEstatica;
  const estaCompletada = est === 'completada' || est === 'cancelada';

  const flagColor =
    tarea.prioridad === 'alta' ? 'var(--mc-color-danger)' :
      tarea.prioridad === 'media' ? 'var(--mc-color-warning)' :
        'var(--mc-color-text-secondary)';

  const lineThrough = est === 'completada' ? 'line-through opacity-60' : '';
  const atrasadaBar = est === 'atrasada' ? 'border-l-2 border-[var(--mc-color-danger)] pl-2' : '';

  const meta = (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--mc-color-text-secondary)]">
      <span className={`mc-badge ${TAREA_BADGE[est]}`}>{TAREA_LABEL[est]}</span>
      {asignadoNombre && <span>{asignadoNombre}</span>}
      {objetivoTitulo && <span>· {objetivoTitulo}</span>}
      {tarea.fecha_planificada && <span>· {tarea.fecha_planificada}</span>}
      {readOnly && <Lock className="inline" size={16} color="var(--mc-color-text-secondary)" aria-label="Solo lectura" />}
    </div>
  );

  const ctaPrincipal = !sinQuick && !readOnly && !estaCompletada ? (
    <>
      {(est === 'pendiente' || est === 'atrasada') && onIniciar && (
        <Button size="sm" onClick={(e) => { e.stopPropagation(); onIniciar(tarea); }}>
          Iniciar
        </Button>
      )}
      {est === 'en_progreso' && onCompletar && (
        <Button size="sm" onClick={(e) => { e.stopPropagation(); onCompletar(tarea); }}>
          Completar
        </Button>
      )}
    </>
  ) : null;

  const menuOpciones = !readOnly && !estaCompletada && (onReprogramar || onEliminar || onBloquear || onEditar) ? (
    <div
      ref={(el) => {
        menuRef.current = el;
        (triggerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      }}
      className="relative"
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        variant="ghost"
        size="xs"
        className="text-[var(--mc-color-text-secondary)]"
        aria-label="Más opciones"
        aria-expanded={menuAbierto}
        aria-haspopup="menu"
        onClick={() => { calcularPosicion(); setMenuAbierto((v) => !v); }}
      >
        <MoreHorizontal size={16} />
      </Button>
      {menuAbierto && (
        <div
          style={{ ...menuStyle, minWidth: 160 }}
          className="rounded-lg border border-[var(--mc-color-border)] bg-[var(--mc-color-bg)] py-1 shadow-sm"
          role="menu"
        >
          {onReprogramar && (
            <button type="button" className="mc-btn-ghost w-full justify-start px-3 py-2 text-xs text-[var(--mc-color-warning)]"
              role="menuitem" onClick={() => { setMenuAbierto(false); onReprogramar(tarea); }}>
              Reprogramar
            </button>
          )}
          {(est === 'pendiente' || est === 'atrasada' || est === 'en_progreso') && onBloquear && (
            <button type="button" className="mc-btn-ghost w-full justify-start px-3 py-2 text-xs text-[var(--mc-color-warning)]"
              role="menuitem" onClick={() => { setMenuAbierto(false); onBloquear(tarea); }}>
              Bloquear
            </button>
          )}
          {onEditar && (
            <button type="button" className="mc-btn-ghost w-full justify-start px-3 py-2 text-xs text-[var(--mc-color-accent)]"
              role="menuitem" onClick={() => { setMenuAbierto(false); onEditar(tarea); }}>
              Editar
            </button>
          )}
          {onEliminar && (
            <button type="button" className="mc-btn-ghost w-full justify-start px-3 py-2 text-xs text-[var(--mc-color-danger)]"
              role="menuitem" onClick={() => { setMenuAbierto(false); onEliminar(tarea); }}>
              Eliminar
            </button>
          )}
        </div>
      )}
    </div>
  ) : null;

  if (variant === 'kanban') {
    return (
      <article className={`mc-task-kanban ${readOnly ? 'opacity-70' : ''}`}
        style={{ cursor: readOnly ? 'not-allowed' : undefined }}>
        <div className="flex gap-2">
          <div
            className={`min-w-0 flex-1 ${onOpenDetalle ? 'cursor-pointer rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--mc-color-accent)]' : ''}`}
            role={onOpenDetalle ? 'button' : undefined}
            tabIndex={onOpenDetalle ? 0 : undefined}
            onClick={() => onOpenDetalle?.(tarea)}
            onKeyDown={(e) => { if (!onOpenDetalle) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDetalle(tarea); } }}
          >
            <div className={`flex items-start gap-2 ${atrasadaBar}`}>
              <h3 className={`text-sm font-medium text-[var(--mc-color-text)] ${lineThrough}`}>{tarea.titulo}</h3>
              {tarea.prioridad !== 'baja' && <Flag size={16} style={{ color: flagColor }} aria-hidden />}
            </div>
            {meta}
          </div>
          {dragHandle}
        </div>
        {ctaPrincipal && <div className="mt-2 flex flex-wrap gap-2">{ctaPrincipal}</div>}
      </article>
    );
  }

  if (variant === 'week') {
    return (
      <article className={`mc-task-item ${readOnly ? 'opacity-70' : ''} ${atrasadaBar}`}>
        {dragHandle && <div className="shrink-0 pt-0.5">{dragHandle}</div>}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div
              className={`min-w-0 flex-1 ${onOpenDetalle ? 'cursor-pointer rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--mc-color-accent)]' : ''}`}
              role={onOpenDetalle ? 'button' : undefined}
              tabIndex={onOpenDetalle ? 0 : undefined}
              onClick={() => onOpenDetalle?.(tarea)}
              onKeyDown={(e) => { if (!onOpenDetalle) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDetalle(tarea); } }}
            >
              <div className={`flex items-start gap-2 ${lineThrough}`}>
                <h3 className="text-sm font-medium text-[var(--mc-color-text)]">{tarea.titulo}</h3>
                {tarea.prioridad !== 'baja' && <Flag size={16} style={{ color: flagColor }} aria-hidden />}
              </div>
              {meta}
            </div>
            {!estaCompletada && (
              <div className="shrink-0" onClick={(e) => e.stopPropagation()}>{menuOpciones}</div>
            )}
          </div>
          {!estaCompletada && (
            <div className="mt-2" onClick={(e) => e.stopPropagation()}>{ctaPrincipal}</div>
          )}
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
        onKeyDown={(e) => { if (!onOpenDetalle) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDetalle(tarea); } }}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className={`text-sm font-medium text-[var(--mc-color-text)] ${lineThrough}`}>{tarea.titulo}</h3>
          {tarea.prioridad !== 'baja' && <Flag size={16} style={{ color: flagColor }} aria-hidden />}
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