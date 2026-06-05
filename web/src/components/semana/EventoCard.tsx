import { Calendar } from 'lucide-react';

import type { Evento } from '@/types';

function formatHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

/** Evento en columna: calendario + hora (no prioridad ni estado de tarea). */
export function EventoCard({ evento }: { evento: Evento }) {
  const horario = `${formatHora(evento.fecha_inicio)} – ${formatHora(evento.fecha_fin)}`;

  return (
    <div
      className="mc-evento-card mc-evento-card--v2"
      role="article"
      aria-label={`${evento.titulo}, ${horario}`}
    >
      <Calendar size={14} aria-hidden className="mc-evento-card__icon" />
      <div className="mc-evento-card__body">
        <p className="mc-evento-card__title">{evento.titulo}</p>
        <p className="mc-evento-card__hora">{horario}</p>
      </div>
      {evento.es_recurrente ? (
        <span className="mc-evento-card__recurrente" title="Recurrente" aria-label="Recurrente">
          ↻
        </span>
      ) : null}
    </div>
  );
}
