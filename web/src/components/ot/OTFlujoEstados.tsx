import type { EstadoOT } from '@/api/ordenTrabajo';
import { OT_FLUJO_PRINCIPAL, etiquetaFlujoOT } from '@/lib/otFlujoEstados';

type Props = {
  /** Resalta el paso actual (p. ej. OT seleccionada). */
  estadoDestacado?: EstadoOT | null;
  compact?: boolean;
  className?: string;
};

export function OTFlujoEstados({ estadoDestacado, compact = false, className = '' }: Props) {
  const rootClass = ['mc-ot-flujo', compact ? 'mc-ot-flujo--compact' : '', className].filter(Boolean).join(' ');

  return (
    <p className={rootClass} role="doc-subtitle">
      {OT_FLUJO_PRINCIPAL.map((estado, i) => {
        const activo = estadoDestacado === estado;
        const pasado =
          estadoDestacado != null &&
          OT_FLUJO_PRINCIPAL.indexOf(estadoDestacado) > i;
        return (
          <span key={estado} className="mc-ot-flujo__step">
            {i > 0 ? <span className="mc-ot-flujo__sep" aria-hidden>→</span> : null}
            <span
              className={[
                'mc-ot-flujo__label',
                activo ? 'mc-ot-flujo__label--activo' : '',
                pasado ? 'mc-ot-flujo__label--pasado' : '',
              ].filter(Boolean).join(' ')}
            >
              {etiquetaFlujoOT(estado)}
            </span>
          </span>
        );
      })}
    </p>
  );
}
