/**
 * components/layout/PageHeader.tsx
 *
 * Cabecera de módulo:
 * - Fila 1: título (izquierda) · acciones (derecha: filtros, selector, CTA).
 * - Fila 2: subtítulo (p. ej. rango de fechas) + controles secundarios (flechas, etc.).
 */

import type { ReactNode } from 'react';

type Props = {
  title:      string;
  /** Badge o etiqueta junto al título (p. ej. «Solo lectura»). */
  titleAddon?: ReactNode;
  /** Subtítulo principal — se renderiza como `<h2>` (rango de fechas, etc.). */
  subtitle?:  ReactNode;
  /** Texto descriptivo secundario bajo el subtítulo. */
  detail?:    ReactNode;
  /** Controles bajo el subtítulo (flechas de semana, toggles). */
  left?:      ReactNode;
  /** Lado derecho de la fila 1: filtros, selector de miembro, botón principal. */
  actions?:   ReactNode;
};

export function PageHeader({ title, titleAddon, subtitle, detail, left, actions }: Props) {
  const hasBottom = Boolean(subtitle) || Boolean(detail) || Boolean(left);

  return (
    <header className="mc-page-header">
      <div className="mc-page-header-top">
        <div className="mc-page-title-wrap">
          <h1 className="mc-page-title">{title}</h1>
          {titleAddon ? <div className="mc-page-title-addon">{titleAddon}</div> : null}
        </div>
        {actions ? <div className="mc-page-header-actions">{actions}</div> : null}
      </div>
      {hasBottom ? (
        <div className="mc-page-header-bottom">
          <div className="mc-page-header-meta">
            {subtitle ? <h2 className="mc-page-subtitle">{subtitle}</h2> : null}
            {detail ? <p className="mc-page-detail">{detail}</p> : null}
            {left ? <div className="mc-page-header-controls">{left}</div> : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}
