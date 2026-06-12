/**
 * components/ui/EmptyState.tsx
 *
 * Empty state unificado. Reemplaza implementaciones locales por todo el sistema.
 *
 * - `icon`:    Lucide opcional (omitir en variantes compactas dentro de sub-zonas).
 * - `title`:   título principal (siempre presente).
 * - `desc`:    descripción secundaria opcional.
 * - `cta`:     ReactNode opcional para botón de "Crear primer X".
 * - `compact`: variante sin icono y padding reducido (para panels y sub-zonas).
 */

import type { ElementType, ReactNode } from 'react';

interface EmptyStateProps {
  icon?:    ElementType;
  title:    string;
  desc?:    string;
  cta?:     ReactNode;
  compact?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  desc,
  cta,
  compact = false,
}: EmptyStateProps) {
  const cls = ['mc-empty', compact && 'mc-empty--compact'].filter(Boolean).join(' ');

  return (
    <div className={cls} role="status">
      {!compact && Icon ? (
        <Icon size={32} className="mc-empty-icon" aria-hidden />
      ) : null}
      <h2 className="mc-empty-title">{title}</h2>
      {desc ? <p className="mc-empty-desc">{desc}</p> : null}
      {cta ? <div className="mc-empty-cta">{cta}</div> : null}
    </div>
  );
}
