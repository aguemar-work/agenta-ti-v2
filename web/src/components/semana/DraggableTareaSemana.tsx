import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  CalendarClock,
  Check,
  FileText,
  GripVertical,
  KeyRound,
  Play,
  RefreshCw,
  Target,
} from 'lucide-react';
import type { CSSProperties } from 'react';

import type { OrdenTrabajo } from '@/api/ordenTrabajo';
import { TareaEstadoIndicator } from '@/components/tareas/TareaEstadoIndicator';
import { fechaLocalDdMmYyyy } from '@/lib/fecha';
import { ESTADO_OT_LABEL } from '@/lib/otConfig';
import { PRIORIDAD_LABEL } from '@/lib/estadoConfig';
import { inicialesNombre } from '@/lib/metricasHelpers';
import { claveVisualTarea } from '@/lib/tableroEstado';
import {
  claseBarraPrioridad,
  labelEstadoEjecucion,
  labelSenalSituacion,
  muestraChipPrioridad,
  senalFechaCard,
  senalSituacionCard,
} from '@/lib/tareaCardSemana';
import type { Tarea } from '@/types';

type Props = {
  tarea: Tarea;
  hoyYmd: string;
  ot?: OrdenTrabajo | null;
  responsableNombre?: string;
  readOnly?: boolean;
  onOpenDetalle?: (t: Tarea) => void;
  onOtClick?: (ot: OrdenTrabajo) => void;
  onIniciar?: (t: Tarea) => void;
  onCompletar?: (t: Tarea) => void;
  onReprogramar?: (t: Tarea) => void;
};

/** Tarjeta v2: barra prioridad · título · estado/situación · pie con avatar + vínculos. */
export function DraggableTareaSemana({
  tarea,
  hoyYmd,
  ot,
  responsableNombre = '—',
  readOnly,
  onOpenDetalle,
  onOtClick,
  onIniciar,
  onCompletar,
  onReprogramar,
}: Props) {
  const terminal = tarea.estado === 'completada' || tarea.estado === 'cancelada';
  const dragBloqueado = readOnly || terminal;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `tarea-${tarea.id}`,
    disabled: dragBloqueado,
  });

  const style: CSSProperties = isDragging
    ? { opacity: 0, visibility: 'hidden', touchAction: dragBloqueado ? undefined : 'none' }
    : { transform: CSS.Translate.toString(transform), touchAction: dragBloqueado ? undefined : 'none' };

  const clave = claveVisualTarea(tarea, hoyYmd);
  const senalSit = senalSituacionCard(tarea, hoyYmd);
  const senalFecha = senalFechaCard(tarea, hoyYmd);
  const descripcion = tarea.descripcion?.trim() ?? '';
  const reprogramaciones = tarea.reprogramaciones ?? 0;
  const iniciales = inicialesNombre(responsableNombre);
  const puedeIniciar = !readOnly && tarea.estado === 'pendiente' && Boolean(onIniciar);
  const puedeCompletar = !readOnly && tarea.estado === 'en_progreso' && Boolean(onCompletar);
  const puedeReprogramar =
    !readOnly &&
    Boolean(onReprogramar) &&
    !terminal &&
    ['pendiente', 'atrasada', 'reprogramada', 'en_progreso'].includes(clave);

  if (tarea.estado === 'completada') {
    return (
      <div ref={setNodeRef} style={style} draggable={false} onDragStart={(e) => e.preventDefault()}>
        <div
          className="mc-semana-task-card mc-semana-task-card--v2 mc-semana-task-card--completada"
          onClick={() => onOpenDetalle?.(tarea)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onOpenDetalle?.(tarea);
          }}
        >
          <span className="mc-semana-task-card__check" aria-hidden>
            <Check size={14} strokeWidth={2.5} />
          </span>
          <p className="mc-semana-task-card__title">{tarea.titulo}</p>
        </div>
      </div>
    );
  }

  if (tarea.estado === 'cancelada') {
    return (
      <div ref={setNodeRef} style={style} draggable={false} onDragStart={(e) => e.preventDefault()}>
        <div
          className="mc-semana-task-card mc-semana-task-card--v2 mc-semana-task-card--cancelada"
          onClick={() => onOpenDetalle?.(tarea)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onOpenDetalle?.(tarea);
          }}
        >
          <p className="mc-semana-task-card__title">{tarea.titulo}</p>
          <span className="mc-semana-task-card__estado-texto">Cancelada</span>
        </div>
      </div>
    );
  }

  const indicadorSituacion =
    senalSit === 'vence_hoy' ? (
      <span className="mc-chip mc-chip--vence-hoy">{labelSenalSituacion(senalSit)}</span>
    ) : senalSit ? (
      <TareaEstadoIndicator estado={senalSit} variant="pill" />
    ) : null;

  return (
    <div ref={setNodeRef} style={style} draggable={false} onDragStart={(e) => e.preventDefault()}>
      <div
        className={[
          'mc-semana-task-card',
          'mc-semana-task-card--v2',
          senalSit === 'atrasada' ? 'mc-semana-task-card--atrasada' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => onOpenDetalle?.(tarea)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onOpenDetalle?.(tarea);
        }}
      >
        <span
          className={['mc-semana-task-card__prio', claseBarraPrioridad(tarea.prioridad)].join(' ')}
          aria-hidden
        />

        <div className="mc-semana-task-card__main">
          <div className="mc-semana-task-card__row-top">
            <p className="mc-semana-task-card__title">{tarea.titulo}</p>
            {muestraChipPrioridad(tarea.prioridad) && (
              <span className="mc-chip mc-chip--prioridad-critica mc-semana-task-card__prio-chip">
                {PRIORIDAD_LABEL.critica}
              </span>
            )}
          </div>

          <div className="mc-semana-task-card__estado-line">
            {indicadorSituacion}
            <span className="mc-semana-task-card__estado-texto">{labelEstadoEjecucion(tarea)}</span>
          </div>

          <div className="mc-semana-task-card__footer">
            <div className="mc-semana-task-card__footer-left">
              <span
                className="mc-semana-task-card__avatar"
                title={responsableNombre}
                aria-label={responsableNombre}
              >
                {iniciales}
              </span>
              {senalFecha ? (
                <span className="mc-semana-task-card__fecha-senal">{senalFecha}</span>
              ) : null}
            </div>

            <div className="mc-semana-task-card__vinculos" aria-label="Vínculos">
              {tarea.objetivo_id ? (
                <span className="mc-semana-task-card__vinculo" title="Vinculada a objetivo">
                  <Target size={12} aria-hidden />
                </span>
              ) : null}
              {ot ? (
                <button
                  type="button"
                  className="mc-semana-task-card__vinculo mc-semana-task-card__vinculo--btn"
                  title={`OT ${ot.numero ?? 'borrador'}: ${ESTADO_OT_LABEL[ot.estado]}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOtClick?.(ot);
                  }}
                >
                  <KeyRound size={12} aria-hidden />
                </button>
              ) : null}
              {descripcion ? (
                <span className="mc-semana-task-card__vinculo" title={descripcion}>
                  <FileText size={12} aria-hidden />
                </span>
              ) : null}
              {reprogramaciones > 0 ? (
                <span
                  className="mc-semana-task-card__vinculo mc-semana-task-card__vinculo--repr"
                  title={`${reprogramaciones} reprogramación${reprogramaciones !== 1 ? 'es' : ''}`}
                >
                  <RefreshCw size={11} aria-hidden />
                  <span className="tabular-nums">{reprogramaciones}</span>
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div
          className="mc-semana-task-card__hover"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {!dragBloqueado && (
            <button
              type="button"
              className="mc-semana-task-card__grip"
              aria-label="Arrastrar tarea"
              {...listeners}
              {...attributes}
              style={{ touchAction: 'none' }}
              draggable={false}
            >
              <GripVertical size={14} aria-hidden />
            </button>
          )}

          {descripcion ? (
            <p className="mc-semana-task-card__hover-desc">{descripcion}</p>
          ) : null}

          {tarea.fecha_planificada ? (
            <p className="mc-semana-task-card__hover-fecha">
              Planificada: {fechaLocalDdMmYyyy(new Date(`${tarea.fecha_planificada}T12:00:00`))}
            </p>
          ) : null}

          <div className="mc-semana-task-card__hover-actions">
            {puedeIniciar && (
              <button
                type="button"
                className="mc-semana-task-card__hover-btn"
                aria-label="Iniciar ejecución"
                onClick={() => onIniciar!(tarea)}
              >
                <Play size={14} aria-hidden />
                Iniciar
              </button>
            )}
            {puedeCompletar && (
              <button
                type="button"
                className="mc-semana-task-card__hover-btn mc-semana-task-card__hover-btn--primary"
                aria-label="Completar tarea"
                onClick={() => onCompletar!(tarea)}
              >
                <Check size={14} aria-hidden />
                Completar
              </button>
            )}
            {puedeReprogramar && (
              <button
                type="button"
                className="mc-semana-task-card__hover-btn"
                aria-label="Reprogramar tarea"
                onClick={() => onReprogramar!(tarea)}
              >
                <CalendarClock size={14} aria-hidden />
                Reprogramar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
