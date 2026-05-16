import { describe, expect, it } from 'vitest';

import { agruparTareasTablero } from '@/api/tablero';
import type { Tarea } from '@/types';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
let _id = 0;
function tarea(overrides: Partial<Tarea>): Tarea {
  _id++;
  return {
    id:                 `uuid-${_id}`,
    titulo:             `Tarea ${_id}`,
    descripcion:        null,
    estado:             'pendiente',
    tipo:               'planificada',
    prioridad:          'media',
    fecha_planificada:  null,
    semana_planificada: null,
    fecha_completada:   null,
    asignado_a:         'uuid-usuario',
    objetivo_id:        null,
    creado_por:         'uuid-usuario',
    es_imprevisto:      false,
    nota_origen_id:     null,
    created_at:         '2026-01-01T00:00:00Z',
    updated_at:         '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const HOY  = '2026-04-29';
const AYER = '2026-04-28';

// ---------------------------------------------------------------------------

describe('agruparTareasTablero', () => {

  it('devuelve las 4 columnas siempre, aunque estén vacías', () => {
    const result = agruparTareasTablero([], HOY);
    expect(result).toHaveProperty('pendiente');
    expect(result).toHaveProperty('en_progreso');
    expect(result).toHaveProperty('bloqueada');
    expect(result).toHaveProperty('completada');
    expect(result.pendiente).toHaveLength(0);
    expect(result.en_progreso).toHaveLength(0);
    expect(result.bloqueada).toHaveLength(0);
    expect(result.completada).toHaveLength(0);
  });

  // ── Distribución por estado directo ───────────────────────────────────────

  it('tarea pendiente (sin vencer) → columna pendiente', () => {
    const t = tarea({ estado: 'pendiente', fecha_planificada: '2026-04-30' });
    const result = agruparTareasTablero([t], HOY);
    expect(result.pendiente).toContain(t);
    expect(result.en_progreso).toHaveLength(0);
  });

  it('tarea en_progreso → columna en_progreso', () => {
    const t = tarea({ estado: 'en_progreso' });
    const result = agruparTareasTablero([t], HOY);
    expect(result.en_progreso).toContain(t);
  });

  it('tarea bloqueada → columna bloqueada', () => {
    const t = tarea({ estado: 'bloqueada' });
    const result = agruparTareasTablero([t], HOY);
    expect(result.bloqueada).toContain(t);
  });

  it('tarea completada → columna completada', () => {
    const t = tarea({ estado: 'completada' });
    const result = agruparTareasTablero([t], HOY);
    expect(result.completada).toContain(t);
  });

  // ── Tarea atrasada (estado efectivo) → columna pendiente ─────────────────
  // Una tarea pendiente+vencida tiene estadoEfectivo='atrasada', que no es
  // ninguna de las 3 columnas especiales → cae en pendiente (el else del switch).

  it('tarea pendiente vencida → columna pendiente (como atrasada)', () => {
    const t = tarea({ estado: 'pendiente', tipo: 'planificada', fecha_planificada: AYER });
    const result = agruparTareasTablero([t], HOY);
    // estadoEfectivo = 'atrasada' → cae en else → pendiente
    expect(result.pendiente).toContain(t);
    expect(result.en_progreso).toHaveLength(0);
    expect(result.bloqueada).toHaveLength(0);
    expect(result.completada).toHaveLength(0);
  });

  it('tarea reprogramada sin vencer → columna pendiente (else del agrupar)', () => {
    const t = tarea({ estado: 'reprogramada', fecha_planificada: '2026-05-01' });
    const result = agruparTareasTablero([t], HOY);
    expect(result.pendiente).toContain(t);
  });

  it('tarea reprogramada vencida → columna pendiente (efectivo atrasada)', () => {
    const t = tarea({ estado: 'reprogramada', tipo: 'planificada', fecha_planificada: AYER });
    const result = agruparTareasTablero([t], HOY);
    expect(result.pendiente).toContain(t);
  });

  it('tarea cancelada → columna pendiente (else)', () => {
    // Las tareas canceladas se filtran antes en getTareasTablero,
    // pero si llegan aquí van a pendiente por el else.
    const t = tarea({ estado: 'cancelada' });
    const result = agruparTareasTablero([t], HOY);
    expect(result.pendiente).toContain(t);
  });

  // ── Múltiples tareas ──────────────────────────────────────────────────────

  it('distribuye correctamente múltiples tareas en sus columnas', () => {
    const t1 = tarea({ estado: 'pendiente',   fecha_planificada: '2026-04-30' });
    const t2 = tarea({ estado: 'en_progreso' });
    const t3 = tarea({ estado: 'bloqueada' });
    const t4 = tarea({ estado: 'completada' });
    const t5 = tarea({ estado: 'pendiente', tipo: 'planificada', fecha_planificada: AYER }); // atrasada

    const result = agruparTareasTablero([t1, t2, t3, t4, t5], HOY);

    expect(result.pendiente).toHaveLength(2);   // t1 + t5 (atrasada)
    expect(result.en_progreso).toHaveLength(1); // t2
    expect(result.bloqueada).toHaveLength(1);   // t3
    expect(result.completada).toHaveLength(1);  // t4
  });

  it('la suma de todas las columnas equals el total de tareas', () => {
    const tareas = [
      tarea({ estado: 'pendiente' }),
      tarea({ estado: 'en_progreso' }),
      tarea({ estado: 'bloqueada' }),
      tarea({ estado: 'completada' }),
      tarea({ estado: 'reprogramada' }),
    ];
    const result = agruparTareasTablero(tareas, HOY);
    const total = result.pendiente.length + result.en_progreso.length +
                  result.bloqueada.length + result.completada.length;
    expect(total).toBe(tareas.length);
  });

  // ── En_progreso/bloqueada NO caen en pendiente aunque tengan fecha vencida ─
  // Este fue el bug del trigger: sobreescribía estados activos.
  // agruparTareasTablero delega en estadoEfectivoTablero que ya lo respeta,
  // pero lo verificamos explícitamente aquí también.

  it('tarea en_progreso con fecha vencida → en_progreso, NO pendiente', () => {
    const t = tarea({ estado: 'en_progreso', tipo: 'planificada', fecha_planificada: AYER });
    const result = agruparTareasTablero([t], HOY);
    expect(result.en_progreso).toContain(t);
    expect(result.pendiente).toHaveLength(0);
  });

  it('tarea bloqueada con fecha vencida → bloqueada, NO pendiente', () => {
    const t = tarea({ estado: 'bloqueada', tipo: 'planificada', fecha_planificada: AYER });
    const result = agruparTareasTablero([t], HOY);
    expect(result.bloqueada).toContain(t);
    expect(result.pendiente).toHaveLength(0);
  });
});
