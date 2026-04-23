/**
 * components/ui/Button.tsx
 * Reemplaza los overrides !px-3 !py-2 text-xs dispersos por props tipadas.
 *
 * Antes:  <button className="mc-btn !px-3 !py-2 text-xs">
 * Ahora:  <Button size="sm">
 *
 * Antes:  <button className="mc-btn !bg-[var(--mc-color-danger)]">
 * Ahora:  <Button variant="danger">
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'default' | 'sm' | 'xs';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
};

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'mc-btn',
  secondary: 'mc-btn-secondary',
  ghost: 'mc-btn-ghost',
  danger: 'mc-btn-danger',
};

const SIZE_CLASS: Record<Size, string> = {
  default: '',
  sm: 'mc-btn-sm',
  xs: 'mc-btn-xs',
};

export function Button({
  children,
  variant = 'primary',
  size = 'default',
  className = '',
  type = 'button',
  ...rest
}: Props) {
  const classes = [
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    className,
  ].filter(Boolean).join(' ');

  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}