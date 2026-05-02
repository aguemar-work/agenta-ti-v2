import { Clock, RefreshCw } from 'lucide-react';
import type { Evento, TipoEvento } from '@/types';

// ---------------------------------------------------------------------------
// Helpers de presentación
// ---------------------------------------------------------------------------

const TIPO_CONFIG: Record<TipoEvento, { label: string; colorBar: string; colorBg: string; colorText: string }> = {
  reunion:  { label: 'Reunión',   colorBar: 'var(--mc-color-accent)',   colorBg: 'color-mix(in srgb, var(--mc-color-accent) 8%, transparent)',   colorText: 'var(--mc-color-accent)' },
  entrega:  { label: 'Entrega',   colorBar: 'var(--mc-color-warning)',  colorBg: 'color-mix(in srgb, var(--mc-color-warning) 8%, transparent)',  colorText: 'var(--mc-color-warning)' },
  personal: { label: 'Personal',  colorBar: 'var(--mc-color-success)',  colorBg: 'color-mix(in srgb, var(--mc-color-success) 8%, transparent)',  colorText: 'var(--mc-color-success)' },
  otro:     { label: 'Otro',      colorBar: 'var(--mc-color-text-secondary)', colorBg: 'color-mix(in srgb, var(--mc-color-text-secondary) 8%, transparent)', colorText: 'var(--mc-color-text-secondary)' },
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

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

type Props = {
  evento: Evento;
};

export function EventoCard({ evento }: Props) {
  const cfg = TIPO_CONFIG[evento.tipo] ?? TIPO_CONFIG.otro;
  const horaInicio = formatHora(evento.fecha_inicio);
  const horaFin    = formatHora(evento.fecha_fin);
  const duracion   = duracionMin(evento.fecha_inicio, evento.fecha_fin);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        borderRadius: 'var(--mc-radius-md)',
        border: '1px solid var(--mc-color-border)',
        overflow: 'hidden',
        background: cfg.colorBg,
        minHeight: 0,
      }}
      role="article"
      aria-label={`Evento: ${evento.titulo}`}
    >
      {/* Barra de color lateral */}
      <div
        style={{
          width: 3,
          flexShrink: 0,
          background: cfg.colorBar,
          borderRadius: 0,
        }}
        aria-hidden
      />

      {/* Contenido */}
      <div style={{ flex: 1, padding: '5px 8px', minWidth: 0 }}>
        {/* Título */}
        <p
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--mc-color-text)',
            lineHeight: 1.35,
            marginBottom: 3,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {evento.titulo}
        </p>

        {/* Meta row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          {/* Badge tipo */}
          <span
            style={{
              fontSize: 10,
              fontWeight: 500,
              padding: '1px 6px',
              borderRadius: 3,
              background: cfg.colorBar,
              color: '#fff',
              flexShrink: 0,
            }}
          >
            {cfg.label}
          </span>

          {/* Horario */}
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 10,
              color: 'var(--mc-color-text-secondary)',
            }}
          >
            <Clock size={10} aria-hidden />
            {horaInicio} – {horaFin}
          </span>

          {/* Duración */}
          <span style={{ fontSize: 10, color: 'var(--mc-color-text-secondary)' }}>
            {formatDuracion(duracion)}
          </span>

          {/* Recurrente */}
          {evento.es_recurrente && (
            <span
              style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 10, color: 'var(--mc-color-text-secondary)' }}
              title="Evento recurrente"
            >
              <RefreshCw size={10} aria-hidden />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}