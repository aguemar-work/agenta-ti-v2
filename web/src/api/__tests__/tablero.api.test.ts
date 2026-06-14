/**
 * src/api/__tests__/tablero.api.test.ts
 *
 * Tests de la capa de API de tablero.ts — moverTareaColumna (RPC).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TEST_IDS } from '@/test/helpers';

// ---------------------------------------------------------------------------
// Mock del cliente InsForge
// ---------------------------------------------------------------------------

const mockRpc = vi.fn();

vi.mock('@/lib/insforge', () => ({
  getInsforge: () => ({
    database: { rpc: mockRpc },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockRpc.mockResolvedValue({ data: null, error: null });
});

// ---------------------------------------------------------------------------
// moverTareaColumna
// ---------------------------------------------------------------------------

describe('moverTareaColumna', () => {

  it('dado nueva columna "en_progreso" sin justificación, cuando se mueve, entonces el RPC se invoca con p_justificacion null', async () => {
    const { moverTareaColumna } = await import('@/api/tablero');

    await expect(
      moverTareaColumna(TEST_IDS.tarea1, 'en_progreso', TEST_IDS.miembro),
    ).resolves.toBeUndefined();

    expect(mockRpc).toHaveBeenCalledWith('sgtd_mover_tarea_columna', {
      p_tarea_id:      TEST_IDS.tarea1,
      p_nuevo_estado:  'en_progreso',
      p_usuario_id:    TEST_IDS.miembro,
      p_justificacion: null,
    });
  });

  it('dado cancelación con justificación, cuando se mueve, entonces el RPC recibe la justificación', async () => {
    const { moverTareaColumna } = await import('@/api/tablero');
    const justificacion = 'Ya no aplica al cierre del proyecto';

    await moverTareaColumna(TEST_IDS.tarea1, 'cancelada', TEST_IDS.miembro, justificacion);

    expect(mockRpc).toHaveBeenCalledWith('sgtd_mover_tarea_columna', expect.objectContaining({
      p_nuevo_estado:  'cancelada',
      p_justificacion: justificacion,
    }));
  });

  it('dado error del RPC, cuando se mueve, entonces relanza el error', async () => {
    const { moverTareaColumna } = await import('@/api/tablero');
    mockRpc.mockResolvedValue({ data: null, error: new Error('permission denied') });

    await expect(
      moverTareaColumna(TEST_IDS.tarea1, 'cancelada', TEST_IDS.miembro, 'justificación válida con diez'),
    ).rejects.toThrow('permission denied');
  });
});
