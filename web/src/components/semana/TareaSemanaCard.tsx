import { Ban, CalendarClock, Check, Clock, Flame, MoreVertical, Play, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { OrdenTrabajo } from '@/api/ordenTrabajo';
import { TareaEstadoIndicator } from '@/components/tareas/TareaEstadoIndicator';
import { TareaMetaChips } from '@/components/tareas/TareaMetaChips';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ModalConfirmar } from '@/components/ui/ModalConfirmar';
import { PopoverMenu, type PopoverMenuItem } from '@/components/ui/PopoverMenu';
import { PRIORIDAD_LABEL } from '@/lib/estadoConfig';
import { claveVisualTarea } from '@/lib/tableroEstado';
import {
  claseBarraPrioridad,
  labelSenalSituacion,
  muestraChipPrioridad,
  senalSituacionCard,
} from '@/lib/tareaCardSemana';
import type { ClaveVisualTarea, EstadoTarea, Tarea } from '@/types';

type Props = {
  tarea: Tarea;
  hoyYmd: string;
  ot?: OrdenTrabajo | null;
  responsableNombre?: string;
  readOnly?: boolean;
  onOpenDetalle?: (t: Tarea) => void;
  onIniciar?: (t: Tarea) => void;
  onCompletar?: (t: Tarea) => void;
  onReprogramar?: (t: Tarea) => void;
  onCancelar?: (t: Tarea) => void;
  onEliminar?: (t: Tarea) => void;
  onOtClick?: (ot: OrdenTrabajo) => void;
};

function estadoEjecucionPill(estado: EstadoTarea): ClaveVisualTarea {
  return estado;
}

/** Tarjeta de tarea en columna semanal — Sistema de diseño v1. */
export function TareaSemanaCard({
  tarea,
  hoyYmd,
  ot,
  responsableNombre = '—',
  readOnly,
  onOpenDetalle,
  onIniciar,
  onCompletar,
  onReprogramar,
  onCancelar,
  onEliminar,
  onOtClick,
}: Props) {
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);

  const senalSit = senalSituacionCard(tarea, hoyYmd);
  const terminal = tarea.estado === 'completada' || tarea.estado === 'cancelada';

  const puedeIniciar = !readOnly && tarea.estado === 'pendiente' && Boolean(onIniciar);
  const puedeCompletar = !readOnly && tarea.estado === 'en_progreso' && Boolean(onCompletar);
  const clave = claveVisualTarea(tarea, hoyYmd);
  const puedeReprogramar =
    !readOnly &&
    Boolean(onReprogramar) &&
    !terminal &&
    ['pendiente', 'atrasada', 'reprogramada', 'en_progreso'].includes(clave);
  const puedeCancelar =
    !readOnly && Boolean(onCancelar) && ['pendiente', 'en_progreso'].includes(tarea.estado);
  const puedeEliminar = !readOnly && !terminal && Boolean(onEliminar);

  const menuItems = useMemo((): PopoverMenuItem[] => {
    const items: PopoverMenuItem[] = [];
    if (puedeReprogramar && onReprogramar) {
      items.push({
        id: 'reprogramar',
        label: 'Reprogramar',
        icon: CalendarClock,
        onClick: () => onReprogramar(tarea),
      });
    }
    if (puedeCancelar && onCancelar) {
      items.push({
        id: 'cancelar',
        label: 'Cancelar tarea',
        icon: Ban,
        onClick: () => onCancelar(tarea),
      });
    }
    if (puedeEliminar) {
      items.push({
        id: 'eliminar',
        label: 'Eliminar',
        icon: Trash2,
        danger: true,
        onClick: () => setConfirmarEliminar(true),
      });
    }
    return items;
  }, [tarea, puedeReprogramar, onReprogramar, puedeCancelar, onCancelar, puedeEliminar]);

  const hayPrimario = puedeIniciar || puedeCompletar;
  const hayMenu = menuItems.length > 0;
  const hayFilaAcciones = hayPrimario || hayMenu;

  if (tarea.estado === 'completada') {
    return (
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
    );
  }

  if (tarea.estado === 'cancelada') {
    return (
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
    );
  }

  return (
    <>
      <div
        className={[
          'mc-semana-task-card',
          'mc-semana-task-card--v2',
          senalSit === 'atrasada' ? 'mc-semana-task-card--atrasada' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span
          className={['mc-semana-task-card__prio', claseBarraPrioridad(tarea.prioridad)].join(' ')}
          aria-hidden
        />

        <div className="mc-semana-task-card__main">
          <div
            className="mc-semana-task-card__click"
            role="button"
            tabIndex={0}
            onClick={() => onOpenDetalle?.(tarea)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onOpenDetalle?.(tarea);
            }}
          >
            <div className="mc-semana-task-card__row-top">
              <p className="mc-semana-task-card__title">{tarea.titulo}</p>
              {muestraChipPrioridad(tarea.prioridad) && (
                <span className="mc-chip mc-chip--prioridad-critica mc-semana-task-card__prio-chip">
                  <Flame size={11} aria-hidden />
                  {PRIORIDAD_LABEL.critica}
                </span>
              )}
            </div>

            <div className="mc-semana-task-card__pills">
              {senalSit === 'vence_hoy' ? (
                <span className="mc-chip mc-chip--vence-hoy">
                  <Clock size={12} aria-hidden />
                  {labelSenalSituacion(senalSit)}
                </span>
              ) : senalSit ? (
                <TareaEstadoIndicator estado={senalSit} variant="pill" />
              ) : null}
              <TareaEstadoIndicator estado={estadoEjecucionPill(tarea.estado)} variant="pill" />
            </div>

            <div className="mc-semana-task-card__usuario-line">
              <Avatar nombre={responsableNombre} size="sm" />
              <span className="mc-semana-task-card__usuario-nombre">{responsableNombre}</span>
              <span className="mc-semana-task-card__meta-chips">
                <TareaMetaChips ot={ot ?? null} {...(onOtClick ? { onOtClick } : {})} />
              </span>
            </div>
          </div>

          {hayFilaAcciones && (
            <div
              className="mc-semana-task-card__actions mc-semana-task-card__actions--split"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <div className="mc-semana-task-card__action-primary">
                {puedeIniciar && (
                  <Button variant="primary" size="xs" fullWidth onClick={() => onIniciar!(tarea)}>
                    <Play size={12} aria-hidden />
                    Iniciar
                  </Button>
                )}
                {puedeCompletar && (
                  <Button variant="primary" size="xs" fullWidth onClick={() => onCompletar!(tarea)}>
                    <Check size={12} aria-hidden />
                    Completar
                  </Button>
                )}
              </div>

              {hayMenu && (
                <PopoverMenu
                  items={menuItems}
                  trigger={
                    <button
                      type="button"
                      className="mc-semana-task-card__menu-trigger"
                      aria-label="Más acciones"
                    >
                      <MoreVertical size={16} aria-hidden />
                    </button>
                  }
                />
              )}
            </div>
          )}
        </div>
      </div>

      <ModalConfirmar
        open={confirmarEliminar}
        titulo="Eliminar tarea"
        mensaje="Se abrirá el formulario para indicar el motivo. ¿Continuar?"
        labelConfirmar="Eliminar"
        variantConfirmar="danger"
        analyticsId="modal-confirmar-eliminar-tarea-card"
        onCancelar={() => setConfirmarEliminar(false)}
        onConfirmar={() => {
          setConfirmarEliminar(false);
          onEliminar?.(tarea);
        }}
      />
    </>
  );
}
