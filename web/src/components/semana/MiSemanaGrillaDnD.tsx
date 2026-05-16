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
import { IncidenciaRow } from '@/components/semana/IncidenciaRow';
import { SemanaDiaDrop } from '@/components/semana/SemanaDiaDrop';
import { TaskItem } from '@/components/tareas/TaskItem';
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
  tituloObjetivoPorId: Map<string, string>;
  incidenciasSemana: Tarea[];
  nombresPorId: Map<string, string>;
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

type NivelCarga = 'baja' | 'media' | 'alta';

function nivelCarga(n: number): NivelCarga {
  if (n <= 2) return 'baja';
  if (n <= 4) return 'media';
  return 'alta';
}

const CARGA_CONFIG: Record<NivelCarga, { color: string; label: string }> = {
  baja:  { color: 'var(--mc-color-success)', label: 'Carga baja'  },
  media: { color: 'var(--mc-color-warning)', label: 'Carga media' },
  alta:  { color: 'var(--mc-color-danger)',  label: 'Carga alta'  },
};

function CargaIndicator({ n }: { n: number }) {
  const nivel = nivelCarga(n);
  const { color, label } = CARGA_CONFIG[nivel];
  const texto = `${label} · ${n} ${n === 1 ? 'tarea' : 'tareas'}`;
  return (
    <span className="mc-carga-indicator" aria-label={texto}>
      <span
        className="mc-carga-indicator__dot"
        style={{ background: color }}
        aria-hidden
      />
      <span className="mc-carga-indicator__label">{texto}</span>
    </span>
  );
}

function eventosEnDia(eventos: Evento[], ymd: string): Evento[] {
  return eventos.filter((e) => fechaLocalYmd(new Date(e.fecha_inicio)) === ymd);
}

const collisionSemana: CollisionDetection = (args) => {
  const ptr     = pointerWithin(args);
  const zonaPtr = ptr.find((c) => String(c.id).startsWith('day-'));
  if (zonaPtr) return [zonaPtr];
  const corners = closestCorners(args);
  const zona    = corners.find((c) => String(c.id).startsWith('day-'));
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
    tituloObjetivoPorId,
    incidenciasSemana,
    nombresPorId,
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
    <div className="min-w-0">
      <DndContext
        sensors={sensors}
        collisionDetection={collisionSemana}
        onDragStart={(e) => setActiveDragId(String(e.active.id))}
        onDragOver={onDragOver}
        onDragEnd={(e) => void onDragEnd(e)}
        onDragCancel={() => { setActiveDragId(null); }}
      >
        <section className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--mc-color-text-secondary)]">
            Agenda semanal
          </div>
          <div className="mc-card !p-0 overflow-hidden">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-6 md:gap-0">
              {diasSemana.map((d, idx) => {
                const ymd       = fechaLocalYmd(d);
                const delDia    = tareasPlan.filter(
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
                const delDiaVis = completadasOcultas.slice().sort(
                  (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
                );
                const esHoy     = ymd === hoyYmd;
                const ph        = Boolean(activeDragId && overId === `day-${ymd}`);

                return (
                  <div
                    key={ymd}
                    className={[
                      ymd === diaMobileYmd ? 'flex' : 'hidden md:flex',
                      'mc-semana-dia-col min-h-[220px] min-w-0 flex-col border-b border-[var(--mc-color-border)]',
                      'md:border-b-0 md:border-r md:last:border-r-0',
                      esHoy ? 'bg-[var(--mc-color-accent-soft)]' : '',
                    ].join(' ').trim()}
                  >
                    <div className="flex items-center justify-between gap-1 border-b border-[var(--mc-color-border)] px-2 py-2">
                      <div className="flex items-baseline gap-1.5 text-[12px] text-[var(--mc-color-text)]">
                        <span className="font-medium">{DIAS_CORTO[idx]}</span>
                        <span className="inline-flex items-center gap-1 font-bold tabular-nums">
                          {esHoy ? (
                            <span
                              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--mc-brand-violet)]"
                              title="Hoy"
                              aria-label="Hoy"
                            />
                          ) : null}
                          {d.getDate()}
                        </span>
                      </div>
                      <CargaIndicator n={delDia.length} />
                    </div>

                    <Button
                      variant="ghost"
                      size="xs"
                      className="w-full justify-center border-b border-[var(--mc-color-border)] rounded-none !py-2"
                      onClick={() => onAbrirModalDia(ymd)}
                    >
                      + Tarea / evento
                    </Button>

                    <SemanaDiaDrop
                      id={`day-${ymd}`}
                      className="flex min-h-0 flex-1 flex-col gap-2 p-2"
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
                          objetivoTitulo={t.objetivo_id ? tituloObjetivoPorId.get(t.objetivo_id) ?? null : null}
                          ot={ordenesPorTarea.get(t.id) ?? null}
                          readOnly={!puedeGestionar(t)}
                          onOpenDetalle={(x) => onAbrirDetalle(x.id)}
                          {...(onOtClick ? { onOtClick } : {})}
                        />
                      ))}
                      {nCompletadasOcultas > 0 && (
                        <p className="mc-incidencia-row__ocultas" role="status">
                          {nCompletadasOcultas} completada{nCompletadasOcultas !== 1 ? 's' : ''}
                        </p>
                      )}
                      {incidenciasDia.length > 0 && (
                        <div className="mc-incidencia-rows" role="list" aria-label="Incidencias del día">
                          {incidenciasDia.map((inc) => {
                            const editable = ymd === hoyYmd && puedeGestionar(inc);
                            return (
                              <IncidenciaRow
                                key={inc.id}
                                incidencia={inc}
                                hoyYmd={hoyYmd}
                                asignadoNombre={nombresPorId.get(inc.asignado_a) ?? null}
                                readOnly={!editable}
                                {...(editable ? { onOpen: () => onAbrirDetalle(inc.id) } : {})}
                              />
                            );
                          })}
                        </div>
                      )}
                    </SemanaDiaDrop>

                    {esHoy && (
                      <div className="border-t border-dashed border-[var(--mc-color-border)] px-2 py-1">
                        <button
                          type="button"
                          onClick={onRegistrarIncidencia}
                          className="w-full text-[10px] text-[var(--mc-color-info)] hover:underline"
                        >
                          + Registrar incidencia
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <DragOverlay dropAnimation={{ duration: 180, easing: 'ease-out' }}>
          {activeTareaDrag && (
            <div
              className="mc-drag-overlay-card pointer-events-none max-w-[320px]"
            >
              <TaskItem
                variant="week"
                tarea={activeTareaDrag}
                readOnly
                estadoVisual={estadoEfectivoTablero(activeTareaDrag, hoyYmd)}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
