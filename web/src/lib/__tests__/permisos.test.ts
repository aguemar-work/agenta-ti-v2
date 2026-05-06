import { describe, expect, it } from 'vitest';

import { puedeGestionarTarea } from '@/lib/permisos';
import { makeTarea, makeUsuario, makeJefe } from '@/test/helpers';

describe('puedeGestionarTarea', () => {

  // ── Guardia de usuario nulo ───────────────────────────────────────────────

  describe('usuario nulo o undefined', () => {
    it('devuelve false si usuario es null', () => {
      expect(puedeGestionarTarea(makeTarea(), null)).toBe(false);
    });

    it('devuelve false si usuario es undefined', () => {
      expect(puedeGestionarTarea(makeTarea(), undefined)).toBe(false);
    });
  });

  // ── Rol jefe ──────────────────────────────────────────────────────────────

  describe('jefe', () => {
    const jefe = makeJefe();

    it('puede gestionar su propia tarea', () => {
      const t = makeTarea({ asignado_a: jefe.id });
      expect(puedeGestionarTarea(t, jefe)).toBe(true);
    });

    it('puede gestionar tarea asignada a otro miembro', () => {
      const t = makeTarea({ asignado_a: 'uuid-otro-miembro' });
      expect(puedeGestionarTarea(t, jefe)).toBe(true);
    });

    it('puede gestionar tarea sin asignado', () => {
      const t = makeTarea({ asignado_a: null as unknown as string });
      expect(puedeGestionarTarea(t, jefe)).toBe(true);
    });
  });

  // ── Rol miembro ───────────────────────────────────────────────────────────

  describe('miembro', () => {
    const miembro = makeUsuario({ id: 'uuid-miembro' });

    it('puede gestionar tarea que le fue asignada', () => {
      const t = makeTarea({ asignado_a: miembro.id });
      expect(puedeGestionarTarea(t, miembro)).toBe(true);
    });

    it('NO puede gestionar tarea asignada a otro usuario', () => {
      const t = makeTarea({ asignado_a: 'uuid-otro' });
      expect(puedeGestionarTarea(t, miembro)).toBe(false);
    });

    it('NO puede gestionar tarea asignada al jefe', () => {
      const jefe = makeJefe();
      const t = makeTarea({ asignado_a: jefe.id });
      expect(puedeGestionarTarea(t, miembro)).toBe(false);
    });

    it('NO puede gestionar tarea sin asignado', () => {
      const t = makeTarea({ asignado_a: null as unknown as string });
      expect(puedeGestionarTarea(t, miembro)).toBe(false);
    });
  });

  // ── Estados de tarea no afectan el permiso ────────────────────────────────

  describe('el estado de la tarea no afecta el permiso', () => {
    const miembro = makeUsuario({ id: 'uuid-miembro' });
    const estados = ['pendiente', 'en_progreso', 'completada', 'bloqueada', 'atrasada', 'reprogramada', 'cancelada'] as const;

    for (const estado of estados) {
      it(`miembro puede gestionar tarea propia en estado "${estado}"`, () => {
        const t = makeTarea({ asignado_a: miembro.id, estado });
        expect(puedeGestionarTarea(t, miembro)).toBe(true);
      });
    }
  });
});