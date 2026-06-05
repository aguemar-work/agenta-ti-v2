import { describe, expect, it } from 'vitest';

import { agruparTareasTablero } from '@/api/tablero';
import type { Tarea } from '@/types';

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

describe('agruparTareasTablero', () => {
  it('devuelve 3 columnas siempre, aunque estén vacías', () => {
    const result = agruparTareasTablero([], HOY);
    expect(result).toHaveProperty('pendiente');
    expect(result).toHaveProperty('en_progreso');
    expect(result).toHaveProperty('completada');
    expect(result.pendiente).toHaveLength(0);
    expect(result.en_progreso).toHaveLength(0);
    expect(result.completada).toHaveLength(0);
  });

  it('tarea pendiente (sin vencer) → columna pendiente', () => {
    const t = tarea({ estado: 'pendiente', fecha_planificada: '2026-04-30' });
    const result = agruparTareasTablero([t], HOY);
    expect(result.pendiente).toContain(t);
  });

  it('tarea en_progreso → columna en_progreso', () => {
    const t = tarea({ estado: 'en_progreso' });
    const result = agruparTareasTablero([t], HOY);
    expect(result.en_progreso).toContain(t);
  });

  it('tarea completada → columna completada', () => {
    const t = tarea({ estado: 'completada' });
    const result = agruparTareasTablero([t], HOY);
    expect(result.completada).toContain(t);
  });

  it('tarea pendiente vencida (visual atrasada) → columna pendiente', () => {
    const t = tarea({ estado: 'pendiente', situacion: 'atrasada', fecha_planificada: AYER });
    const result = agruparTareasTablero([t], HOY);
    expect(result.pendiente).toContain(t);
  });

  it('tarea reprogramada → columna pendiente', () => {
    const t = tarea({ estado: 'pendiente', situacion: 'reprogramada', fecha_planificada: '2026-05-01' });
    const result = agruparTareasTablero([t], HOY);
    expect(result.pendiente).toContain(t);
  });

  it('en_progreso vencida sigue en en_progreso', () => {
    const t = tarea({ estado: 'en_progreso', situacion: 'creada', fecha_planificada: AYER });
    const result = agruparTareasTablero([t], HOY);
    expect(result.en_progreso).toContain(t);
    expect(result.pendiente).toHaveLength(0);
  });
});
