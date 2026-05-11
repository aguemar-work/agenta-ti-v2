import { Clock, Flag, Lock, MoreHorizontal } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

import { useMenuPosition } from '@/hooks/useMenuPosition';
import { TAREA_BADGE, TAREA_LABEL, URGENCIA_LABEL, STATE_TOKENS, URGENCIA_TOKENS } from '@/lib/estadoConfig';
import { urgenciaHoraria } from '@/lib/tareaUrgencia';
import type { EstadoTarea, Tarea, UrgenciaHoraria } from '@/types';

export type TaskItemVariant = 'card' | 'week' | 'kanban';

export type TaskItemProps = {
  variant:              TaskItemVariant;
  tarea:                Tarea;
  readOnly?:            boolean;
  estadoVisual?:        EstadoTarea;
  sinAccionesRapidas?:  boolean;
  asignadoNombre?:      string;
  objetivoTitulo?:      string | null;
  dragHandle?:          ReactNode;
  /** Si true, el usuario es jefe — muestra CTAs adicionales (Eliminar) */
  esJefe?:              boolean;
  onOpenDetalle?:       (t: Tarea) => void;
  onEditar?:            (t: Tarea) => void;
  onEliminar?:          (t: Tarea) => void;
  onBloquear?:          (t: Tarea) => void;
  onReprogramar?:       (t: Tarea) => void;
  onCompletar?:         (t: Tarea) => void;
  onIniciar?:           (t: Tarea) => void;
};

// ---------------------------------------------------------------------------
// Helpers de estilo por urgencia
// ---------------------------------------------------------------------------

/**
 * Devuelve el color del borde izquierdo de alerta, o null si no hay alerta.
 * Usado de forma uniforme en las tres variantes.
 */
function borderColorAlerta(urgencia: UrgenciaHoraria, est: EstadoTarea): string | null {
  if (est === 'atrasada')          return STATE_TOKENS.atrasada.border;
  if (est === 'bloqueada')         return STATE_TOKENS.bloqueada.border;
  if (urgencia === 'vencida_hoy')  return URGENCIA_TOKENS.vencida_hoy.border;
  if (urgencia === 'urgente')      return URGENCIA_TOKENS.urgente.border;
  if (urgencia === 'precaucion')   return URGENCIA_TOKENS.precaucion.border;
  return null;
}

function urgenciaStyles(urgencia: UrgenciaHoraria, est: EstadoTarea): {
  containerClass: string;
  bgColor:        string | null;
  textColor:      string;
} {
  if (est === 'atrasada') {
    const t = STATE_TOKENS.atrasada;
    return { containerClass: '', bgColor: t.bg, textColor: t.fg };
  }
  if (est === 'bloqueada') {
    return { containerClass: '', bgColor: null, textColor: '' };
  }
  switch (urgencia) {
    case 'vencida_hoy': {
      const u = URGENCIA_TOKENS.vencida_hoy;
      return { containerClass: 'task-urgente-hoy', bgColor: u.bg, textColor: u.fg };
    }
    case 'urgente': {
      const u = URGENCIA_TOKENS.urgente;
      return { containerClass: 'task-urgente', bgColor: u.bg, textColor: u.fg };
    }
    case 'precaucion':
      return { containerClass: 'task-precaucion', bgColor: null, textColor: '' };
    default:
      return { containerClass: '', bgColor: null, textColor: '' };
  }
}

// ---------------------------------------------------------------------------
// TaskItem
// ---------------------------------------------------------------------------

export function TaskItem({
  variant, tarea, readOnly = false, estadoVisual,
  sinAccionesRapidas = false, asignadoNombre, objetivoTitulo,
  dragHandle,
  onOpenDetalle, onEditar, onEliminar,
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

  const est      = estadoVisual ?? tarea.estado;
  const urgencia = urgenciaHoraria(est);
  const styles   = urgenciaStyles(urgencia, est);
  const borde    = borderColorAlerta(urgencia, est);

  const incidenciaEstatica = tarea.es_imprevisto && tarea.tipo === 'no_planificada';
  const sinQuick           = sinAccionesRapidas || incidenciaEstatica;
  const estaCompletada     = est === 'completada' || est === 'cancelada';

  const flagColor =
    tarea.prioridad === 'alta'  ? 'var(--mc-color-danger)'  :
    tarea.prioridad === 'media' ? 'var(--mc-color-warning)'  :
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
        background:    URGENCIA_TOKENS[urgencia].badgeBg,
        color:          URGENCIA_TOKENS[urgencia].badgeFg,
        letterSpacing: '.02em',
      }}
    >
      <Clock size={9} />
      {urgenciaLabel}
    </span>
  ) : null;

  // ── Meta row ──────────────────────────────────────────────────────────────
  const textColorStyle = styles.textColor
    ? { color: styles.textColor }
    : { color: 'var(--mc-color-text-secondary)' };

  const meta = (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs" style={textColorStyle}>
      <span className={`mc-badge ${TAREA_BADGE[est]}`}>{TAREA_LABEL[est]}</span>
      {urgenciaTag}
      {asignadoNombre && <span>{asignadoNombre}</span>}
      {objetivoTitulo && <span>· {objetivoTitulo}</span>}
      {tarea.fecha_planificada && <span>· {tarea.fecha_planificada}</span>}
      {readOnly && <Lock className="inline" size={12} aria-label="Solo lectura" />}
    </div>
  );

  // ── CTAs principales ──────────────────────────────────────────────────────
  const ctaPrincipal = !sinQuick && !readOnly && !estaCompletada ? (
    <>
      {(est === 'pendiente' || est === 'atrasada' || est === 'reprogramada') && onIniciar && (
        <Button variant="primary" size="sm" onClick={(e) => { e.stopPropagation(); onIniciar(tarea); }}>
          Iniciar
        </Button>
      )}
      {est === 'en_progreso' && onCompletar && (
        <Button variant="primary" size="sm" onClick={(e) => { e.stopPropagation(); onCompletar(tarea); }}>
          Completar
        </Button>
      )}
    </>
  ) : null;

  // ── Menú de opciones ──────────────────────────────────────────────────────
  const tieneMenu = !readOnly && !estaCompletada &&
    (onReprogramar || onEliminar || onBloquear || onEditar);

  const menuOpciones = tieneMenu ? (
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
        aria-label="Más opciones"
        aria-expanded={menuAbierto}
        aria-haspopup="menu"
        onClick={() => { calcularPosicion(); setMenuAbierto((v) => !v); }}
        style={{ color: styles.textColor || 'var(--mc-color-text-secondary)' }}
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
            <Button
              variant="ghost"
              size="xs"
              role="menuitem"
              className="!h-auto w-full justify-start rounded-none px-3 py-2 text-xs font-normal text-[var(--mc-color-text)]"
              onClick={() => { setMenuAbierto(false); onReprogramar(tarea); }}
            >
              Reprogramar
            </Button>
          )}
          {(est === 'pendiente' || est === 'atrasada' || est === 'en_progreso') && onBloquear && (
            <Button
              variant="ghost"
              size="xs"
              role="menuitem"
              className="!h-auto w-full justify-start rounded-none px-3 py-2 text-xs font-normal text-[var(--mc-color-text)]"
              onClick={() => { setMenuAbierto(false); onBloquear(tarea); }}
            >
              Bloquear
            </Button>
          )}
          {onEditar && (
            <Button
              variant="ghost"
              size="xs"
              role="menuitem"
              className="!h-auto w-full justify-start rounded-none px-3 py-2 text-xs font-normal text-[var(--mc-color-accent)]"
              onClick={() => { setMenuAbierto(false); onEditar(tarea); }}
            >
              Editar
            </Button>
          )}
          {onEliminar && (
            <Button
              variant="ghost"
              size="xs"
              role="menuitem"
              className="!h-auto w-full justify-start rounded-none px-3 py-2 text-xs font-normal text-[var(--mc-color-danger)]"
              onClick={() => { setMenuAbierto(false); onEliminar(tarea); }}
            >
              Eliminar
            </Button>
          )}
        </div>
      )}
    </div>
  ) : null;

  // ── Variante KANBAN ───────────────────────────────────────────────────────
  // Usa borderLeft inline directo — igual que week y card.
  // El div absoluto anterior no funcionaba porque mc-task-kanban no tiene
  // position: relative en el CSS global.
  if (variant === 'kanban') {
    return (
      <article
        className={`mc-task-kanban ${readOnly ? 'opacity-70' : ''} ${styles.containerClass}`}
        style={{
          borderLeft:  borde ? `3px solid ${borde}` : undefined,
          paddingLeft: borde ? 17 : undefined,     // 20px token - 3px del borde
          background:  styles.bgColor ?? undefined,
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
                style={{ color: styles.textColor || 'var(--mc-color-text)' }}
              >
                {tarea.titulo}
              </h3>
              {tarea.prioridad !== 'baja' && <Flag size={14} style={{ color: flagColor, flexShrink: 0 }} aria-hidden />}
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
  const metaWeek = (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs" style={textColorStyle}>
      <span className={`mc-badge ${TAREA_BADGE[est]}`}>{TAREA_LABEL[est]}</span>
      {urgenciaTag}
      {readOnly && <Lock className="inline" size={12} aria-label="Solo lectura" />}
    </div>
  );

  if (variant === 'week') {
    return (
      <article
        className={`mc-task-item ${readOnly ? 'opacity-70' : ''} ${styles.containerClass}`}
        style={{
          borderLeft:   borde ? `3px solid ${borde}` : undefined,
          paddingLeft:  borde ? 17 : undefined,
          background:   styles.bgColor ?? undefined,
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
                  style={{ color: styles.textColor || 'var(--mc-color-text)' }}
                >
                  {tarea.titulo}
                </h3>
                {tarea.prioridad !== 'baja' && (
                  <Flag size={12} style={{ color: flagColor, flexShrink: 0, marginTop: 3 }} aria-hidden />
                )}
              </div>
              {metaWeek}
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

  // ── Variante CARD (default) ───────────────────────────────────────────────
  return (
    <article
      className={`mc-task-card ${styles.containerClass}`}
      style={{
        borderLeft:  borde ? `3px solid ${borde}` : undefined,
        paddingLeft: borde ? 17 : undefined,       // 20px token - 3px del borde
        background:  styles.bgColor ?? undefined,
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
            style={{ color: styles.textColor || 'var(--mc-color-text)' }}
          >
            {tarea.titulo}
          </h3>
          {tarea.prioridad !== 'baja' && <Flag size={14} style={{ color: flagColor }} aria-hidden />}
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