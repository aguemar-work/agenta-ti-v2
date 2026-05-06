import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Clock, GripVertical } from 'lucide-react';
import type { CSSProperties } from 'react';

import { Button } from '@/components/ui/Button';
import { TAREA_BADGE, TAREA_LABEL } from '@/lib/estadoConfig';
import { urgenciaHoraria } from '@/lib/tareaUrgencia';
import type { Tarea } from '@/types';

type Props = {
  tarea:           Tarea;
  hoyYmd:          string;
  canDrag:         boolean;
  esJefe:          boolean;
  asignadoNombre?: string;
  onOpenDetalle?:  () => void;
  onIniciar?:      () => void;
  onCompletar?:    () => void;
  onBloquear?:     () => void;
  onDesbloquear?:  () => void;
};

export function DraggableTareaTablero({
  tarea, hoyYmd: _hoyYmd, canDrag, esJefe, asignadoNombre,
  onOpenDetalle, onIniciar, onCompletar, onBloquear, onDesbloquear,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id:       `kanban-${tarea.id}`,
    disabled: !canDrag,
  });

  const style: CSSProperties = isDragging
    ? { opacity: 0, visibility: 'hidden', touchAction: 'none' }
    : { transform: CSS.Translate.toString(transform), touchAction: canDrag ? 'none' : undefined };

  const est      = tarea.estado;
  const urgencia = urgenciaHoraria(est);

  // ── Color del borde izquierdo según estado + urgencia ─────────────────
  const borderColor =
    est === 'atrasada'         ? '#E24B4A' :
    est === 'bloqueada'        ? '#EF9F27' :
    urgencia === 'vencida_hoy' ? '#A32D2D' :
    urgencia === 'urgente'     ? '#E24B4A' :
    urgencia === 'precaucion'  ? '#EF9F27' :
    'transparent';

  const bgColor =
    est === 'atrasada'         ? '#FCEBEB' :
    urgencia === 'vencida_hoy' ? '#E24B4A' :
    urgencia === 'urgente'     ? '#FCEBEB' :
    undefined;

  const textColor =
    urgencia === 'vencida_hoy' ? '#fff'    :
    est === 'atrasada'          ? '#791F1F' :
    urgencia === 'urgente'      ? '#791F1F' :
    'var(--mc-color-text)';

  const metaColor =
    urgencia === 'vencida_hoy' ? 'rgba(255,255,255,0.8)' :
    est === 'atrasada'          ? '#A32D2D'               :
    'var(--mc-color-text-secondary)';

  // ── Badge de urgencia horaria (solo si aplica) ─────────────────────────
  const urgenciaLabels: Partial<Record<typeof urgencia, string>> = {
    precaucion:  'Por vencer',
    urgente:     'Urgente',
    vencida_hoy: 'Vencida hoy',
  };
  const urgenciaLabel = urgenciaLabels[urgencia];

  return (
    <div ref={setNodeRef} style={style} draggable={false}>
      <div
        className="mc-card !p-3 flex flex-col gap-2"
        style={{
          borderLeft:   `3px solid ${borderColor}`,
          paddingLeft:  borderColor !== 'transparent' ? 10 : undefined,
          background:   bgColor,
          transition:   'background 0.2s, border-color 0.2s',
        }}
      >
        <div className="flex items-start gap-2">
          {canDrag && (
            <button
              type="button"
              className="mc-btn-ghost mc-btn-xs !mt-0.5 shrink-0 !p-0.5"
              style={{ touchAction: 'none', color: metaColor }}
              aria-label="Arrastrar"
              {...listeners}
              {...attributes}
              draggable={false}
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical size={14} />
            </button>
          )}
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={onOpenDetalle}
          >
            <p
              className="text-xs font-medium leading-snug line-clamp-2"
              style={{ color: textColor }}
            >
              {tarea.titulo}
            </p>
          </button>
        </div>

        {/* Meta: estado + urgencia + asignado */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`mc-badge ${TAREA_BADGE[est] ?? 'mc-badge-neutral'}`}
            style={{ fontSize: 10 }}
          >
            {TAREA_LABEL[est] ?? est}
          </span>
          {urgenciaLabel && (
            <span style={{
              display:      'inline-flex',
              alignItems:   'center',
              gap:           3,
              fontSize:      10,
              fontWeight:    600,
              padding:       '1px 6px',
              borderRadius:  10,
              background:    urgencia === 'vencida_hoy' ? 'rgba(255,255,255,0.2)' :
                             urgencia === 'urgente'     ? '#F7C1C1' : '#FAC775',
              color:         urgencia === 'vencida_hoy' ? '#fff' :
                             urgencia === 'urgente'     ? '#791F1F' : '#633806',
            }}>
              <Clock size={9} />
              {urgenciaLabel}
            </span>
          )}
          {asignadoNombre && (
            <span style={{ fontSize: 10, color: metaColor }}>{asignadoNombre}</span>
          )}
        </div>

        {/* CTAs */}
        {est !== 'completada' && est !== 'cancelada' && (
          <div className="flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
            {(est === 'pendiente' || est === 'atrasada' || est === 'reprogramada') && onIniciar && (
              <Button variant="primary" size="sm" className="!px-3 !py-1.5 text-xs" onClick={onIniciar}>
                Iniciar
              </Button>
            )}
            {est === 'en_progreso' && onCompletar && (
              <Button variant="primary" size="sm" className="!px-3 !py-1.5 text-xs" onClick={onCompletar}>
                Completar
              </Button>
            )}
            {est !== 'bloqueada' && onBloquear && (
              <Button variant="secondary" size="sm" className="!px-3 !py-1.5 text-xs" onClick={onBloquear}>
                Bloquear
              </Button>
            )}
            {est === 'bloqueada' && esJefe && onDesbloquear && (
              <Button variant="secondary" size="sm" className="!px-3 !py-1.5 text-xs" onClick={onDesbloquear}>
                Desbloquear
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
