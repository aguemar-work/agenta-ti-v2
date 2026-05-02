import { describe, expect, it } from 'vitest';

import {
  agregarDias,
  inicioSemanaIso,
  numeroSemanaDesdeLunes,
  semanaIsoDesdeFecha,
} from '@/lib/semanas';

// ---------------------------------------------------------------------------
// semanaIsoDesdeFecha
// ---------------------------------------------------------------------------
describe('semanaIsoDesdeFecha', () => {

  // Casos conocidos validados contra ISO 8601
  it('2026-01-01 (jueves) → semana 01 del 2026', () => {
    expect(semanaIsoDesdeFecha(new Date(2026, 0, 1))).toBe('202601');
  });

  it('2025-12-29 (lunes) → semana 01 del 2026 (año ISO adelantado)', () => {
    // ISO 8601: si el lunes de la semana cae en año nuevo, la semana pertenece al año nuevo
    expect(semanaIsoDesdeFecha(new Date(2025, 11, 29))).toBe('202601');
  });

  it('2025-12-28 (domingo) → semana 52 del 2025', () => {
    expect(semanaIsoDesdeFecha(new Date(2025, 11, 28))).toBe('202552');
  });

  it('2026-04-29 (miércoles) → semana 18 del 2026', () => {
    expect(semanaIsoDesdeFecha(new Date(2026, 3, 29))).toBe('202618');
  });

  it('2026-04-27 (lunes, inicio de semana 18) → 202618', () => {
    expect(semanaIsoDesdeFecha(new Date(2026, 3, 27))).toBe('202618');
  });

  it('2026-05-03 (domingo, fin de semana 18) → 202618', () => {
    expect(semanaIsoDesdeFecha(new Date(2026, 4, 3))).toBe('202618');
  });

  it('2026-05-04 (lunes, inicio de semana 19) → 202619', () => {
    expect(semanaIsoDesdeFecha(new Date(2026, 4, 4))).toBe('202619');
  });

  it('2026-12-31 (jueves) → semana 53 del 2026', () => {
    // 2026 tiene 53 semanas (el 31/12 cae en jueves)
    expect(semanaIsoDesdeFecha(new Date(2026, 11, 31))).toBe('202653');
  });

  it('devuelve siempre string de 6 caracteres', () => {
    const result = semanaIsoDesdeFecha(new Date(2026, 0, 5));
    expect(result).toHaveLength(6);
    expect(result).toMatch(/^\d{6}$/);
  });

  it('la semana siempre tiene 2 dígitos (padding con cero)', () => {
    // Semana 1 → '01', no '1'
    const result = semanaIsoDesdeFecha(new Date(2026, 0, 1));
    expect(result.slice(4)).toBe('01');
  });
});

// ---------------------------------------------------------------------------
// inicioSemanaIso
// ---------------------------------------------------------------------------
describe('inicioSemanaIso', () => {

  it('miércoles → devuelve el lunes de esa semana', () => {
    const mie = new Date(2026, 3, 29); // miércoles 29 abril
    const lunes = inicioSemanaIso(mie);
    expect(lunes.getFullYear()).toBe(2026);
    expect(lunes.getMonth()).toBe(3);
    expect(lunes.getDate()).toBe(27); // lunes 27 abril
  });

  it('lunes → devuelve el mismo lunes', () => {
    const lun = new Date(2026, 3, 27); // lunes 27 abril
    const result = inicioSemanaIso(lun);
    expect(result.getDate()).toBe(27);
    expect(result.getMonth()).toBe(3);
  });

  it('domingo → devuelve el lunes anterior (ISO: domingo es fin de semana)', () => {
    const dom = new Date(2026, 4, 3); // domingo 3 mayo (fin semana 18)
    const lunes = inicioSemanaIso(dom);
    expect(lunes.getDate()).toBe(27); // lunes 27 abril
    expect(lunes.getMonth()).toBe(3);
  });

  it('sábado → devuelve el lunes de esa semana', () => {
    const sab = new Date(2026, 4, 2); // sábado 2 mayo
    const lunes = inicioSemanaIso(sab);
    expect(lunes.getDate()).toBe(27);
    expect(lunes.getMonth()).toBe(3);
  });

  it('la fecha devuelta tiene hora 00:00:00.000', () => {
    const d = new Date(2026, 3, 29, 15, 30, 0);
    const lunes = inicioSemanaIso(d);
    expect(lunes.getHours()).toBe(0);
    expect(lunes.getMinutes()).toBe(0);
    expect(lunes.getSeconds()).toBe(0);
    expect(lunes.getMilliseconds()).toBe(0);
  });

  it('semanaIsoDesdeFecha(inicioSemanaIso(d)) === semanaIsoDesdeFecha(d)', () => {
    // El inicio de semana debe pertenecer a la misma semana ISO
    const d = new Date(2026, 3, 29);
    const lunes = inicioSemanaIso(d);
    expect(semanaIsoDesdeFecha(lunes)).toBe(semanaIsoDesdeFecha(d));
  });
});

// ---------------------------------------------------------------------------
// agregarDias
// ---------------------------------------------------------------------------
describe('agregarDias', () => {

  it('agrega días correctamente dentro del mismo mes', () => {
    const base = new Date(2026, 3, 27); // 27 abril
    const result = agregarDias(base, 3);
    expect(result.getDate()).toBe(30);
    expect(result.getMonth()).toBe(3);
  });

  it('cruza fin de mes correctamente', () => {
    const base = new Date(2026, 3, 29); // 29 abril
    const result = agregarDias(base, 5); // → 4 mayo
    expect(result.getDate()).toBe(4);
    expect(result.getMonth()).toBe(4);
  });

  it('cruza fin de año correctamente', () => {
    const base = new Date(2026, 11, 30); // 30 dic
    const result = agregarDias(base, 5); // → 4 enero 2027
    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(4);
  });

  it('resta días con valor negativo', () => {
    const base = new Date(2026, 3, 29);
    const result = agregarDias(base, -2); // → 27 abril
    expect(result.getDate()).toBe(27);
  });

  it('no muta la fecha original', () => {
    const base = new Date(2026, 3, 29);
    const originalTime = base.getTime();
    agregarDias(base, 5);
    expect(base.getTime()).toBe(originalTime);
  });

  it('agregarDias(d, 0) === d (mismo día)', () => {
    const base = new Date(2026, 3, 29);
    const result = agregarDias(base, 0);
    expect(result.getDate()).toBe(base.getDate());
  });
});

// ---------------------------------------------------------------------------
// numeroSemanaDesdeLunes
// ---------------------------------------------------------------------------
describe('numeroSemanaDesdeLunes', () => {

  it('lunes semana 1 → 1', () => {
    expect(numeroSemanaDesdeLunes(new Date(2026, 0, 5))).toBe(2); // 5 enero = semana 2
  });

  it('lunes 27 abril 2026 → 18', () => {
    expect(numeroSemanaDesdeLunes(new Date(2026, 3, 27))).toBe(18);
  });

  it('es consistente con semanaIsoDesdeFecha', () => {
    const lunes = new Date(2026, 3, 27);
    const semanaStr = semanaIsoDesdeFecha(lunes);
    const numDesdeSemana = parseInt(semanaStr.slice(4), 10);
    expect(numeroSemanaDesdeLunes(lunes)).toBe(numDesdeSemana);
  });
});
