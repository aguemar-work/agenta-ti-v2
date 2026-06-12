import { inicialesNombre } from '@/lib/metricasHelpers';

type Size = 'sm' | 'md';

type Props = {
  nombre: string;
  size?: Size;
  className?: string;
  title?: string;
};

const SIZE_CLASS: Record<Size, string> = {
  sm: 'mc-avatar mc-avatar--sm',
  md: 'mc-avatar mc-avatar--md',
};

/** Iniciales circulares — Materen Canvas. */
export function Avatar({ nombre, size = 'sm', className = '', title }: Props) {
  const label = title ?? nombre;
  return (
    <span
      className={[SIZE_CLASS[size], className].filter(Boolean).join(' ')}
      title={label}
      aria-hidden
    >
      {inicialesNombre(nombre)}
    </span>
  );
}
