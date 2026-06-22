/**
 * Grilla semanal Lun–Sáb (sin drag & drop).
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { MoreHorizontal, Plus, Send } from 'lucide-react';
import type { OrdenTrabajo } from '@/api/ordenTrabajo';
import { EventoCard } from '@/components/semana/EventoCard';
import { SemanaIncidenciasAcordeon } from '@/components/semana/SemanaIncidenciasAcordeon';
import { SemanaColumnaScrollArea } from '@/components/semana/SemanaColumnaScrollArea';
import { TareaSemanaCard } from '@/components/semana/TareaSemanaCard';
import { fechaLocalYmd } from '@/lib/fecha';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import type { FiltroRapido, VistaMode } from '@/components/semana/MiSemanaToolbar';
import type { Evento, Tarea } from '@/types';

const DIAS_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;

const SIN_INICIAR_ESTADOS = ['pendiente', 'reprogramada', 'atrasada'] as const;

export type MiSemanaGrillaProps = {
  diasSemana: Date[];
  hoyYmd: string;
  diaMobileYmd: string;
  tareasPlan: Tarea[];
  eventos: Evento[];
  filtroRapido: FiltroRapido | null;
  busqueda?: string;
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
  onMoverTarea?: (tareaId: string, nuevaFecha: string) => Promise<void>;
  onEventoClick?: (evento: Evento) => void;
  onRegistrarIncidenciaRapida?: (titulo: string) => Promise<void>;
  onCrearTareaRapida?: (titulo: string, fecha: string) => Promise<void>;
  notasHoyCount?: number;
  /** Nodo React renderizado solo en la columna "hoy", entre el área de tareas y el pie de incidencias. */
  notasHoySlot?: ReactNode;
  vista?: VistaMode;
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
    filtroRapido,
    busqueda,
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
    onMoverTarea,
    onOtClick,
    onEventoClick,
    onRegistrarIncidenciaRapida,
    onCrearTareaRapida,
    notasHoyCount,
    notasHoySlot,
    vista = 'semanal',
  } = props;

  const esCompacta = vista === 'compacta';

  const [terminadasExpand,  setTerminadasExpand]  = useState<Set<string>>(new Set());
  const [incRapida,         setIncRapida]         = useState('');
  const [guardandoInc,      setGuardandoInc]      = useState(false);
  const [tareasRapidas,     setTareasRapidas]     = useState<Record<string, string>>({});
  const [guardandoTarea,    setGuardandoTarea]    = useState<string | null>(null);

  async function handleGuardarInc() {
    if (!incRapida.trim() || guardandoInc || !onRegistrarIncidenciaRapida) return;
    setGuardandoInc(true);
    try { await onRegistrarIncidenciaRapida(incRapida.trim()); setIncRapida(''); }
    finally { setGuardandoInc(false); }
  }

  function setTareaRapida(ymd: string, v: string) {
    setTareasRapidas((prev) => ({ ...prev, [ymd]: v }));
  }

  async function handleGuardarTarea(ymd: string) {
    const titulo = (tareasRapidas[ymd] ?? '').trim();
    if (!titulo || guardandoTarea || !onCrearTareaRapida) return;
    setGuardandoTarea(ymd);
    try { await onCrearTareaRapida(titulo, ymd); setTareaRapida(ymd, ''); }
    finally { setGuardandoTarea(null); }
  }

  const [draggingId,        setDraggingId]        = useState<string | null>(null);
  const [draggingFromYmd,   setDraggingFromYmd]   = useState<string | null>(null);
  const [overYmd,           setOverYmd]           = useState<string | null>(null);
  const toggleTerminadas = (ymd: string) =>
    setTerminadasExpand((prev) => {
      const next = new Set(prev);
      if (next.has(ymd)) next.delete(ymd); else next.add(ymd);
      return next;
    });

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
            const delDiaFiltradas = (() => {
              let result = delDia;
              if (busqueda) {
                const q = busqueda.toLowerCase();
                result = result.filter((t) => t.titulo.toLowerCase().includes(q));
              }
              if (filtroRapido === 'sin_iniciar') return result.filter((t) => (SIN_INICIAR_ESTADOS as readonly string[]).includes(estadoEfectivoTablero(t, hoyYmd)));
              if (filtroRapido === 'atrasada')    return result.filter((t) => estadoEfectivoTablero(t, hoyYmd) === 'atrasada');
              if (filtroRapido === 'critica')     return result.filter((t) => t.prioridad === 'critica');
              return result;
            })();
            const delDiaVis = delDiaFiltradas
              .slice()
              .sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
              );
            const esHoy = ymd === hoyYmd;

            // Progreso: solo sobre tareas del día sin filtro activo
            const totalCnt = delDia.length;
            const completadasCnt = delDia.filter((t) => t.estado === 'completada').length;
            const todoListo = totalCnt > 0 && completadasCnt === totalCnt;

            // Separar activas vs terminadas (solo cuando no hay filtro activo)
            const agrupar = !filtroRapido && !busqueda;
            const delDiaActivas = agrupar
              ? delDiaVis.filter((t) => t.estado !== 'completada' && t.estado !== 'cancelada')
              : delDiaVis;
            const delDiaTerminadas = agrupar
              ? delDiaVis.filter((t) => t.estado === 'completada' || t.estado === 'cancelada')
              : [];
            const terminadasVisible = terminadasExpand.has(ymd);

            const sinContenido =
              delDiaActivas.length === 0 &&
              delDiaTerminadas.length === 0 &&
              eventosEnDia(eventos, ymd).length === 0;

            return (
              <div
                key={ymd}
                className={[
                  ymd === diaMobileYmd ? 'flex' : 'hidden md:flex',
                  'mc-semana-dia-col min-h-0 min-w-0 flex-col border-b border-[var(--mc-color-border)]',
                  'md:border-b-0 md:border-r md:last:border-r-0',
                  esHoy ? 'mc-semana-dia-col--hoy' : '',
                  overYmd === ymd && draggingId ? 'mc-semana-dia-col--over' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
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
                        ? 'font-bold text-[var(--mc-color-accent)]'
                        : 'font-normal text-[var(--mc-color-text-secondary)]',
                    ].join(' ')}
                  >
                    {DIAS_CORTO[idx]}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[12px] tabular-nums text-[var(--mc-color-text-secondary)]">
                    {esHoy ? (
                      <span
                        className="mc-semana-dia-col__hoy-badge"
                        title="Hoy"
                        aria-label={`Hoy, ${d.getDate()}`}
                      >
                        {d.getDate()}
                      </span>
                    ) : d.getDate()}
                  </span>
                  {totalCnt > 0 && (
                    <span className={`mc-semana-dia-col__progreso${todoListo ? ' mc-semana-dia-col__progreso-ok' : ''}`}>
                      {completadasCnt}/{totalCnt}
                    </span>
                  )}
                  {esHoy && (notasHoyCount ?? 0) > 0 && (
                    <span
                      className="self-center h-1.5 w-1.5 rounded-full bg-[var(--mc-color-accent)] opacity-60"
                      title={`${notasHoyCount} nota${notasHoyCount! > 1 ? 's' : ''}`}
                      aria-hidden
                    />
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1 border-b border-[var(--mc-color-border)] px-2 py-1.5">
                    <input
                      type="text"
                      className="min-w-0 flex-1 rounded-[var(--mc-radius-sm)] border border-[var(--mc-color-border)] bg-[var(--mc-color-bg)] px-2 py-1 text-[11px] placeholder:text-[var(--mc-color-text-secondary)] focus:border-[var(--mc-color-accent)] focus:outline-none disabled:opacity-50"
                      placeholder="Nueva tarea…"
                      value={tareasRapidas[ymd] ?? ''}
                      onChange={(e) => setTareaRapida(ymd, e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleGuardarTarea(ymd); } }}
                      disabled={guardandoTarea === ymd}
                      aria-label={`Nueva tarea para ${DIAS_CORTO[idx]}`}
                    />
                    <button
                      type="button"
                      disabled={!(tareasRapidas[ymd] ?? '').trim() || guardandoTarea === ymd}
                      onClick={() => void handleGuardarTarea(ymd)}
                      className="shrink-0 rounded-[var(--mc-radius-sm)] p-1 text-[var(--mc-color-accent)] hover:bg-[var(--mc-color-bg-secondary)] disabled:opacity-40"
                      aria-label="Crear tarea"
                    >
                      <Plus size={12} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => onAbrirModalDia(ymd)}
                      className="shrink-0 rounded-[var(--mc-radius-sm)] p-1 text-[var(--mc-color-text-secondary)] hover:bg-[var(--mc-color-bg-secondary)]"
                      title="Crear con más opciones"
                      aria-label="Abrir formulario completo"
                    >
                      <MoreHorizontal size={12} aria-hidden />
                    </button>
                  </div>

                <SemanaColumnaScrollArea>
                  <div
                    className={[
                      'mc-semana-dia-drop flex flex-col gap-2 p-2',
                      overYmd === ymd && draggingId ? 'mc-semana-dia-drop--over' : '',
                    ].filter(Boolean).join(' ')}
                    onDragOver={(e) => { if (!onMoverTarea) return; e.preventDefault(); setOverYmd(ymd); }}
                    onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverYmd(null); }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      const tid = e.dataTransfer.getData('tareaId');
                      const fromYmd = e.dataTransfer.getData('fromYmd');
                      setDraggingId(null);
                      setDraggingFromYmd(null);
                      setOverYmd(null);
                      if (tid && fromYmd !== ymd && onMoverTarea) await onMoverTarea(tid, ymd);
                    }}
                  >
                    {/* Placeholder visual que indica dónde caerá la card */}
                    {overYmd === ymd && draggingId && draggingFromYmd !== ymd && (
                      <div className="mc-semana-drop-placeholder" aria-hidden />
                    )}

                    {eventosEnDia(eventos, ymd).map((ev) => (
                      <EventoCard
                        key={ev.id}
                        evento={ev}
                        {...(onEventoClick ? { onClick: onEventoClick } : {})}
                      />
                    ))}

                    {sinContenido && (
                      <p className="mc-semana-dia-empty">Sin tareas</p>
                    )}

                    {delDiaActivas.map((t) => {
                      const gestiona = puedeGestionar(t);
                      const areaNombre = t.area_id ? areasPorId.get(t.area_id) : undefined;
                      const isDragging = draggingId === t.id;
                      return (
                        <div
                          key={t.id}
                          className={[
                            (gestiona && onMoverTarea) ? 'mc-semana-task-draggable' : '',
                            isDragging ? 'mc-semana-task-dragging' : '',
                          ].filter(Boolean).join(' ') || undefined}
                          draggable={Boolean(gestiona && onMoverTarea)}
                          onDragStart={(e) => {
                            setDraggingId(t.id);
                            setDraggingFromYmd(ymd);
                            e.dataTransfer.setData('tareaId', t.id);
                            e.dataTransfer.setData('fromYmd', ymd);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragEnd={() => {
                            setDraggingId(null);
                            setDraggingFromYmd(null);
                            setOverYmd(null);
                          }}
                        >
                          <TareaSemanaCard
                            tarea={t}
                            hoyYmd={hoyYmd}
                            ot={ordenesPorTarea.get(t.id) ?? null}
                            responsableNombre={nombresPorId.get(t.asignado_a) ?? '—'}
                            {...(areaNombre ? { areaNombre } : {})}
                            readOnly={!gestiona}
                            compacta={esCompacta}
                            completandoEsta={completarPendingId === t.id}
                            iniciandoEsta={iniciarPendingId === t.id}
                            onOpenDetalle={(x) => onAbrirDetalle(x.id)}
                            {...(gestiona && onIniciarTarea ? { onIniciar: onIniciarTarea } : {})}
                            {...(gestiona && onCompletarTarea ? { onCompletar: onCompletarTarea } : {})}
                            {...(gestiona && onReprogramarTarea ? { onReprogramar: onReprogramarTarea } : {})}
                            {...(gestiona && onCancelarTarea ? { onCancelar: onCancelarTarea } : {})}
                            {...(gestiona && onEliminarTarea ? { onEliminar: onEliminarTarea } : {})}
                            {...(onOtClick ? { onOtClick } : {})}
                          />
                        </div>
                      );
                    })}

                    {delDiaTerminadas.length > 0 && (
                      <>
                        <button
                          type="button"
                          className="mc-semana-terminadas-toggle"
                          onClick={() => toggleTerminadas(ymd)}
                          aria-expanded={terminadasVisible}
                        >
                          <span className={`mc-semana-terminadas-toggle__chevron${terminadasVisible ? ' mc-semana-terminadas-toggle__chevron--open' : ''}`}>›</span>
                          {delDiaTerminadas.length === 1 ? '1 finalizada' : `${delDiaTerminadas.length} finalizadas`}
                        </button>
                        {terminadasVisible && delDiaTerminadas.map((t) => {
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
                              compacta={esCompacta}
                              completandoEsta={completarPendingId === t.id}
                              iniciandoEsta={iniciarPendingId === t.id}
                              onOpenDetalle={(x) => onAbrirDetalle(x.id)}
                              {...(onOtClick ? { onOtClick } : {})}
                            />
                          );
                        })}
                      </>
                    )}
                  </div>
                </SemanaColumnaScrollArea>

                {esHoy && notasHoySlot}

                {(incidenciasDia.length > 0 || esHoy) && (
                  <div className="mc-semana-dia-col__pie shrink-0">
                    <SemanaIncidenciasAcordeon
                      incidencias={incidenciasDia}
                      hoyYmd={hoyYmd}
                      esHoy={esHoy}
                      puedeAbrir={(inc) => puedeGestionar(inc)}
                      onAbrirDetalle={onAbrirDetalle}
                    />
                    {esHoy && (
                      <div className="flex items-center gap-1 px-2 pb-2 pt-1">
                        <input
                          type="text"
                          className="min-w-0 flex-1 rounded-[var(--mc-radius-sm)] border border-[var(--mc-color-border)] bg-[var(--mc-color-bg)] px-2 py-1 text-[11px] placeholder:text-[var(--mc-color-text-secondary)] focus:border-[var(--mc-color-info)] focus:outline-none disabled:opacity-50"
                          placeholder="Registrar incidencia…"
                          value={incRapida}
                          onChange={(e) => setIncRapida(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleGuardarInc(); } }}
                          disabled={guardandoInc}
                          aria-label="Registrar incidencia rápida"
                        />
                        <button
                          type="button"
                          disabled={!incRapida.trim() || guardandoInc}
                          onClick={() => void handleGuardarInc()}
                          className="shrink-0 rounded-[var(--mc-radius-sm)] p-1 text-[var(--mc-color-info)] hover:bg-[var(--mc-color-bg-secondary)] disabled:opacity-40"
                          aria-label="Guardar incidencia"
                        >
                          <Send size={12} aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRegistrarIncidencia(ymd)}
                          className="shrink-0 rounded-[var(--mc-radius-sm)] p-1 text-[var(--mc-color-text-secondary)] hover:bg-[var(--mc-color-bg-secondary)]"
                          title="Más opciones"
                          aria-label="Abrir formulario completo de incidencia"
                        >
                          <MoreHorizontal size={12} aria-hidden />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
