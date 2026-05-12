import { Clock, RefreshCw } from 'lucide-react';

import type { Evento, TipoEvento } from '@/types';

const TIPO_CONFIG: Record<TipoEvento, { label: string; badge: string }> = {
  reunion: {
    label: 'Reunión',
    badge: 'var(--mc-brand-violet)',
  },
  entrega: {
    label: 'Entrega',
    badge: 'var(--mc-color-warning)',
  },
  personal: {
    label: 'Personal',
    badge: 'var(--mc-color-success)',
  },
  otro: {
    label: 'Otro',
    badge: 'var(--mc-color-text-secondary)',
  },
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

export function EventoCard({ evento }: { evento: Evento }) {
  const cfg = TIPO_CONFIG[evento.tipo] ?? TIPO_CONFIG.otro;
  const duracion = duracionMin(evento.fecha_inicio, evento.fecha_fin);
  const esReunion = evento.tipo === 'reunion';

  return (
    <div
      className={['mc-evento-card', esReunion ? 'mc-evento-card--reunion' : ''].filter(Boolean).join(' ')}
      role="article"
      aria-label={`Evento: ${evento.titulo}`}
    >
      <p className="mc-evento-card__title">{evento.titulo}</p>

      <div className="mc-evento-card__footer">
        <span className="mc-evento-card-badge" style={{ background: cfg.badge }}>
          {cfg.label}
        </span>
        <div className="mc-evento-card-meta" style={{ marginLeft: 'auto' }}>
          <span className="mc-evento-card-hora">
            <Clock size={10} aria-hidden />
            {formatHora(evento.fecha_inicio)} – {formatHora(evento.fecha_fin)}
          </span>
          <span className="mc-evento-card-duracion">{formatDuracion(duracion)}</span>
          {evento.es_recurrente && (
            <span className="mc-evento-card-recurrente" title="Evento recurrente">
              <RefreshCw size={10} aria-hidden />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
