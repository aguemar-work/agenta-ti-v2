import { Clock, RefreshCw } from 'lucide-react';

import type { Evento, TipoEvento } from '@/types';

const TIPO_CONFIG: Record<TipoEvento, { label: string; bar: string; bg: string }> = {
  reunion: {
    label: 'Reunión',
    bar: 'var(--mc-color-accent)',
    bg: 'color-mix(in srgb, var(--mc-color-accent) 8%, transparent)',
  },
  entrega: {
    label: 'Entrega',
    bar: 'var(--mc-color-warning)',
    bg: 'color-mix(in srgb, var(--mc-color-warning) 8%, transparent)',
  },
  personal: {
    label: 'Personal',
    bar: 'var(--mc-color-success)',
    bg: 'color-mix(in srgb, var(--mc-color-success) 8%, transparent)',
  },
  otro: {
    label: 'Otro',
    bar: 'var(--mc-color-text-secondary)',
    bg: 'color-mix(in srgb, var(--mc-color-text-secondary) 8%, transparent)',
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

  return (
    <div
      className="mc-evento-card"
      style={{ background: cfg.bg }}
      role="article"
      aria-label={`Evento: ${evento.titulo}`}
    >
      <div className="mc-evento-card-bar" style={{ background: cfg.bar }} aria-hidden />

      <div className="mc-evento-card-body">
        <p className="mc-evento-card-title">{evento.titulo}</p>

        <div className="mc-evento-card-meta">
          <span className="mc-evento-card-badge" style={{ background: cfg.bar }}>
            {cfg.label}
          </span>

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
