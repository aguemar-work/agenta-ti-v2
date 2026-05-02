import { Clock, Flag, Lock, MoreHorizontal } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

import { useMenuPosition } from '@/hooks/useMenuPosition';
import { TAREA_BADGE, TAREA_LABEL, URGENCIA_LABEL } from '@/lib/estadoConfig';
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

function urgenciaStyles(urgencia: UrgenciaHoraria, est: EstadoTarea): {
  containerClass: string;
  borderStyle:    string;
  bgStyle:        string;
  textColor:      string;
} {
  // Atrasada (viene de BD) — rojo sólido siempre
  if (est === 'atrasada') {
    return {
      containerClass: '',
      borderStyle:    'border-l-3 border-[#E24B4A]',
      bgStyle:        'bg-[#FCEBEB]',
      textColor:      '#791F1F',
    };
  }
  // Bloqueada — ámbar
  if (est === 'bloqueada') {
    return {
      containerClass: '',
      borderStyle:    'border-l-3 border-[#EF9F27]',
      bgStyle:        '',
      textColor:      '',
    };
  }
  // Alertas horarias (solo para pendiente / en_progreso del día)
  switch (urgencia) {
    case 'vencida_hoy':
      return {
        containerClass: 'task-urgente-hoy',
        borderStyle:    'border-l-3 border-[#A32D2D]',
        bgStyle:        'bg-[#E24B4A]',
        textColor:      '#FFFFFF',
      };
    case 'urgente':
      return {
        containerClass: 'task-urgente',
        borderStyle:    'border-l-3 border-[#E24B4A]',
        bgStyle:        'bg-[#FCEBEB]',
        textColor:      '#791F1F',
      };
    case 'precaucion':
      return {
        containerClass: 'task-precaucion',
        borderStyle:    'border-l-3 border-[#EF9F27]',
        bgStyle:        '',
        textColor:      '',
      };
    default:
      return { containerClass: '', borderStyle: '', bgStyle: '', textColor: '' };
  }
}

// ---------------------------------------------------------------------------
// TaskItem
// ---------------------------------------------------------------------------

export function TaskItem({
  variant, tarea, readOnly = false, estadoVisual,
  sinAccionesRapidas = false, asignadoNombre, objetivoTitulo,
  dragHandle, esJefe = false,
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

  const est       = estadoVisual ?? tarea.estado;
  const urgencia  = urgenciaHoraria(est);
  const styles    = urgenciaStyles(urgencia, est);

  const incidenciaEstatica = tarea.es_imprevisto && tarea.tipo === 'no_planificada';
  const sinQuick           = sinAccionesRapidas || incidenciaEstatica;
  const estaCompletada     = est === 'completada' || est === 'cancelada';

  const flagColor =
    tarea.prioridad === 'alta'  ? 'var(--mc-color-danger)'          :
    tarea.prioridad === 'media' ? 'var(--mc-color-warning)'         :
                                  'var(--mc-color-text-secondary)';

  const lineThrough = est === 'completada' ? 'line-through opacity-60' : '';

  // ── Indicador de urgencia horaria ────────────────────────────────────────
  const urgenciaLabel = URGENCIA_LABEL[urgencia];
  const urgenciaTag = urgenciaLabel ? (
    <span
      style={{
        display:        'inline-flex',
        alignItems:     'center',
        gap:            3,
        fontSize:       10,
        fontWeight:     600,
        padding:        '1px 6px',
        borderRadius:   10,
        background:     urgencia === 'vencida_hoy' ? 'rgba(255,255,255,0.25)' :
                        urgencia === 'urgente'     ? '#F7C1C1' : '#FAC775',
        color:          urgencia === 'vencida_hoy' ? '#fff' :
                        urgencia === 'urgente'     ? '#791F1F' : '#633806',
        letterSpacing:  '.02em',
      }}
    >
      <Clock size={9} />
      {urgenciaLabel}
    </span>
  ) : null;

  // ── Meta row (badge de estado + urgencia + datos) ────────────────────────
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

  // ── CTAs principales ─────────────────────────────────────────────────────
  // Regla: jefe ve Reprogramar + Bloquear + Eliminar
  //        miembro ve Reprogramar + Bloquear (sin Eliminar)
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

  // ── Menú de opciones ─────────────────────────────────────────────────────
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
            <button type="button"
              className="mc-btn-ghost w-full justify-start px-3 py-2 text-xs text-[var(--mc-color-warning)]"
              role="menuitem"
              onClick={() => { setMenuAbierto(false); onReprogramar(tarea); }}>
              Reprogramar
            </button>
          )}
          {(est === 'pendiente' || est === 'atrasada' || est === 'en_progreso') && onBloquear && (
            <button type="button"
              className="mc-btn-ghost w-full justify-start px-3 py-2 text-xs text-[var(--mc-color-warning)]"
              role="menuitem"
              onClick={() => { setMenuAbierto(false); onBloquear(tarea); }}>
              Bloquear
            </button>
          )}
          {onEditar && (
            <button type="button"
              className="mc-btn-ghost w-full justify-start px-3 py-2 text-xs text-[var(--mc-color-accent)]"
              role="menuitem"
              onClick={() => { setMenuAbierto(false); onEditar(tarea); }}>
              Editar
            </button>
          )}
          {/* Eliminar solo visible para jefe */}
          {esJefe && onEliminar && (
            <button type="button"
              className="mc-btn-ghost w-full justify-start px-3 py-2 text-xs text-[var(--mc-color-danger)]"
              role="menuitem"
              onClick={() => { setMenuAbierto(false); onEliminar(tarea); }}>
              Eliminar
            </button>
          )}
        </div>
      )}
    </div>
  ) : null;

  // ── Variante KANBAN ───────────────────────────────────────────────────────
  if (variant === 'kanban') {
    return (
      <article
        className={`mc-task-kanban ${readOnly ? 'opacity-70' : ''} ${styles.containerClass}`}
        style={{
          borderLeft: styles.borderStyle ? undefined : undefined,
          ...(styles.bgStyle ? { background: styles.bgStyle === 'bg-[#FCEBEB]' ? '#FCEBEB' : styles.bgStyle === 'bg-[#E24B4A]' ? '#E24B4A' : undefined } : {}),
          cursor: readOnly ? 'not-allowed' : undefined,
        }}
      >
        {/* Borde de alerta como franja izquierda inline */}
        {(est === 'atrasada' || urgencia !== 'normal') && (
          <div style={{
            position:        'absolute',
            left:            0,
            top:             0,
            bottom:          0,
            width:            3,
            borderRadius:    '8px 0 0 8px',
            background:      est === 'atrasada'          ? '#E24B4A' :
                             urgencia === 'vencida_hoy'  ? '#A32D2D' :
                             urgencia === 'urgente'      ? '#E24B4A' :
                             urgencia === 'precaucion'   ? '#EF9F27' : 'transparent',
          }} />
        )}
        <div className="flex gap-2" style={{ position: 'relative' }}>
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
  if (variant === 'week') {
    return (
      <article
        className={`mc-task-item ${readOnly ? 'opacity-70' : ''} ${styles.containerClass}`}
        style={{
          borderLeft: `3px solid ${
            est === 'atrasada'         ? '#E24B4A' :
            est === 'bloqueada'        ? '#EF9F27' :
            urgencia === 'vencida_hoy' ? '#A32D2D' :
            urgencia === 'urgente'     ? '#E24B4A' :
            urgencia === 'precaucion'  ? '#EF9F27' :
            'transparent'
          }`,
          paddingLeft: (est === 'atrasada' || est === 'bloqueada' || urgencia !== 'normal') ? 8 : undefined,
          background: styles.bgStyle === 'bg-[#FCEBEB]' ? '#FCEBEB' :
                      styles.bgStyle === 'bg-[#E24B4A]' ? '#E24B4A' : undefined,
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
              onKeyDown={(e) => { if (!onOpenDetalle) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDetalle(tarea); } }}
            >
              <div className={`flex items-start gap-2 ${lineThrough}`}>
                <h3
                  className="text-sm font-medium"
                  style={{ color: styles.textColor || 'var(--mc-color-text)' }}
                >
                  {tarea.titulo}
                </h3>
                {tarea.prioridad !== 'baja' && <Flag size={14} style={{ color: flagColor, flexShrink: 0 }} aria-hidden />}
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

  // ── Variante CARD (default) ───────────────────────────────────────────────
  return (
    <article
      className={`mc-task-card ${styles.containerClass}`}
      style={{
        borderLeft: `3px solid ${
          est === 'atrasada'         ? '#E24B4A' :
          est === 'bloqueada'        ? '#EF9F27' :
          urgencia === 'vencida_hoy' ? '#A32D2D' :
          urgencia === 'urgente'     ? '#E24B4A' :
          urgencia === 'precaucion'  ? '#EF9F27' :
          'transparent'
        }`,
        paddingLeft: (est === 'atrasada' || est === 'bloqueada' || urgencia !== 'normal') ? 8 : undefined,
        background: styles.bgStyle === 'bg-[#FCEBEB]' ? '#FCEBEB' :
                    styles.bgStyle === 'bg-[#E24B4A]' ? '#E24B4A' : undefined,
        transition: 'background 0.2s, border-color 0.2s',
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