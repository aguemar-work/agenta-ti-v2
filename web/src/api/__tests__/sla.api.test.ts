/**
 * src/api/__tests__/sla.api.test.ts
 * Tests de integración de api/sla.ts — resumen SLA del jefe.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();

vi.mock('@/lib/insforge', () => ({
  getInsforge: () => ({ database: { rpc: mockRpc } }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getResumenSlaJefe', () => {
  it('con respuesta válida, la devuelve tal cual', async () => {
    mockRpc.mockResolvedValue({
      data: { atrasadas_activas: 3, atrasadas_nuevas_24h: 1, bloqueadas_criticas: 0, fecha: '2026-04-29' },
      error: null,
    });
    const { getResumenSlaJefe } = await import('@/api/sla');

    await expect(getResumenSlaJefe()).resolves.toEqual({
      atrasadas_activas: 3, atrasadas_nuevas_24h: 1, bloqueadas_criticas: 0, fecha: '2026-04-29',
    });
  });

  it('con respuesta corrupta (forma inesperada), cae al fallback en ceros en vez de lanzar', async () => {
    mockRpc.mockResolvedValue({ data: { algo: 'distinto' }, error: null });
    const { getResumenSlaJefe } = await import('@/api/sla');

    await expect(getResumenSlaJefe()).resolves.toEqual({
      atrasadas_activas: 0, atrasadas_nuevas_24h: 0, bloqueadas_criticas: 0, fecha: '',
    });
  });

  it('propaga el error del RPC (no cae al fallback en ese caso)', async () => {
    const dbError = new Error('permission denied');
    mockRpc.mockResolvedValue({ data: null, error: dbError });
    const { getResumenSlaJefe } = await import('@/api/sla');

    await expect(getResumenSlaJefe()).rejects.toBe(dbError);
  });
});

describe('contarAlertasSla', () => {
  it('devuelve las atrasadas nuevas en 24h como cantidad de alertas', async () => {
    const { contarAlertasSla } = await import('@/api/sla');

    expect(contarAlertasSla({
      atrasadas_activas: 10, atrasadas_nuevas_24h: 4, bloqueadas_criticas: 0, fecha: '2026-04-29',
    })).toBe(4);
  });
});
