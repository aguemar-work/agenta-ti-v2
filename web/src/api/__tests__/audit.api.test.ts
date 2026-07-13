/**
 * src/api/__tests__/audit.api.test.ts
 *
 * Tests de integración de api/audit.ts — revisión de justificaciones y logs.
 * getJustificacionesPendientesJefe tiene un filtro defensivo del lado del
 * cliente (justificacion.trim().length >= 10) que duplica una regla de
 * negocio ya aplicada en el servidor — vale la pena verificar que no deje
 * pasar justificaciones cortas o vacías si el servidor alguna vez las devuelve.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

const { tableResponses, rangeCalls } = vi.hoisted(() => ({
  tableResponses: {} as Record<string, { data: unknown; error: unknown; count?: number }>,
  rangeCalls: [] as unknown[][],
}));

const mockRpc = vi.fn();

function builder(table: string) {
  const response = () => tableResponses[table] ?? { data: [], error: null };
  const b = {
    select: vi.fn(() => b),
    eq:     vi.fn(() => b),
    in:     vi.fn(() => b),
    not:    vi.fn(() => b),
    gte:    vi.fn(() => b),
    lte:    vi.fn(() => b),
    order:  vi.fn(() => b),
    limit:  vi.fn(() => b),
    range:  vi.fn((...args: unknown[]) => { rangeCalls.push(args); return Promise.resolve(response()); }),
    then:   (resolve: (v: unknown) => unknown) => Promise.resolve(response()).then(resolve),
  };
  return b;
}

vi.mock('@/lib/insforge', () => ({
  getInsforge: () => ({ database: { rpc: mockRpc, from: (table: string) => builder(table) } }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(tableResponses)) delete tableResponses[k];
  rangeCalls.length = 0;
});

// ---------------------------------------------------------------------------
// getJustificacionesPendientesJefe — filtro defensivo de longitud
// ---------------------------------------------------------------------------

describe('getJustificacionesPendientesJefe', () => {
  it('descarta justificaciones cortas o vacías aunque el servidor las devuelva', async () => {
    tableResponses.log_accion = {
      data: [
        { id: '1', justificacion: 'Justificación válida y larga' },
        { id: '2', justificacion: 'corta' },
        { id: '3', justificacion: '   ' },
        { id: '4', justificacion: null },
      ],
      error: null,
    };
    const { getJustificacionesPendientesJefe } = await import('@/api/audit');

    const result = await getJustificacionesPendientesJefe();

    expect(result.map((l) => l.id)).toEqual(['1']);
  });
});

// ---------------------------------------------------------------------------
// getHistorialLogs — paginación
// ---------------------------------------------------------------------------

describe('getHistorialLogs', () => {
  it('calcula el rango desde/hasta según página y tamaño de página', async () => {
    tableResponses.log_accion = { data: [], error: null, count: 0 };
    const { getHistorialLogs } = await import('@/api/audit');

    await getHistorialLogs({ usuarioId: 'todos', tipoAccion: 'todos', pagina: 2, porPagina: 20 });

    expect(rangeCalls).toContainEqual([40, 59]); // página 2 (0-indexed) * 20 .. +19
  });

  it('sin resultados, total es 0 (no null/undefined)', async () => {
    tableResponses.log_accion = { data: [], error: null, count: undefined };
    const { getHistorialLogs } = await import('@/api/audit');

    const result = await getHistorialLogs({ usuarioId: 'todos', tipoAccion: 'todos', pagina: 0, porPagina: 10 });

    expect(result).toEqual({ logs: [], total: 0 });
  });
});

// ---------------------------------------------------------------------------
// getActividadEquipoSemana — mapeo de relaciones embebidas con fallback
// ---------------------------------------------------------------------------

describe('getActividadEquipoSemana', () => {
  it('usa "—" como nombre cuando el usuario embebido viene null', async () => {
    tableResponses.log_accion = {
      data: [{
        id: '1', tarea_id: 't1', tarea: { titulo: 'Tarea X' },
        usuario_id: 'u1', usuario: null,
        tipo_accion: 'completada', justificacion: null, created_at: '2026-04-29T00:00:00Z',
      }],
      error: null,
    };
    const { getActividadEquipoSemana } = await import('@/api/audit');

    const result = await getActividadEquipoSemana(new Date('2026-04-27'), new Date('2026-05-02'));

    expect(result[0]).toEqual(expect.objectContaining({ usuario_nombre: '—', tarea_titulo: 'Tarea X' }));
  });

  it('tarea_id null (log no asociado a tarea) usa tarea_titulo null, no lanza', async () => {
    tableResponses.log_accion = {
      data: [{
        id: '1', tarea_id: null, tarea: null,
        usuario_id: 'u1', usuario: { nombre: 'Ana' },
        tipo_accion: 'cancelada', justificacion: 'motivo', created_at: '2026-04-29T00:00:00Z',
      }],
      error: null,
    };
    const { getActividadEquipoSemana } = await import('@/api/audit');

    const result = await getActividadEquipoSemana(new Date('2026-04-27'), new Date('2026-05-02'));

    expect(result[0]).toEqual(expect.objectContaining({ tarea_titulo: null, usuario_nombre: 'Ana' }));
  });
});
