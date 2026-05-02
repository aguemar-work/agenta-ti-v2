import { useDroppable } from '@dnd-kit/core';
import type { ReactNode } from 'react';

import type { ColumnaTableroId } from '@/api/tablero';

const CONFIG: Record<ColumnaTableroId, {
  titulo:     string;
  accentColor: string;
  emptyText:  string;
  emptyDesc:  string | null;
}> = {
  pendiente: {
    titulo:      'Por hacer',
    accentColor: '#B4B2A9',
    emptyText:   'Sin tareas pendientes',
    emptyDesc:   null,
  },
  en_progreso: {
    titulo:      'En progreso',
    accentColor: '#185FA5',
    emptyText:   'Nada en progreso',
    emptyDesc:   null,
  },
  bloqueada: {
    titulo:      'Bloqueadas',
    accentColor: '#BA7517',
    emptyText:   'Sin tareas bloqueadas',
    emptyDesc:   null,
  },
  completada: {
    titulo:      'Completadas',
    accentColor: '#3B6D11',
    emptyText:   'Sin completadas recientes',
    emptyDesc:   'Activa «Mostrar completadas» en los filtros para ver los últimos 7 días.',
  },
};

type Props = {
  columna:          ColumnaTableroId;
  count:            number;
  children:         ReactNode;
  showPlaceholder?: boolean;
  /** Cuántas tareas atrasadas hay en esta columna (para badge rojo) */
  atrasadasCount?:  number;
};

export function ColumnaKanban({ columna, count, children, showPlaceholder, atrasadasCount = 0 }: Props) {
  const id  = `col:${columna}`;
  const { setNodeRef, isOver } = useDroppable({ id });
  const isEmpty = count === 0 && !showPlaceholder;
  const cfg = CONFIG[columna];

  return (
    <div className="mc-kanban-col">

      {/* ── Cabecera de columna ─────────────────────────────────────────── */}
      <div
        className="mc-kanban-col-head"
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          paddingBottom:   8,
          borderBottom:   `2px solid ${cfg.accentColor}`,
          marginBottom:    8,
        }}
      >
        <span style={{
          fontSize:      11,
          fontWeight:    700,
          textTransform: 'uppercase',
          letterSpacing: '.06em',
          color:         cfg.accentColor,
        }}>
          {cfg.titulo}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Badge de atrasadas — solo en columna pendiente */}
          {atrasadasCount > 0 && columna === 'pendiente' && (
            <span style={{
              fontSize:       10,
              fontWeight:     700,
              padding:        '1px 6px',
              borderRadius:   10,
              background:     '#FCEBEB',
              color:          '#A32D2D',
            }}>
              {atrasadasCount} atrasada{atrasadasCount > 1 ? 's' : ''}
            </span>
          )}
          {/* Conteo total */}
          <span style={{
            fontSize:     11,
            fontWeight:   600,
            padding:      '1px 7px',
            borderRadius: 10,
            background:   'var(--mc-color-bg)',
            color:        'var(--mc-color-text-secondary)',
          }}>
            {count}
          </span>
        </div>
      </div>

      {/* ── Cuerpo drop zone ───────────────────────────────────────────── */}
      <div
        ref={setNodeRef}
        className={`mc-kanban-col-body min-h-[180px] ${isOver ? 'mc-drop-target-active' : ''}`.trim()}
        style={{
          background:   isOver ? 'color-mix(in srgb, var(--mc-color-accent) 4%, transparent)' : undefined,
          borderRadius: isOver ? 'var(--mc-radius-md)' : undefined,
          transition:   'background 0.15s',
        }}
      >
        {showPlaceholder && <div className="mc-drag-placeholder" aria-hidden />}

        {isEmpty ? (
          <div style={{
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            gap:             6,
            padding:        '32px 16px',
            textAlign:      'center',
          }}>
            <div style={{
              width:        32,
              height:        32,
              borderRadius: '50%',
              background:   'var(--mc-color-border)',
              display:      'flex',
              alignItems:   'center',
              justifyContent:'center',
              opacity:       0.5,
            }}>
              <div style={{ width: 14, height: 2, background: cfg.accentColor, borderRadius: 2, opacity: 0.6 }} />
            </div>
            <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--mc-color-text-secondary)', margin: 0, lineHeight: 1.4 }}>
              {cfg.emptyText}
            </p>
            {cfg.emptyDesc && (
              <p style={{ fontSize: 11, color: 'var(--mc-color-text-secondary)', opacity: 0.7, margin: 0, lineHeight: 1.4 }}>
                {cfg.emptyDesc}
              </p>
            )}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}