/**
 * lib/__tests__/tareaUrgencia.test.ts
 * Tests para las utilidades de alerta temporal.
 */

import { describe, expect, it } from 'vitest';
import {
  calcularPorcentajeObjetivo,
  nivelRiesgoObjetivo,
  urgenciaHoraria,
} from '@/lib/tareaUrgencia';

// ---------------------------------------------------------------------------
// urgenciaHoraria
// ---------------------------------------------------------------------------
describe('urgenciaHoraria', () => {
  it('devuelve normal antes de las 4pm', () => {
    expect(urgenciaHoraria('pendiente', 10)).toBe('normal');
    expect(urgenciaHoraria('pendiente', 15)).toBe('normal');
  });

  it('devuelve precaucion entre 4pm y 5pm', () => {
    expect(urgenciaHoraria('pendiente', 16)).toBe('precaucion');
  });

  it('devuelve urgente entre 5pm y 6pm', () => {
    expect(urgenciaHoraria('pendiente', 17)).toBe('urgente');
    expect(urgenciaHoraria('en_progreso', 17)).toBe('urgente');
  });

  it('devuelve vencida_hoy a partir de las 6pm', () => {
    expect(urgenciaHoraria('pendiente', 18)).toBe('vencida_hoy');
    expect(urgenciaHoraria('pendiente', 22)).toBe('vencida_hoy');
  });

  it('devuelve normal para estados que ya tienen su propio indicador', () => {
    expect(urgenciaHoraria('completada', 17)).toBe('normal');
    expect(urgenciaHoraria('cancelada', 17)).toBe('normal');
  });
});

// ---------------------------------------------------------------------------
// calcularPorcentajeObjetivo
// ---------------------------------------------------------------------------
describe('calcularPorcentajeObjetivo', () => {
  it('devuelve 0 sin tareas', () => {
    expect(calcularPorcentajeObjetivo([])).toBe(0);
  });

  it('devuelve 100 si todo está completado', () => {
    const tareas = [
      { estado: 'completada', prioridad: 'alta'  as const },
      { estado: 'completada', prioridad: 'media' as const },
    ];
    expect(calcularPorcentajeObjetivo(tareas)).toBe(100);
  });

  it('devuelve 0 si nada está completado', () => {
    const tareas = [
      { estado: 'pendiente', prioridad: 'alta'  as const },
      { estado: 'pendiente', prioridad: 'baja'  as const },
    ];
    expect(calcularPorcentajeObjetivo(tareas)).toBe(0);
  });

  it('calcula ponderado correctamente (alta=3, media=2, baja=1)', () => {
    const tareas = [
      { estado: 'completada', prioridad: 'alta'  as const }, // 3 pts
      { estado: 'pendiente',  prioridad: 'media' as const }, // 2 pts
      { estado: 'pendiente',  prioridad: 'baja'  as const }, // 1 pt
    ];
    // Completadas: 3 / Total: 6 → 50%
    expect(calcularPorcentajeObjetivo(tareas)).toBe(50);
  });

  it('excluye tareas canceladas del cálculo', () => {
    const tareas = [
      { estado: 'completada', prioridad: 'alta'  as const }, // 3 pts
      { estado: 'cancelada',  prioridad: 'alta'  as const }, // excluida
    ];
    // Solo queda la completada: 3/3 = 100%
    expect(calcularPorcentajeObjetivo(tareas)).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// nivelRiesgoObjetivo
// ---------------------------------------------------------------------------
describe('nivelRiesgoObjetivo', () => {
  it('devuelve sin_fecha si no hay fecha límite', () => {
    expect(nivelRiesgoObjetivo(80, null)).toBe('sin_fecha');
    expect(nivelRiesgoObjetivo(10, null)).toBe('sin_fecha');
  });

  it('devuelve critico si avance < 30%', () => {
    expect(nivelRiesgoObjetivo(0,  '2026-12-31')).toBe('critico');
    expect(nivelRiesgoObjetivo(29, '2026-12-31')).toBe('critico');
  });

  it('devuelve moderado si avance < 50%', () => {
    expect(nivelRiesgoObjetivo(30, '2026-12-31')).toBe('moderado');
    expect(nivelRiesgoObjetivo(49, '2026-12-31')).toBe('moderado');
  });

  it('devuelve aceptable si avance < 70%', () => {
    expect(nivelRiesgoObjetivo(50, '2026-12-31')).toBe('aceptable');
    expect(nivelRiesgoObjetivo(69, '2026-12-31')).toBe('aceptable');
  });

  it('devuelve en_ritmo si avance >= 70%', () => {
    expect(nivelRiesgoObjetivo(70,  '2026-12-31')).toBe('en_ritmo');
    expect(nivelRiesgoObjetivo(100, '2026-12-31')).toBe('en_ritmo');
  });
});