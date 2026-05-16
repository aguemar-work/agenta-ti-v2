import { describe, expect, it, vi } from 'vitest';

import { invalidateRelatedQueries } from '@/lib/queryHelpers';
import type { QueryClient } from '@tanstack/react-query';

function makeQc() {
  return {
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
  } as unknown as QueryClient;
}

describe('invalidateRelatedQueries', () => {

  it('invalida cada grupo exactamente una vez', async () => {
    const qc = makeQc();
    await invalidateRelatedQueries(qc, ['semana', 'tablero']);
    expect(qc.invalidateQueries).toHaveBeenCalledTimes(2);
  });

  it('llama con el queryKey correcto para "semana"', async () => {
    const qc = makeQc();
    await invalidateRelatedQueries(qc, ['semana']);
    expect(qc.invalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['semana'] }),
    );
  });

  it('llama con el queryKey correcto para "tablero"', async () => {
    const qc = makeQc();
    await invalidateRelatedQueries(qc, ['tablero']);
    expect(qc.invalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['tablero'] }),
    );
  });

  it('llama con el queryKey correcto para "tareas-hoy"', async () => {
    const qc = makeQc();
    await invalidateRelatedQueries(qc, ['tareas-hoy']);
    expect(qc.invalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['tareas-hoy'] }),
    );
  });

  it('invalida múltiples grupos en paralelo sin error', async () => {
    const qc = makeQc();
    await expect(
      invalidateRelatedQueries(qc, ['semana', 'tablero', 'tareas-hoy', 'planificacion', 'objetivos']),
    ).resolves.toBeUndefined();
    expect(qc.invalidateQueries).toHaveBeenCalledTimes(5);
  });

  it('no llama invalidateQueries si el array está vacío', async () => {
    const qc = makeQc();
    await invalidateRelatedQueries(qc, []);
    expect(qc.invalidateQueries).not.toHaveBeenCalled();
  });

  it('invalida órdenes de trabajo con queryKey ordenes-trabajo', async () => {
    const qc = makeQc();
    await invalidateRelatedQueries(qc, ['ot']);
    expect(qc.invalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['ordenes-trabajo'], exact: false }),
    );
  });
});