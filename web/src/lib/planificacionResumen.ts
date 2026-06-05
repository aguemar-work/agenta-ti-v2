import type { ClaveVisualTarea } from '@/types';

const RESUMEN_DIA: { estado: ClaveVisualTarea; abrev: string }[] = [
  { estado: 'pendiente', abrev: 'pend' },
  { estado: 'en_progreso', abrev: 'en prog' },
  { estado: 'atrasada', abrev: 'atr' },
  { estado: 'reprogramada', abrev: 'repr' },
  { estado: 'completada', abrev: 'compl' },
];

export function textoResumenDia(counts: Partial<Record<ClaveVisualTarea, number>>): string {
  const partes = RESUMEN_DIA.filter(({ estado }) => (counts[estado] ?? 0) > 0).map(
    ({ estado, abrev }) => `${counts[estado]} ${abrev}`,
  );
  return partes.length > 0 ? partes.join(' · ') : '—';
}
