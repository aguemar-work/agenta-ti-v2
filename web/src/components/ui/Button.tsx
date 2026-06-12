/**
 * components/ui/Button.tsx
 *
 * Sistema de botones con jerarquía Apple aplicada a SGTD.
 *
 * Variantes:
 *   primary     — Azul. LA acción principal. Máximo 1 por vista.
 *   secondary   — Gris con borde. Alternativa directa (Reprogramar, paginación).
 *   tertiary    — Transparente con borde accent. Acciones de baja urgencia con consecuencia visible.
 *   ghost       — Cancelar en fila horizontal junto al primary (Patrón A). No usar como única CTA.
 *   danger      — Rojo. Solo en zona destructive separada por border-t.
 *   quaternary  — Texto accent sin fondo ni borde. Ver historial, Limpiar filtros.
 *
 * Navegación por texto (React Router <Link>, pie de auth):
 *   Clases CSS `mc-text-link` (énfasis accent) y `mc-text-link-muted` (volver atrás).
 *   Misma jerarquía visual que quaternary / texto secundario; no duplicar estilos inline.
 *
 * Tamaños:
 *   lg          — Hero task y botones principales de modal (h-11, full-width típicamente).
 *   default     — Uso general en headers y acciones de página.
 *   sm          — Acciones secundarias en tarjetas, columnas, listas.
 *   xs          — Vistas densas: Planificación, logs, tablas. Solo desktop.
 *
 * Componente especial:
 *   <CancelButton> — Para el Cancelar de modales. Texto centrado debajo del primary.
 *                    No usa el sistema de variantes para no contaminar.
 */

import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger' | 'quaternary';
type Size    = 'lg' | 'default' | 'sm' | 'xs';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children:  ReactNode;
  variant?:  Variant;
  size?:     Size;
  fullWidth?: boolean;
  /** Muestra spinner y deshabilita el botón durante acciones asíncronas. */
  loading?:  boolean;
};

const VARIANT_CLASS: Record<Variant, string> = {
  primary:    'mc-btn',
  secondary:  'mc-btn-secondary',
  tertiary:   'mc-btn-tertiary',
  ghost:      'mc-btn-ghost',
  danger:     'mc-btn-danger',
  quaternary: 'mc-btn-quaternary',
};

const SIZE_CLASS: Record<Size, string> = {
  lg:      'mc-btn-lg',
  default: '',
  sm:      'mc-btn-sm',
  xs:      'mc-btn-xs',
};

export function Button({
  children,
  variant   = 'primary',
  size      = 'default',
  fullWidth = false,
  loading   = false,
  className = '',
  type      = 'button',
  disabled,
  ...rest
}: Props) {
  const classes = [
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    fullWidth ? 'mc-btn-full' : '',
    loading ? 'mc-btn--loading' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <Loader2 size={16} className="mc-btn-spinner" aria-hidden />
      ) : null}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// CancelButton — Patrón B: debajo del primary a ancho completo (modales con formulario).
//
// Uso correcto:
//   <Button variant="primary" size="lg" fullWidth>…</Button>
//   <CancelButton onClick={onClose} />
//
// Patrón A (fila: Cancelar + Confirmar) usa <Button variant="ghost">Cancelar</Button>.
// ---------------------------------------------------------------------------

type CancelProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label?: string;
};

export function CancelButton({ label = 'Cancelar', className = '', type = 'button', ...rest }: CancelProps) {
  return (
    <button
      type={type}
      className={['mc-btn-cancel', className].filter(Boolean).join(' ')}
      {...rest}
    >
      {label}
    </button>
  );
}