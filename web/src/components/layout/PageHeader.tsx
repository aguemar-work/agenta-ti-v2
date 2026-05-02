/**
 * components/layout/PageHeader.tsx
 *
 * Componente de cabecera reutilizable para todas las vistas.
 * Estructura fija: [título + subtítulo] ←→ [acciones]
 * Con separador inferior sutil y espaciado consistente.
 *
 * Slots:
 *   title       — texto principal (h1)
 *   subtitle    — texto secundario (fecha, semana, descripción)
 *   left        — controles a la izquierda del título (toggle, flechas nav)
 *   actions     — controles a la derecha (filtros, CTA, selector)
 */

import type { ReactNode } from 'react';

type Props = {
  title: string;
  subtitle?: ReactNode;
  /** Controles pegados al bloque de título (toggle Hoy/Semana, flechas nav) */
  left?: ReactNode;
  /** Controles del lado derecho: filtros, selector de miembro, botón CTA */
  actions?: ReactNode;
};

export function PageHeader({ title, subtitle, left, actions }: Props) {
  return (
    <header className="mc-page-header">
      {/* Bloque izquierdo: título + subtítulo + controles de navegación */}
      <div className="mc-page-header-left">
        <div className="mc-page-header-titles">
          <h1 className="mc-page-title">{title}</h1>
          {subtitle && <p className="mc-page-subtitle">{subtitle}</p>}
        </div>
        {left && (
          <div className="mc-page-header-controls">{left}</div>
        )}
      </div>

      {/* Bloque derecho: acciones */}
      {actions && (
        <div className="mc-page-header-actions">{actions}</div>
      )}
    </header>
  );
}