import { ChevronUp } from 'lucide-react';
import { useId, useState } from 'react';

import type { Tarea } from '@/types';

type Props = {
  incidencias: Tarea[];
  hoyYmd: string;
  esHoy: boolean;
  puedeAbrir: (inc: Tarea) => boolean;
  onAbrirDetalle: (incidenciaId: string) => void;
};

/** Acordeón inferior: al abrir, lista hacia arriba sobre las cards del día. */
export function SemanaIncidenciasAcordeon({
  incidencias,
  hoyYmd,
  esHoy,
  puedeAbrir,
  onAbrirDetalle,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const panelId = useId();
  const count = incidencias.length;

  if (!esHoy && count === 0) return null;

  return (
    <div className="mc-semana-inc-acordeon shrink-0 border-t border-[var(--mc-color-border)]">
      <div className="mc-semana-inc-acordeon__anchor">
        {abierto && (
          <div
            id={panelId}
            className="mc-semana-inc-acordeon__panel"
            role="region"
            aria-label="Listado de incidencias"
          >
            {count === 0 ? (
              <p className="mc-semana-inc-acordeon__empty">Sin incidencias registradas.</p>
            ) : (
              <ul className="mc-semana-inc-acordeon__list">
                {incidencias.map((inc) => {
                  const editable = puedeAbrir(inc);
                  const esPasado = (inc.fecha_planificada ?? '') < hoyYmd;
                  return (
                    <li key={inc.id}>
                      <button
                        type="button"
                        className="mc-semana-inc-acordeon__item"
                        disabled={!editable}
                        onClick={() => editable && onAbrirDetalle(inc.id)}
                        aria-label={`Incidencia: ${inc.titulo}${esPasado || !editable ? ' (solo lectura)' : ''}`}
                      >
                        <span className="mc-semana-inc-acordeon__titulo">{inc.titulo}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        <button
          type="button"
          className="mc-semana-inc-acordeon__trigger"
          aria-expanded={abierto}
          aria-controls={panelId}
          onClick={() => setAbierto((v) => !v)}
        >
          <span className="mc-semana-inc-acordeon__label">Incidencias</span>
          <span className="mc-semana-inc-acordeon__count">{count}</span>
          <ChevronUp
            size={14}
            aria-hidden
            className={[
              'mc-semana-inc-acordeon__chevron',
              abierto ? 'mc-semana-inc-acordeon__chevron--open' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          />
        </button>
      </div>
    </div>
  );
}
