/**
 * src/api/__tests__/objetivosMetricas.api.test.ts
 *
 * Tests de integración de api/objetivosMetricas.ts — agregación de KPIs.
 * Es el módulo con más lógica de cómputo del proyecto (buckets por estado
 * efectivo, agrupación semanal, comparativa por miembro) y el de mayor riesgo
 * de bug silencioso: un error de categorización no lanza excepción, solo
 * produce un número equivocado en un dashboard.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

const HOY = '2026-04-29';

const { tableResponses } = vi.hoisted(() => ({
  tableResponses: {} as Record<string, { data: unknown; error: unknown; count?: number }>,
}));

function builder(table: string) {
  const response = () => tableResponses[table] ?? { data: [], error: null };
  const b = {
    select: vi.fn(() => b),
    eq:     vi.fn(() => b),
    neq:    vi.fn(() => b),
    gte:    vi.fn(() => b),
    lte:    vi.fn(() => b),
    order:  vi.fn(() => b),
    then:   (resolve: (v: unknown) => unknown) => Promise.resolve(response()).then(resolve),
  };
  return b;
}

const mockRpc = vi.fn();

vi.mock('@/lib/insforge', () => ({
  getInsforge: () => ({ database: { rpc: mockRpc, from: (table: string) => builder(table) } }),
}));

// Fija "hoy" para que estadoEfectivoTablero calcule "atrasada" de forma determinista.
vi.mock('@/lib/fecha', () => ({ fechaLocalYmd: () => HOY }));

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(tableResponses)) delete tableResponses[k];
});

function tarea(overrides: Record<string, unknown> = {}) {
  return {
    estado: 'pendiente', tipo: 'planificada', fecha_planificada: HOY,
    situacion: null, reprogramaciones: 0, es_imprevisto: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getObjetivosConProgreso
// ---------------------------------------------------------------------------

describe('getObjetivosConProgreso', () => {
  it('coacciona total_tareas/completadas/pct a número (la RPC puede devolverlos como string)', async () => {
    mockRpc.mockResolvedValue({
      data: [{ id: '1', titulo: 'Meta', total_tareas: '10', completadas: '4', pct: '40' }],
      error: null,
    });
    const { getObjetivosConProgreso } = await import('@/api/objetivosMetricas');

    const result = await getObjetivosConProgreso();

    expect(result[0]).toEqual(expect.objectContaining({ total_tareas: 10, completadas: 4, pct: 40 }));
  });
});

// ---------------------------------------------------------------------------
// getKpisUsuario
// ---------------------------------------------------------------------------

describe('getKpisUsuario', () => {
  it('clasifica activas (no completada/cancelada), atrasadas, y completadas en los últimos 7 días', async () => {
    // getKpisUsuario calcula el corte de 7 días con `new Date()` real (no mockeable aquí),
    // así que las fechas de fixture se generan relativas al momento real de ejecución.
    const ayer = new Date(Date.now() - 1 * 86400000).toISOString();
    const haceMucho = '2020-01-01T00:00:00.000Z';
    tableResponses.tarea_activa = {
      data: [
        tarea({ estado: 'pendiente' }),                                  // activa
        tarea({ estado: 'en_progreso' }),                                // activa
        tarea({ situacion: 'atrasada' }),                                // activa + atrasada
        tarea({ estado: 'cancelada' }),                                  // ni activa ni atrasada
        tarea({ estado: 'completada', fecha_completada: ayer }),         // completada7d (hace 1 día)
        tarea({ estado: 'completada', fecha_completada: haceMucho }),    // completada pero NO en 7d
      ],
      error: null,
    };
    tableResponses.objetivo = { data: null, error: null, count: 3 };
    const { getKpisUsuario } = await import('@/api/objetivosMetricas');

    const result = await getKpisUsuario('uuid-miembro');

    expect(result.activas).toBe(3); // pendiente + en_progreso + atrasada (completada/cancelada no cuentan)
    expect(result.atrasadas).toBe(1);
    expect(result.completadas7d).toBe(1);
    expect(result.objetivosActivos).toBe(3);
  });

  it('sin objetivos activos (count null), devuelve 0 en vez de null', async () => {
    tableResponses.tarea_activa = { data: [], error: null };
    tableResponses.objetivo = { data: null, error: null, count: undefined };
    const { getKpisUsuario } = await import('@/api/objetivosMetricas');

    await expect(getKpisUsuario('uuid-miembro')).resolves.toEqual(expect.objectContaining({ objetivosActivos: 0 }));
  });
});

// ---------------------------------------------------------------------------
// getKpisRangoYSemana
// ---------------------------------------------------------------------------

describe('getKpisRangoYSemana', () => {
  it('separa incidencias del total y agrupa por semana_planificada, ordenado por semanaISO', async () => {
    tableResponses.tarea_activa = {
      data: [
        tarea({ semana_planificada: '202618', estado: 'completada' }),
        tarea({ semana_planificada: '202618', estado: 'pendiente' }),
        tarea({ semana_planificada: '202617', situacion: 'atrasada' }),
        tarea({ es_imprevisto: true, semana_planificada: '202618' }), // incidencia — no cuenta en total
      ],
      error: null,
    };
    const { getKpisRangoYSemana } = await import('@/api/objetivosMetricas');

    const result = await getKpisRangoYSemana('2026-04-01', '2026-04-30');

    expect(result.kpis.total).toBe(3);          // 4 filas menos 1 incidencia
    expect(result.kpis.incidencias).toBe(1);
    expect(result.kpis.completadas).toBe(1);
    expect(result.kpis.pendientes).toBe(1);
    expect(result.kpis.atrasadas).toBe(1);

    expect(result.porSemana.map((s) => s.semanaISO)).toEqual(['202617', '202618']); // ordenado ascendente
    const sem18 = result.porSemana.find((s) => s.semanaISO === '202618')!;
    expect(sem18.total).toBe(2); // la incidencia no suma al total semanal
    expect(sem18.semana).toBe('Sem 18');
  });

  it('tareas sin semana_planificada cuentan en el total pero no aparecen en ningún grupo semanal', async () => {
    tableResponses.tarea_activa = { data: [tarea({ semana_planificada: null })], error: null };
    const { getKpisRangoYSemana } = await import('@/api/objetivosMetricas');

    const result = await getKpisRangoYSemana('2026-04-01', '2026-04-30');

    expect(result.kpis.total).toBe(1);
    expect(result.porSemana).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getKpisComparativa
// ---------------------------------------------------------------------------

describe('getKpisComparativa', () => {
  it('inicializa cada miembro activo en cero y acumula solo sus propias tareas', async () => {
    tableResponses.usuario = {
      data: [{ id: 'u1', nombre: 'Ana' }, { id: 'u2', nombre: 'Kevin' }],
      error: null,
    };
    tableResponses.tarea_activa = {
      data: [
        tarea({ asignado_a: 'u1', estado: 'completada' }),
        tarea({ asignado_a: 'u1', situacion: 'atrasada' }),
        tarea({ asignado_a: 'u2', reprogramaciones: 1 }),
      ],
      error: null,
    };
    const { getKpisComparativa } = await import('@/api/objetivosMetricas');

    const result = await getKpisComparativa('2026-04-01', '2026-04-30');

    expect(result).toEqual([
      { usuarioId: 'u1', nombre: 'Ana', completadas: 1, atrasadas: 1, reprogramadas: 0 },
      { usuarioId: 'u2', nombre: 'Kevin', completadas: 0, atrasadas: 0, reprogramadas: 1 },
    ]);
  });

  it('descarta silenciosamente tareas de un usuario que ya no está activo (defensa contra datos huérfanos)', async () => {
    tableResponses.usuario = { data: [{ id: 'u1', nombre: 'Ana' }], error: null };
    tableResponses.tarea_activa = {
      data: [tarea({ asignado_a: 'usuario-inactivo-o-borrado', estado: 'completada' })],
      error: null,
    };
    const { getKpisComparativa } = await import('@/api/objetivosMetricas');

    const result = await getKpisComparativa('2026-04-01', '2026-04-30');

    expect(result).toEqual([{ usuarioId: 'u1', nombre: 'Ana', completadas: 0, atrasadas: 0, reprogramadas: 0 }]);
  });
});
