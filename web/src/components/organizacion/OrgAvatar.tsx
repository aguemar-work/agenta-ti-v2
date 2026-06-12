/** Iniciales de org (primera + última palabra del nombre). */
function inicialesOrg(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return '?';
  if (parts.length === 1) return first[0]!.toUpperCase();
  const last = parts[parts.length - 1];
  return ((first[0] ?? '') + (last?.[0] ?? '')).toUpperCase() || '?';
}

/** Índice 0–5 determinístico a partir del nombre. */
function hueIndex(nombre: string): number {
  let sum = 0;
  for (let i = 0; i < nombre.length; i++) sum += nombre.charCodeAt(i);
  return sum % 6;
}

type Props = {
  nombre: string;
  size?: number;
  className?: string;
};

/**
 * Cuadrito con iniciales y color derivado del nombre (determinístico).
 * Diferente del avatar circular del usuario.
 */
export function OrgAvatar({ nombre, size = 24, className = '' }: Props) {
  const hue = hueIndex(nombre);
  const fontSize = Math.max(9, Math.round(size * 0.42));

  return (
    <span
      className={['mc-org-avatar', `mc-org-avatar--hue-${hue}`, className].filter(Boolean).join(' ')}
      style={{ width: size, height: size, fontSize }}
      aria-hidden
    >
      {inicialesOrg(nombre)}
    </span>
  );
}
