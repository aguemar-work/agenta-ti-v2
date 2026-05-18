/**
 * Grilla semanal con @dnd-kit — chunk separado; solo se carga en /semana.
 */
import {
  closestCorners,
  DndContext,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  pointerWithin,
} from '@dnd-kit/core';

import type { OrdenTrabajo } from '@/api/ordenTrabajo';
import { DraggableTareaSemana } from '@/components/semana/DraggableTareaSemana';
import { EventoCard } from '@/components/semana/EventoCard';
import { SemanaIncidenciasAcordeon } from '@/components/semana/SemanaIncidenciasAcordeon';
import { SemanaColumnaResumen } from '@/components/semana/SemanaColumnaResumen';
import { SemanaDiaDrop } from '@/components/semana/SemanaDiaDrop';
import { Button } from '@/components/ui/Button';
import { useSemanaDnDSensors } from '@/hooks/useSemanaDnD';
import { fechaLocalYmd } from '@/lib/fecha';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import type { Evento, Tarea } from '@/types';

const DIAS_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;

type FiltroEstado = 'pendiente' | 'en_progreso' | 'atrasada' | 'reprogramada' | 'completada';

export type MiSemanaGrillaDnDProps = {
  diasSemana: Date[];
  hoyYmd: string;
  diaMobileYmd: string;
  tareasPlan: Tarea[];
  eventos: Evento[];
  filtroEstado: FiltroEstado | null;
  incidenciasSemana: Tarea[];
  ordenesPorTarea: Map<string, OrdenTrabajo>;
  ocultarCompletadas?: boolean;
  activeDragId: string | null;
  setActiveDragId: (id: string | null) => void;
  overId: string | null;
  onDragOver: (e: DragOverEvent) => void;
  onDragEnd: (e: DragEndEvent) => void | Promise<void>;
  activeTareaDrag: Tarea | null;
  puedeGestionar: (t: Tarea) => boolean;
  onAbrirModalDia: (fecha: string) => void;
  onAbrirDetalle: (tareaId: string) => void;
  onRegistrarIncidencia: () => void;
  onOtClick?: (ot: OrdenTrabajo) => void;
};

function eventosEnDia(eventos: Evento[], ymd: string): Evento[] {
  return eventos.filter((e) => fechaLocalYmd(new Date(e.fecha_inicio)) === ymd);
}

const collisionSemana: CollisionDetection = (args) => {
  const ptr = pointerWithin(args);
  const zonaPtr = ptr.find((c) => String(c.id).startsWith('day-'));
  if (zonaPtr) return [zonaPtr];
  const corners = closestCorners(args);
  const zona = corners.find((c) => String(c.id).startsWith('day-'));
  if (zona) return [zona];
  return corners;
};

export function MiSemanaGrillaDnD(props: MiSemanaGrillaDnDProps) {
  const {
    diasSemana,
    hoyYmd,
    diaMobileYmd,
    tareasPlan,
    eventos,
    filtroEstado,
    incidenciasSemana,
    ordenesPorTarea,
    ocultarCompletadas = false,
    activeDragId,
    setActiveDragId,
    overId,
    onDragOver,
    onDragEnd,
    activeTareaDrag,
    puedeGestionar,
    onAbrirModalDia,
    onAbrirDetalle,
    onRegistrarIncidencia,
    onOtClick,
  } = props;

  const sensors = useSemanaDnDSensors();

  return (
    <div className="mc-misemana-grilla-host min-h-0 min-w-0 flex-1">
      <DndContext
        sensors={sensors}
        collisionDetection={collisionSemana}
        onDragStart={(e) => setActiveDragId(String(e.active.id))}
        onDragOver={onDragOver}
        onDragEnd={(e) => void onDragEnd(e)}
        onDragCancel={() => {
          setActiveDragId(null);
        }}
      >
        <section
          className="mc-semana-grilla flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--mc-radius-lg)] border border-[var(--mc-color-border)] bg-[var(--mc-color-surface)]"
          aria-label="Semana Lun–Sáb"
        >
          <div className="mc-semana-grilla__grid grid min-h-0 flex-1 grid-cols-1 gap-0 md:grid-cols-6">
            {diasSemana.map((d, idx) => {
              const ymd = fechaLocalYmd(d);
              const delDia = tareasPlan.filter(
                (t) => t.fecha_planificada === ymd && !t.es_imprevisto,
              );
              const incidenciasDia = incidenciasSemana.filter((i) => i.fecha_planificada === ymd);
              const delDiaFiltradas = filtroEstado
                ? delDia.filter((t) => estadoEfectivoTablero(t, hoyYmd) === filtroEstado)
                : delDia;
              const completadasOcultas = ocultarCompletadas
                ? delDiaFiltradas.filter((t) => {
                    const est = estadoEfectivoTablero(t, hoyYmd);
                    return est !== 'completada' && est !== 'cancelada';
                  })
                : delDiaFiltradas;
              const nCompletadasOcultas = ocultarCompletadas
                ? delDiaFiltradas.length - completadasOcultas.length
                : 0;
              const delDiaVis = completadasOcultas
                .slice()
                .sort(
                  (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
                );
              const esHoy = ymd === hoyYmd;
              const ph = Boolean(activeDragId && overId === `day-${ymd}`);

              return (
                <div
                  key={ymd}
                  className={[
                    ymd === diaMobileYmd ? 'flex' : 'hidden md:flex',
                    'mc-semana-dia-col min-h-0 min-w-0 flex-col border-b border-[var(--mc-color-border)]',
                    'md:border-b-0 md:border-r md:last:border-r-0',
                    esHoy ? 'mc-semana-dia-col--hoy' : '',
                  ]
                    .join(' ')
                    .trim()}
                >
                  <div
                    className={[
                      'mc-semana-dia-col__header flex shrink-0 items-baseline gap-1.5 border-b border-[var(--mc-color-border)] px-2 py-1.5',
                      esHoy ? 'mc-semana-dia-col__header--hoy' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <span
                      className={[
                        'text-[12px] tabular-nums',
                        esHoy
                          ? 'font-semibold text-[var(--mc-color-text)]'
                          : 'font-normal text-[var(--mc-color-text-secondary)]',
                      ].join(' ')}
                    >
                      {DIAS_CORTO[idx]}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[12px] tabular-nums text-[var(--mc-color-text-secondary)]">
                      {esHoy ? (
                        <span
                          className="mc-semana-dia-col__hoy-dot"
                          title="Hoy"
                          aria-label="Hoy"
                        />
                      ) : null}
                      {d.getDate()}
                    </span>
                  </div>

                  <Button
                    variant="ghost"
                    size="xs"
                    className="w-full shrink-0 justify-center rounded-none border-b border-[var(--mc-color-border)] !py-2"
                    onClick={() => onAbrirModalDia(ymd)}
                  >
                    + Tarea / evento
                  </Button>

                  <div className="mc-semana-dia-col__body relative flex min-h-0 flex-1 flex-col">
                    <SemanaDiaDrop
                      id={`day-${ymd}`}
                      className="mc-semana-dia-drop flex min-h-0 flex-1 flex-col gap-2 p-2"
                      showPlaceholder={ph}
                    >
                    {eventosEnDia(eventos, ymd).map((ev) => (
                      <EventoCard key={ev.id} evento={ev} />
                    ))}
                    {delDiaVis.map((t) => (
                      <DraggableTareaSemana
                        key={t.id}
                        tarea={t}
                        hoyYmd={hoyYmd}
                        ot={ordenesPorTarea.get(t.id) ?? null}
                        readOnly={!puedeGestionar(t)}
                        onOpenDetalle={(x) => onAbrirDetalle(x.id)}
                        {...(onOtClick ? { onOtClick } : {})}
                      />
                    ))}
                    {nCompletadasOcultas > 0 && (
                      <p className="mc-incidencia-row__ocultas" role="status">
                        {nCompletadasOcultas} completada{nCompletadasOcultas !== 1 ? 's' : ''}{' '}
                        oculta{nCompletadasOcultas !== 1 ? 's' : ''}
                      </p>
                    )}
                    </SemanaDiaDrop>

                    <SemanaIncidenciasAcordeon
                      incidencias={incidenciasDia}
                      hoyYmd={hoyYmd}
                      esHoy={esHoy}
                      puedeAbrir={(inc) => ymd === hoyYmd && puedeGestionar(inc)}
                      onAbrirDetalle={onAbrirDetalle}
                    />
                  </div>

                  {esHoy && (
                    <div className="shrink-0 border-t border-dashed border-[var(--mc-color-border)] px-2 py-1">
                      <button
                        type="button"
                        onClick={onRegistrarIncidencia}
                        className="w-full text-[10px] text-[var(--mc-color-info)] hover:underline"
                      >
                        + Registrar incidencia
                      </button>
                    </div>
                  )}

                  <SemanaColumnaResumen
                    tareas={delDia}
                    hoyYmd={hoyYmd}
                    incidenciasCount={incidenciasDia.length}
                  />
                </div>
              );
            })}
          </div>
        </section>

        <DragOverlay dropAnimation={{ duration: 180, easing: 'ease-out' }}>
          {activeTareaDrag && (
            <div className="mc-drag-overlay-card pointer-events-none max-w-[280px]">
              <DraggableTareaSemana tarea={activeTareaDrag} hoyYmd={hoyYmd} readOnly />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
