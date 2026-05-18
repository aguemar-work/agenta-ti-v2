import type { EstadoTarea } from '@/types';

/** Estados mostrados en la fila resumen del equipo (texto gris, abreviado). */
const RESUMEN_DIA: { estado: EstadoTarea; abrev: string }[] = [
  { estado: 'pendiente', abrev: 'pend' },
  { estado: 'en_progreso', abrev: 'en prog' },
  { estado: 'bloqueada', abrev: 'bloq' },
  { estado: 'atrasada', abrev: 'atr' },
  { estado: 'reprogramada', abrev: 'repr' },
  { estado: 'completada', abrev: 'compl' },
];

/** Formato: `8 pend · 3 en prog · 1 bloq` */
export function textoResumenDia(counts: Partial<Record<EstadoTarea, number>>): string {
  const partes = RESUMEN_DIA.filter(({ estado }) => (counts[estado] ?? 0) > 0).map(
    ({ estado, abrev }) => `${counts[estado]} ${abrev}`,
  );
  return partes.length > 0 ? partes.join(' · ') : '—';
}
