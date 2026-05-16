import { describe, expect, it } from 'vitest';

import {
  ordenTrabajoCompletadaTieneReceptor,
  puedeCompletarOTReceptor,
} from '@/lib/otComplecion';

describe('puedeCompletarOTReceptor', () => {
  it('exige nombre y DNI con contenido', () => {
    expect(puedeCompletarOTReceptor('Ana Pérez', '12345678')).toBe(true);
    expect(puedeCompletarOTReceptor('', '12345678')).toBe(false);
    expect(puedeCompletarOTReceptor('Ana', '')).toBe(false);
    expect(puedeCompletarOTReceptor('  ', '12345678')).toBe(false);
  });
});

describe('ordenTrabajoCompletadaTieneReceptor', () => {
  it('no aplica fuera de completada', () => {
    expect(
      ordenTrabajoCompletadaTieneReceptor({
        estado: 'en_ejecucion',
        receptor_nombre: null,
        receptor_dni: null,
      }),
    ).toBe(true);
  });

  it('exige nombre y DNI en completada', () => {
    expect(
      ordenTrabajoCompletadaTieneReceptor({
        estado: 'completada',
        receptor_nombre: 'Ana',
        receptor_dni: '12345678',
      }),
    ).toBe(true);
    expect(
      ordenTrabajoCompletadaTieneReceptor({
        estado: 'completada',
        receptor_nombre: 'Ana',
        receptor_dni: null,
      }),
    ).toBe(false);
  });
});
