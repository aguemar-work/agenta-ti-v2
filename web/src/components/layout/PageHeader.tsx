/**
 * components/layout/PageHeader.tsx
 *
 * Cabecera Apple: título 24px bold, subtítulo visible, sin border-bottom.
 * El espacio separa el header del contenido, no una línea.
 * API idéntica — cero breaking changes.
 */

import type { ReactNode } from 'react';

type Props = {
  title:     string;
  subtitle?: ReactNode;
  /** Controles pegados al título (toggle Hoy/Semana, flechas nav) */
  left?:     ReactNode;
  /** Controles del lado derecho: filtros, selector de miembro, CTA */
  actions?:  ReactNode;
};

export function PageHeader({ title, subtitle, left, actions }: Props) {
  return (
    <header className="mc-page-header">
      <div className="mc-page-header-left">
        <div className="mc-page-header-titles">
          <h1 className="mc-page-title">{title}</h1>
          {subtitle && <p className="mc-page-subtitle">{subtitle}</p>}
        </div>
        {left && (
          <div className="mc-page-header-controls">{left}</div>
        )}
      </div>
      {actions && (
        <div className="mc-page-header-actions">{actions}</div>
      )}
    </header>
  );
}