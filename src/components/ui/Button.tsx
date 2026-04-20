import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: 'primary' | 'ghost';
};

export function Button({
  children,
  variant = 'primary',
  className = '',
  type = 'button',
  ...rest
}: Props) {
  const base =
    'inline-flex items-center justify-center rounded-[var(--mc-radius-md)] px-4 py-2 text-[var(--mc-text-sm)] font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none';
  const styles =
    variant === 'primary'
      ? 'bg-[var(--mc-color-accent)] text-white hover:bg-[var(--mc-color-accent-hover)]'
      : 'bg-transparent text-[var(--mc-color-text)] hover:bg-[var(--mc-color-surface-hover)] border border-[var(--mc-color-border)]';

  return (
    <button type={type} className={`${base} ${styles} ${className}`.trim()} {...rest}>
      {children}
    </button>
  );
}
