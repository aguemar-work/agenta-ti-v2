/**
 * Vista lista — alternativa tabular al kanban semanal.
 * Muestra todas las tareas de la semana en filas horizontales con
 * columnas: Fecha · Título · Prioridad · Estado · Responsable · Acción rápida.
 */
import { useMemo } from 'react';
import { Check, ChevronsUp, Equal, Flame, Play } from 'lucide-react';

import { TareaEstadoIndicator } from '@/components/tareas/TareaEstadoIndicator';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { fechaLocalYmd } from '@/lib/fecha';
import { estadoEfectivoTablero, claveVisualTarea } from '@/lib/tableroEstado';
import type { MiSemanaGrillaProps } from '@/components/semana/MiSemanaGrilla';
import type { PrioridadTarea } from '@/types';

const DIAS_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;
const SIN_INICIAR_ESTADOS = ['pendiente', 'reprogramada', 'atrasada'] as const;

const PRIORIDAD_CHIP: Record<
  PrioridadTarea,
  { icon: typeof Flame; clase: string; label: string } | null
> = {
  critica: { icon: Flame,      clase: 'mc-chip--prioridad-critica', label: 'Crítica' },
  alta:    { icon: ChevronsUp, clase: 'mc-chip--prioridad-alta',    label: 'Alta'    },
  media:   { icon: Equal,      clase: 'mc-chip--prioridad-media',   label: 'Media'   },
  baja:    null,
};

export function MiSemanaLista(props: MiSemanaGrillaProps) {
  const {
    diasSemana,
    hoyYmd,
    tareasPlan,
    filtroEstado,
    filtroRapido,
    busqueda,
    ordenesPorTarea,
    nombresPorId,
    areasPorId,
    puedeGestionar,
    onAbrirDetalle,
    completarPendingId,
    iniciarPendingId,
    onIniciarTarea,
    onCompletarTarea,
  } = props;

  // ymd → índice del día (para la etiqueta "Lun 16")
  const ymdMeta = useMemo(() => {
    const map = new Map<string, { idx: number; d: Date }>();
    diasSemana.forEach((d, i) => map.set(fechaLocalYmd(d), { idx: i, d }));
    return map;
  }, [diasSemana]);

  const tareas = useMemo(() => {
    const base = tareasPlan.filter((t) => !t.es_imprevisto);
    const filtradas = (() => {
      let result = base;
      if (busqueda) {
        const q = busqueda.toLowerCase();
        result = result.filter((t) => t.titulo.toLowerCase().includes(q));
      }
      if (filtroEstado)
        return result.filter((t) => estadoEfectivoTablero(t, hoyYmd) === filtroEstado);
      if (filtroRapido === 'sin_iniciar')
        return result.filter((t) =>
          (SIN_INICIAR_ESTADOS as readonly string[]).includes(
            estadoEfectivoTablero(t, hoyYmd),
          ),
        );
      if (filtroRapido === 'atrasada')
        return result.filter((t) => estadoEfectivoTablero(t, hoyYmd) === 'atrasada');
      if (filtroRapido === 'critica')
        return result.filter((t) => t.prioridad === 'critica');
      return result;
    })();
    return filtradas.slice().sort((a, b) => {
      if (a.fecha_planificada !== b.fecha_planificada)
        return a.fecha_planificada.localeCompare(b.fecha_planificada);
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [tareasPlan, filtroEstado, filtroRapido, hoyYmd]);

  if (tareas.length === 0) {
    return (
      <div className="mc-misemana-grilla-host flex min-h-0 min-w-0 flex-1 items-center justify-center">
        <p className="text-sm text-[var(--mc-color-text-secondary)]">Sin tareas para mostrar.</p>
      </div>
    );
  }

  return (
    <div className="mc-misemana-grilla-host min-h-0 min-w-0 flex-1 overflow-y-auto">
      <div className="mc-semana-lista">

        {/* Cabecera de columnas */}
        <div className="mc-semana-lista__hdr" aria-hidden>
          <span>Fecha</span>
          <span>Título</span>
          <span className="mc-semana-lista__col-prio-hdr">Prioridad</span>
          <span className="mc-semana-lista__col-estado-hdr">Estado</span>
          <span className="mc-semana-lista__col-resp-hdr">Responsable</span>
          <span />
        </div>

        {tareas.map((t) => {
          const ymd        = t.fecha_planificada;
          const esHoy      = ymd === hoyYmd;
          const meta       = ymdMeta.get(ymd);
          const dateLabel  = meta
            ? `${DIAS_CORTO[meta.idx]} ${meta.d.getDate()}`
            : ymd;

          const clave      = claveVisualTarea(t, hoyYmd);
          const terminal   = t.estado === 'completada' || t.estado === 'cancelada';
          const gestiona   = puedeGestionar(t);
          const areaNombre = t.area_id ? areasPorId.get(t.area_id) : undefined;
          const respNombre = nombresPorId.get(t.asignado_a) ?? '—';
          const chip       = PRIORIDAD_CHIP[t.prioridad];

          const puedeIniciar   = gestiona && t.estado === 'pendiente'   && Boolean(onIniciarTarea);
          const puedeCompletar = gestiona && t.estado === 'en_progreso' && Boolean(onCompletarTarea);

          return (
            <div
              key={t.id}
              className={[
                'mc-semana-lista__row',
                terminal              ? 'mc-semana-lista__row--terminal'  : '',
                clave === 'atrasada'  ? 'mc-semana-lista__row--atrasada'  : '',
                clave === 'en_progreso' ? 'mc-semana-lista__row--en-progreso' : '',
              ].filter(Boolean).join(' ')}
              role="button"
              tabIndex={0}
              onClick={() => onAbrirDetalle(t.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onAbrirDetalle(t.id);
              }}
            >
              {/* Fecha */}
              <span
                className={[
                  'mc-semana-lista__fecha',
                  esHoy ? 'mc-semana-lista__fecha--hoy' : '',
                ].filter(Boolean).join(' ')}
              >
                {dateLabel}
              </span>

              {/* Título + área */}
              <span className="mc-semana-lista__titulo">
                <span className="mc-semana-lista__titulo-text">{t.titulo}</span>
                {areaNombre && (
                  <span className="mc-semana-lista__area">{areaNombre}</span>
                )}
              </span>

              {/* Prioridad */}
              <span className="mc-semana-lista__prio mc-semana-lista__col-prio-hdr">
                {chip ? (
                  <span
                    className={`mc-chip ${chip.clase} mc-semana-lista__prio-chip`}
                    aria-label={`Prioridad ${chip.label}`}
                    title={chip.label}
                  >
                    <chip.icon size={11} aria-hidden />
                    <span>{chip.label}</span>
                  </span>
                ) : (
                  <span className="mc-semana-lista__prio-baja">Baja</span>
                )}
              </span>

              {/* Estado */}
              <span className="mc-semana-lista__estado mc-semana-lista__col-estado-hdr">
                <TareaEstadoIndicator estado={clave} variant="pill" />
              </span>

              {/* Responsable */}
              <span className="mc-semana-lista__resp mc-semana-lista__col-resp-hdr">
                <Avatar nombre={respNombre} size="sm" />
                <span className="mc-semana-lista__resp-nombre">{respNombre}</span>
              </span>

              {/* Acción rápida */}
              <span
                className="mc-semana-lista__actions"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                {puedeIniciar && (
                  <Button
                    variant="secondary"
                    size="xs"
                    loading={iniciarPendingId === t.id}
                    onClick={() => onIniciarTarea!(t)}
                  >
                    <Play size={11} aria-hidden />
                    Iniciar
                  </Button>
                )}
                {puedeCompletar && (
                  <Button
                    variant="secondary"
                    size="xs"
                    loading={completarPendingId === t.id}
                    onClick={() => onCompletarTarea!(t)}
                  >
                    <Check size={11} aria-hidden />
                    Completar
                  </Button>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
