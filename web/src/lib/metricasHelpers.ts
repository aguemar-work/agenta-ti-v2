/** Iniciales para avatar (máx. 2 letras). */
export function inicialesNombre(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function pct(val: number, total: number): number {
  return total > 0 ? Math.round((val / total) * 100) : 0;
}

export function colorCumplimiento(p: number): string {
  if (p >= 70) return 'var(--mc-state-completada-fg)';
  if (p >= 40) return 'var(--mc-state-precaucion-border)';
  return 'var(--mc-state-atrasada-meta)';
}

export function bgCumplimiento(p: number): string {
  if (p >= 70) return 'var(--mc-state-completada-bg-soft)';
  if (p >= 40) return 'var(--mc-state-precaucion-bg-soft)';
  return 'var(--mc-state-atrasada-bg-soft)';
}

/** Gradiente cónico para donut CSS. `segments` en % que suman 100. */
export function conicGradientDonut(segments: { pct: number; color: string }[]): string {
  if (segments.length === 0) return 'var(--mc-color-border)';
  let acc = 0;
  const stops: string[] = [];
  for (const s of segments) {
    if (s.pct <= 0) continue;
    const end = acc + s.pct;
    stops.push(`${s.color} ${acc}% ${end}%`);
    acc = end;
  }
  if (stops.length === 0) return 'var(--mc-color-border)';
  return `conic-gradient(${stops.join(', ')})`;
}
