import { describe, expect, it } from 'vitest';

import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import type { TareaParaEstadoEfectivo } from '@/lib/tableroEstado';

function tareaMetricas(overrides: Partial<TareaParaEstadoEfectivo>): TareaParaEstadoEfectivo {
  return {
    estado: 'pendiente',
    tipo: 'planificada',
    fecha_planificada: '2026-04-28',
    ...overrides,
  };
}

describe('objetivosMetricas — clasificación por estado efectivo', () => {
  const hoy = '2026-04-29';

  it('pendiente vencida se clasifica como atrasada (no pendiente)', () => {
    const t = tareaMetricas({ estado: 'pendiente' });
    expect(estadoEfectivoTablero(t, hoy)).toBe('atrasada');
  });

  it('reprogramada vencida con situacion atrasada gana sobre reprogramada', () => {
    const t = tareaMetricas({ situacion: 'atrasada', reprogramaciones: 2 });
    expect(estadoEfectivoTablero(t, hoy)).toBe('atrasada');
  });

  it('reprogramaciones sin vencimiento muestra reprogramada', () => {
    const t = tareaMetricas({ situacion: 'reprogramada', fecha_planificada: hoy, reprogramaciones: 1 });
    expect(estadoEfectivoTablero(t, hoy)).toBe('reprogramada');
  });

  it('pendiente al día sigue siendo pendiente', () => {
    const t = tareaMetricas({ estado: 'pendiente', fecha_planificada: hoy });
    expect(estadoEfectivoTablero(t, hoy)).toBe('pendiente');
  });
});
