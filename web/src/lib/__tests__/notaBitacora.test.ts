import { describe, expect, it } from 'vitest';

import {
  descripcionDesdeNota,
  etiquetaConvertidaEn,
  tituloDesdeNota,
} from '@/lib/notaBitacora';

describe('notaBitacora', () => {
  it('tituloDesdeNota usa la primera línea', () => {
    expect(tituloDesdeNota('Revisar switch\nDetalle extra')).toBe('Revisar switch');
  });

  it('descripcionDesdeNota toma líneas siguientes', () => {
    expect(descripcionDesdeNota('Título\nLínea 2\nLínea 3')).toBe('Línea 2\nLínea 3');
  });

  it('etiquetaConvertidaEn distingue tarea y evento', () => {
    expect(etiquetaConvertidaEn('tarea')).toBe('Convertida en tarea');
    expect(etiquetaConvertidaEn('evento')).toBe('Convertida en evento');
  });
});
