/**
 * Grilla semanal Lun–Sáb (sin drag & drop).
 */
import type { OrdenTrabajo } from '@/api/ordenTrabajo';
import { EventoCard } from '@/components/semana/EventoCard';
import { SemanaIncidenciasAcordeon } from '@/components/semana/SemanaIncidenciasAcordeon';
import { SemanaColumnaScrollArea } from '@/components/semana/SemanaColumnaScrollArea';
import { MiSemanaLeyendaEstados } from '@/components/semana/MiSemanaLeyendaEstados';
import { TareaSemanaCard } from '@/components/semana/TareaSemanaCard';
import { Button } from '@/components/ui/Button';
import { fechaLocalYmd } from '@/lib/fecha';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import type { Evento, Tarea } from '@/types';

const DIAS_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;

type FiltroEstado = 'pendiente' | 'en_progreso' | 'atrasada' | 'reprogramada' | 'completada';

export type MiSemanaGrillaProps = {
  diasSemana: Date[];
  hoyYmd: string;
  diaMobileYmd: string;
  tareasPlan: Tarea[];
  eventos: Evento[];
  filtroEstado: FiltroEstado | null;
  incidenciasSemana: Tarea[];
  ordenesPorTarea: Map<string, OrdenTrabajo>;
  nombresPorId: Map<string, string>;
  areasPorId: Map<string, string>;
  puedeGestionar: (t: Tarea) => boolean;
  onAbrirModalDia: (fecha: string) => void;
  onAbrirDetalle: (tareaId: string) => void;
  onRegistrarIncidencia: (fecha: string) => void;
  onOtClick?: (ot: OrdenTrabajo) => void;
  completarPendingId?: string | null;
  iniciarPendingId?:   string | null;
  onIniciarTarea?: (t: Tarea) => void;
  onCompletarTarea?: (t: Tarea) => void;
  onReprogramarTarea?: (t: Tarea) => void;
  onCancelarTarea?: (t: Tarea) => void;
  onEliminarTarea?: (t: Tarea) => void;
};

function eventosEnDia(eventos: Evento[], ymd: string): Evento[] {
  return eventos.filter((e) => fechaLocalYmd(new Date(e.fecha_inicio)) === ymd);
}

export function MiSemanaGrilla(props: MiSemanaGrillaProps) {
  const {
    diasSemana,
    hoyYmd,
    diaMobileYmd,
    tareasPlan,
    eventos,
    filtroEstado,
    incidenciasSemana,
    ordenesPorTarea,
    nombresPorId,
    areasPorId,
    puedeGestionar,
    onAbrirModalDia,
    onAbrirDetalle,
    onRegistrarIncidencia,
    completarPendingId,
    iniciarPendingId,
    onIniciarTarea,
    onCompletarTarea,
    onReprogramarTarea,
    onCancelarTarea,
    onEliminarTarea,
    onOtClick,
  } = props;

  return (
    <div className="mc-misemana-grilla-host min-h-0 min-w-0 flex-1">
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
            const delDiaVis = delDiaFiltradas
              .slice()
              .sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
              );
            const esHoy = ymd === hoyYmd;

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

                <SemanaColumnaScrollArea>
                  <div className="mc-semana-dia-drop flex flex-col gap-2 p-2">
                    {eventosEnDia(eventos, ymd).map((ev) => (
                      <EventoCard key={ev.id} evento={ev} />
                    ))}
                    {delDiaVis.map((t) => {
                      const gestiona = puedeGestionar(t);
                      const areaNombre = t.area_id ? areasPorId.get(t.area_id) : undefined;
                      return (
                        <TareaSemanaCard
                          key={t.id}
                          tarea={t}
                          hoyYmd={hoyYmd}
                          ot={ordenesPorTarea.get(t.id) ?? null}
                          responsableNombre={nombresPorId.get(t.asignado_a) ?? '—'}
                          {...(areaNombre ? { areaNombre } : {})}
                          readOnly={!gestiona}
                          completandoEsta={completarPendingId === t.id}
                          iniciandoEsta={iniciarPendingId === t.id}
                          onOpenDetalle={(x) => onAbrirDetalle(x.id)}
                          {...(gestiona && onIniciarTarea ? { onIniciar: onIniciarTarea } : {})}
                          {...(gestiona && onCompletarTarea
                            ? { onCompletar: onCompletarTarea }
                            : {})}
                          {...(gestiona && onReprogramarTarea
                            ? { onReprogramar: onReprogramarTarea }
                            : {})}
                          {...(gestiona && onCancelarTarea
                            ? { onCancelar: onCancelarTarea }
                            : {})}
                          {...(gestiona && onEliminarTarea
                            ? { onEliminar: onEliminarTarea }
                            : {})}
                          {...(onOtClick ? { onOtClick } : {})}
                        />
                      );
                    })}
                  </div>
                </SemanaColumnaScrollArea>

                <div className="mc-semana-dia-col__pie shrink-0">
                  <SemanaIncidenciasAcordeon
                    incidencias={incidenciasDia}
                    hoyYmd={hoyYmd}
                    esHoy={esHoy}
                    puedeAbrir={(inc) => ymd === hoyYmd && puedeGestionar(inc)}
                    onAbrirDetalle={onAbrirDetalle}
                  />
                  <button
                    type="button"
                    onClick={() => onRegistrarIncidencia(ymd)}
                    className="mc-semana-dia-col__registrar-inc"
                  >
                    + Registrar incidencia
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <MiSemanaLeyendaEstados className="shrink-0 border-t border-[var(--mc-color-border)]" />
      </section>
    </div>
  );
}
