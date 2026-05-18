import { Clock, RefreshCw } from 'lucide-react';

import type { Evento, TipoEvento } from '@/types';

const TIPO_LABEL: Record<TipoEvento, string> = {
  reunion: 'Reunión',
  entrega: 'Entrega',
  personal: 'Personal',
  otro: 'Otro',
};

function formatHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

function duracionMin(inicio: string, fin: string): number {
  return Math.round((new Date(fin).getTime() - new Date(inicio).getTime()) / 60000);
}

function formatDuracion(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Horario compacto para la tercera línea (equivalente al «aviso» de tareas). */
function getEventoHorarioLinea(evento: Evento): string {
  const duracion = formatDuracion(duracionMin(evento.fecha_inicio, evento.fecha_fin));
  return `${formatHora(evento.fecha_inicio)} – ${formatHora(evento.fecha_fin)} · ${duracion}`;
}

/**
 * Card de evento en columna de día.
 * Misma lectura que tareas: título + tipo (pill) + horario (línea secundaria).
 */
export function EventoCard({ evento }: { evento: Evento }) {
  const horario = getEventoHorarioLinea(evento);

  return (
    <div
      className={['mc-evento-card', `mc-evento-card--${evento.tipo}`].join(' ')}
      role="article"
      aria-label={`${TIPO_LABEL[evento.tipo]}: ${evento.titulo}, ${horario}`}
    >
      <p className="mc-evento-card__title">{evento.titulo}</p>

      <div className="mc-evento-card__meta">
        <span className={`mc-meta-pill mc-meta-pill--evento-${evento.tipo}`}>
          {TIPO_LABEL[evento.tipo]}
        </span>
        {evento.es_recurrente && (
          <span className="mc-meta-pill mc-meta-pill--evento-recurrente" title="Evento recurrente">
            <RefreshCw size={10} aria-hidden />
            Recurrente
          </span>
        )}
      </div>

      <p className="mc-evento-card__horario">
        <Clock size={11} strokeWidth={2} aria-hidden />
        {horario}
      </p>
    </div>
  );
}
