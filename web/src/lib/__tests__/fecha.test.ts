import { describe, expect, it } from 'vitest';

import { fechaLocalDdMmYyyy, fechaLocalYmd } from '@/lib/fecha';

// ---------------------------------------------------------------------------
// fechaLocalYmd
// Crítico: este formato se usa para comparar fechas (tarea.fecha_planificada < hoyYmd).
// Un bug aquí rompe toda la lógica de "atrasada".
// ---------------------------------------------------------------------------
describe('fechaLocalYmd', () => {

  it('formatea correctamente una fecha simple', () => {
    expect(fechaLocalYmd(new Date(2026, 3, 29))).toBe('2026-04-29');
  });

  it('agrega cero en mes de un dígito', () => {
    expect(fechaLocalYmd(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('agrega cero en día de un dígito', () => {
    expect(fechaLocalYmd(new Date(2026, 11, 3))).toBe('2026-12-03');
  });

  it('maneja año bisiesto (29 feb)', () => {
    expect(fechaLocalYmd(new Date(2028, 1, 29))).toBe('2028-02-29');
  });

  it('maneja primer día del año', () => {
    expect(fechaLocalYmd(new Date(2026, 0, 1))).toBe('2026-01-01');
  });

  it('maneja último día del año', () => {
    expect(fechaLocalYmd(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('devuelve siempre formato YYYY-MM-DD (10 chars)', () => {
    const result = fechaLocalYmd(new Date(2026, 3, 29));
    expect(result).toHaveLength(10);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('usa la fecha LOCAL (no UTC) — insensible a la hora del día', () => {
    // Crear fecha local a medianoche — debe dar el día correcto sin drift UTC
    const medianoche = new Date(2026, 3, 29, 0, 0, 0);
    expect(fechaLocalYmd(medianoche)).toBe('2026-04-29');
  });

  it('a las 23:59 del día sigue siendo ese día', () => {
    const casiFin = new Date(2026, 3, 29, 23, 59, 59);
    expect(fechaLocalYmd(casiFin)).toBe('2026-04-29');
  });

  // Propiedad de ordenamiento: las fechas ISO se ordenan lexicográficamente igual
  // que cronológicamente. Crítico para la comparación t.fecha_planificada < hoyYmd.
  it('el orden lexicográfico de los strings coincide con el orden cronológico', () => {
    const ayer   = fechaLocalYmd(new Date(2026, 3, 28));
    const hoy    = fechaLocalYmd(new Date(2026, 3, 29));
    const manana = fechaLocalYmd(new Date(2026, 3, 30));

    expect(ayer < hoy).toBe(true);
    expect(hoy < manana).toBe(true);
    expect(ayer < manana).toBe(true);
    expect(hoy < hoy).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// fechaLocalDdMmYyyy
// Formato de presentación en UI. No se usa para lógica de negocio.
// ---------------------------------------------------------------------------
describe('fechaLocalDdMmYyyy', () => {

  it('formatea correctamente una fecha simple', () => {
    expect(fechaLocalDdMmYyyy(new Date(2026, 3, 29))).toBe('29/04/2026');
  });

  it('agrega cero en día y mes de un dígito', () => {
    expect(fechaLocalDdMmYyyy(new Date(2026, 0, 5))).toBe('05/01/2026');
  });

  it('devuelve formato dd/MM/yyyy (10 chars)', () => {
    const result = fechaLocalDdMmYyyy(new Date(2026, 3, 29));
    expect(result).toHaveLength(10);
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it('primer día del año', () => {
    expect(fechaLocalDdMmYyyy(new Date(2026, 0, 1))).toBe('01/01/2026');
  });

  it('último día del año', () => {
    expect(fechaLocalDdMmYyyy(new Date(2026, 11, 31))).toBe('31/12/2026');
  });
});
