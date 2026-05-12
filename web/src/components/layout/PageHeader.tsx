/**
 * components/layout/PageHeader.tsx
 *
 * Cabecera de módulo:
 * - Fila 1: título (izquierda) · acciones (derecha: filtros, selector, CTA).
 * - Fila 2: subtítulo (p. ej. rango de fechas) + controles secundarios (flechas, etc.).
 */

import type { ReactNode } from 'react';

type Props = {
  title:     string;
  subtitle?: ReactNode;
  /** Controles bajo el subtítulo (flechas de semana, toggles). */
  left?:     ReactNode;
  /** Lado derecho de la fila 1: filtros, selector de miembro, botón principal. */
  actions?:  ReactNode;
};

export function PageHeader({ title, subtitle, left, actions }: Props) {
  const hasBottom = Boolean(subtitle) || Boolean(left);

  return (
    <header className="mc-page-header">
      <div className="mc-page-header-top">
        <h1 className="mc-page-title">{title}</h1>
        {actions ? <div className="mc-page-header-actions">{actions}</div> : null}
      </div>
      {hasBottom ? (
        <div className="mc-page-header-bottom">
          <div className="mc-page-header-meta">
            {subtitle ? <p className="mc-page-subtitle">{subtitle}</p> : null}
            {left ? <div className="mc-page-header-controls">{left}</div> : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}
