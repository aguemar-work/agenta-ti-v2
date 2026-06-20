import { useEffect, useState } from 'react';
import { Calendar, Package2, User, Users } from 'lucide-react';

import type { Evento } from '@/types';

const TIPO_ICON = {
  reunion:  Users,
  entrega:  Package2,
  personal: User,
  otro:     Calendar,
} as const;

type EstadoEvento = 'pasado' | 'en_curso' | 'proximo' | 'futuro';

function getEstadoEvento(fechaInicio: string, fechaFin: string): EstadoEvento {
  const now    = Date.now();
  const inicio = new Date(fechaInicio).getTime();
  const fin    = new Date(fechaFin).getTime();
  if (now > fin)                            return 'pasado';
  if (now >= inicio)                        return 'en_curso';
  if (inicio - now <= 30 * 60 * 1_000)     return 'proximo';
  return 'futuro';
}

function formatHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

const ESTADO_CLASS: Record<EstadoEvento, string> = {
  pasado:   'mc-evento-card--pasado',
  en_curso: 'mc-evento-card--en-curso',
  proximo:  'mc-evento-card--proximo',
  futuro:   '',
};

const ESTADO_BADGE: Record<EstadoEvento, string | null> = {
  pasado:   null,
  en_curso: 'En curso',
  proximo:  'Próx.',
  futuro:   null,
};

type Props = {
  evento: Evento;
  onClick?: (evento: Evento) => void;
};

export function EventoCard({ evento, onClick }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const horario   = `${formatHora(evento.fecha_inicio)} – ${formatHora(evento.fecha_fin)}`;
  const estado    = getEstadoEvento(evento.fecha_inicio, evento.fecha_fin);
  const Icon      = TIPO_ICON[evento.tipo] ?? Calendar;
  const badge     = ESTADO_BADGE[estado];
  const isButton  = Boolean(onClick);

  return (
    <div
      className={[
        'mc-evento-card mc-evento-card--v2',
        ESTADO_CLASS[estado],
        isButton ? 'mc-evento-card--clickable' : '',
      ].filter(Boolean).join(' ')}
      role={isButton ? 'button' : 'article'}
      tabIndex={isButton ? 0 : undefined}
      aria-label={`${evento.titulo}, ${horario}${badge ? `, ${badge.toLowerCase()}` : ''}`}
      onClick={isButton ? () => onClick!(evento) : undefined}
      onKeyDown={isButton
        ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick!(evento); } }
        : undefined}
    >
      <Icon size={14} aria-hidden className="mc-evento-card__icon" />
      <div className="mc-evento-card__body">
        <p className="mc-evento-card__title">{evento.titulo}</p>
        <p className="mc-evento-card__hora">{horario}</p>
      </div>
      <div className="mc-evento-card__right flex shrink-0 flex-col items-end gap-0.5">
        {badge && (
          <span className={`mc-evento-card__badge mc-evento-card__badge--${estado.replace('_', '-')}`}>
            {badge}
          </span>
        )}
        {evento.es_recurrente && (
          <span className="mc-evento-card__recurrente" title="Recurrente" aria-label="Recurrente">
            ↻
          </span>
        )}
      </div>
    </div>
  );
}
