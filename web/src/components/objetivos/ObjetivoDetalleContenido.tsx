import type { ComponentType } from 'react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { TareaEstadoIndicator } from '@/components/tareas/TareaEstadoIndicator';
import { OBJETIVO_BADGE, OBJETIVO_LABEL } from '@/lib/estadoConfig';
import { fechaLocalYmd } from '@/lib/fecha';
import { ESTADO_OT_BADGE, ESTADO_OT_LABEL } from '@/lib/otConfig';
import { breakdownPuntosObjetivo, etiquetaPuntosPrioridad } from '@/lib/objetivoProgreso';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import { claseProgresoMetaNivel } from '@/components/objetivos/ObjetivoProgreso';
import { nivelRiesgoObjetivo } from '@/lib/tareaUrgencia';
import type { ObjetivoConProgreso } from '@/api/objetivosMetricas';
import type { EstadoObjetivo, Tarea } from '@/types';

type OtRow = { id: string; numero: string; estado: string; descripcion: string };

type Props = {
  objetivo: ObjetivoConProgreso;
  tareasVinc: Tarea[];
  loadTareas: boolean;
  otsVinc: OtRow[];
  loadOTs: boolean;
  esJefe: boolean;
  puedeCompletar: boolean;
  puedeEliminar: boolean;
  onCompletar: () => void;
  onEliminar: () => void;
  onAnadirTarea: () => void;
  onTareaClick: (t: Tarea) => void;
  BarraProgreso: ComponentType<{
    pct: number;
    fechaLimite: string | null;
    size?: 'sm' | 'md';
    totalTareas?: number;
  }>;
  BadgeRiesgo: ComponentType<{
    pct: number;
    fechaLimite: string | null;
    totalTareas?: number;
  }>;
};

export function ObjetivoDetalleContenido({
  objetivo,
  tareasVinc,
  loadTareas,
  otsVinc,
  loadOTs,
  esJefe,
  puedeCompletar,
  puedeEliminar,
  onCompletar,
  onEliminar,
  onAnadirTarea,
  onTareaClick,
  BarraProgreso,
  BadgeRiesgo,
}: Props) {
  const nivel = nivelRiesgoObjetivo(objetivo.pct, objetivo.fecha_limite, objetivo.total_tareas);
  const breakdown = breakdownPuntosObjetivo(tareasVinc);

  return (
    <div className="mc-objetivo-detalle flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="m-0 text-sm font-semibold text-[var(--mc-color-text)]">{objetivo.titulo}</p>
          {objetivo.descripcion ? (
            <p className="m-0 mt-1 text-xs text-[var(--mc-color-text-secondary)]">{objetivo.descripcion}</p>
          ) : null}
        </div>
        <span className={`mc-badge ${OBJETIVO_BADGE[objetivo.estado as EstadoObjetivo]} shrink-0 text-[10px]`}>
          {OBJETIVO_LABEL[objetivo.estado as EstadoObjetivo]}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-[var(--mc-color-text-secondary)]">Progreso ponderado</span>
          <div className="flex items-center gap-2">
            <BadgeRiesgo pct={objetivo.pct} fechaLimite={objetivo.fecha_limite} totalTareas={objetivo.total_tareas} />
            <span
              className={[
                'text-sm font-semibold tabular-nums',
                claseProgresoMetaNivel(nivel),
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {breakdown.pct}%
            </span>
          </div>
        </div>
        <BarraProgreso pct={breakdown.pct} fechaLimite={objetivo.fecha_limite} size="md" totalTareas={objetivo.total_tareas} />
        <p className="m-0 text-[11px] text-[var(--mc-color-text-secondary)]">
          {breakdown.puntosCompletados}/{breakdown.totalPuntos} puntos
          {objetivo.fecha_limite ? ` · vence ${objetivo.fecha_limite}` : ''}
        </p>
      </div>

      {!loadTareas && breakdown.filas.length > 0 && (
        <div className="border-t border-[var(--mc-color-border)] pt-3">
          <p className="m-0 mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--mc-color-text-secondary)]">
            Puntos por tarea
          </p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {breakdown.filas.map((f) => (
              <li
                key={f.tareaId}
                className={[
                  'flex items-center justify-between gap-2 rounded-[var(--mc-radius-sm)] px-2 py-1 text-[11px]',
                  f.completada ? 'bg-[var(--mc-state-completada-bg)]' : 'bg-[var(--mc-color-bg-secondary)]',
                ].join(' ')}
              >
                <span className="min-w-0 truncate text-[var(--mc-color-text)]">{f.titulo}</span>
                <span className="shrink-0 tabular-nums text-[var(--mc-color-text-secondary)]">
                  {f.completada ? f.puntos : 0}/{f.puntos} · {etiquetaPuntosPrioridad(f.prioridad)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-[var(--mc-color-border)] pt-3">
        <div className="mc-section-header mc-section-header--plain">
          <span>Tareas vinculadas</span>
          {esJefe && (
            <Button variant="secondary" size="xs" onClick={onAnadirTarea}>
              + Añadir
            </Button>
          )}
        </div>
        {loadTareas ? (
          <p className="text-xs text-[var(--mc-color-text-secondary)]">Cargando…</p>
        ) : tareasVinc.length === 0 ? (
          <EmptyState compact title="Sin tareas vinculadas" />
        ) : (
          <div className="flex flex-col gap-1">
            {tareasVinc.map((t) => {
              const est = estadoEfectivoTablero(t, fechaLocalYmd(new Date()));
              return (
              <button
                key={t.id}
                type="button"
                className={[
                  'mc-objetivo-detalle-tarea flex w-full items-center justify-between gap-2 rounded-[var(--mc-radius-md)] border px-2 py-1.5 text-left',
                  est === 'atrasada'
                    ? 'border-[var(--mc-state-atrasada-border)] bg-[var(--mc-state-atrasada-bg-soft)]'
                    : 'border-[var(--mc-color-border)] bg-[var(--mc-color-bg-secondary)]',
                ].join(' ')}
                onClick={() => onTareaClick(t)}
              >
                <span className="min-w-0 truncate text-xs text-[var(--mc-color-text)]">{t.titulo}</span>
                {est !== 'pendiente' ? (
                  <TareaEstadoIndicator estado={est} style={{ fontSize: 9 }} />
                ) : null}
              </button>
            );})}
          </div>
        )}
      </div>

      {(loadOTs || otsVinc.length > 0) && (
        <div className="border-t border-[var(--mc-color-border)] pt-3">
          <p className="m-0 mb-2 text-xs font-medium text-[var(--mc-color-text)]">
            OTs vinculadas <span className="font-normal text-[var(--mc-color-text-secondary)]">(referencia)</span>
          </p>
          {loadOTs ? (
            <p className="text-xs text-[var(--mc-color-text-secondary)]">Cargando…</p>
          ) : (
            <div className="flex flex-col gap-1">
              {otsVinc.map((ot) => (
                <div
                  key={ot.id}
                  className="flex items-center justify-between gap-2 rounded-[var(--mc-radius-md)] border border-[var(--mc-color-border)] bg-[var(--mc-color-bg-secondary)] px-2 py-1.5"
                >
                  <div className="min-w-0">
                    <p className="m-0 text-[10px] font-semibold text-[var(--mc-color-text-secondary)]">{ot.numero}</p>
                    <p className="m-0 truncate text-xs text-[var(--mc-color-text)]">{ot.descripcion}</p>
                  </div>
                  <span
                    className={`mc-badge shrink-0 ${ESTADO_OT_BADGE[ot.estado as keyof typeof ESTADO_OT_BADGE] ?? 'mc-badge-neutral'}`}
                    style={{ fontSize: 9 }}
                  >
                    {ESTADO_OT_LABEL[ot.estado as keyof typeof ESTADO_OT_LABEL] ?? ot.estado}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-[var(--mc-color-border)] pt-3">
        {puedeCompletar && (
          <Button variant="primary" size="sm" onClick={onCompletar}>
            {esJefe ? 'Cerrar objetivo' : 'Marcar completado'}
          </Button>
        )}
        {puedeEliminar && (
          <Button variant="danger" size="sm" onClick={onEliminar}>
            Eliminar
          </Button>
        )}
      </div>
    </div>
  );
}
