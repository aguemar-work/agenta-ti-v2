/**
 * src/api/__tests__/planificacion.api.test.ts
 *
 * Tests de integración de api/planificacion.ts — vista del jefe (carga del equipo).
 * fechaLunesDesdeSemanaIso es la pieza más riesgosa: un algoritmo de búsqueda que
 * podría no converger o converger al día equivocado; se verifica contra
 * semanaIsoDesdeFecha (round-trip) para varias semanas del año, incluyendo bordes.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { semanaIsoDesdeFecha } from '@/lib/semanas';

const { tableResponses } = vi.hoisted(() => ({
  tableResponses: {} as Record<string, { data: unknown; error: unknown }>,
}));

function builder(table: string) {
  const response = () => tableResponses[table] ?? { data: [], error: null };
  const b = {
    select: vi.fn(() => b),
    eq:     vi.fn(() => b),
    in:     vi.fn(() => b),
    gte:    vi.fn(() => b),
    lte:    vi.fn(() => b),
    order:  vi.fn(() => b),
    then:   (resolve: (v: unknown) => unknown) => Promise.resolve(response()).then(resolve),
  };
  return b;
}

vi.mock('@/lib/insforge', () => ({
  getInsforge: () => ({ database: { from: (table: string) => builder(table) } }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(tableResponses)) delete tableResponses[k];
});

// ---------------------------------------------------------------------------
// fechaLunesDesdeSemanaIso — round-trip contra semanaIsoDesdeFecha
// ---------------------------------------------------------------------------

describe('fechaLunesDesdeSemanaIso', () => {
  it('el lunes devuelto, al recalcular su semana ISO, coincide con la semana pedida', async () => {
    const { fechaLunesDesdeSemanaIso } = await import('@/api/planificacion');
    const semanas = ['202601', '202618', '202652', '202053']; // incl. año con 53 semanas

    for (const sem of semanas) {
      const ymd = fechaLunesDesdeSemanaIso(sem);
      const recalculada = semanaIsoDesdeFecha(new Date(`${ymd}T12:00:00`));
      expect(recalculada).toBe(sem);
    }
  });

  it('el resultado siempre cae en lunes', async () => {
    const { fechaLunesDesdeSemanaIso } = await import('@/api/planificacion');

    const ymd = fechaLunesDesdeSemanaIso('202618');

    expect(new Date(`${ymd}T12:00:00`).getDay()).toBe(1); // 1 = lunes
  });
});

// ---------------------------------------------------------------------------
// getCargaEquipoSemana / getIncidenciasEquipoSemana — atajo sin miembros activos
// ---------------------------------------------------------------------------

describe('getCargaEquipoSemana', () => {
  it('sin miembros activos, devuelve [] sin consultar tareas', async () => {
    tableResponses.usuario = { data: [], error: null };
    const { getCargaEquipoSemana } = await import('@/api/planificacion');

    await expect(getCargaEquipoSemana('202618')).resolves.toEqual([]);
  });
});

describe('getIncidenciasEquipoSemana', () => {
  it('sin miembros activos, devuelve [] sin consultar tareas', async () => {
    tableResponses.usuario = { data: [], error: null };
    const { getIncidenciasEquipoSemana } = await import('@/api/planificacion');

    await expect(
      getIncidenciasEquipoSemana(new Date('2026-04-27'), new Date('2026-05-02')),
    ).resolves.toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getOTsPendientesIds / getMiembrosActivos
// ---------------------------------------------------------------------------

describe('getOTsPendientesIds', () => {
  it('propaga el error de la BD', async () => {
    const dbError = new Error('permission denied');
    tableResponses.orden_trabajo = { data: null, error: dbError };
    const { getOTsPendientesIds } = await import('@/api/planificacion');

    await expect(getOTsPendientesIds()).rejects.toBe(dbError);
  });
});
