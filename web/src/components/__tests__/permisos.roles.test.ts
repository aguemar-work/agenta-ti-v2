/**
 * src/components/__tests__/permisos.roles.test.ts
 *
 * Matriz rol × bitácora × visibilidad — única cobertura que no existe en
 * src/lib/__tests__/permisos.test.ts ni en ningún otro archivo de test.
 *
 * Lo que YA cubre permisos.test.ts (no duplicamos):
 *   - puedeGestionarTarea × jefe/miembro/null × asignación
 *   - puedeGestionarTarea × todos los EstadoTarea
 *
 * Lo que añade ESTE archivo:
 *   1. selectEsJefe / selectRol  (lógica del store, no testada en permisos.test.ts)
 *   2. Visibilidad de notas de bitácora: matriz rol × visibilidad × autoría
 *      (regla de dominio: jefe ve todo, miembro solo sus notas y las públicas)
 */

import { describe, expect, it } from 'vitest';
import { selectEsJefe, selectRol } from '@/store/authStore';
import { makeUsuario, makeJefe, TEST_IDS } from '@/test/helpers';
import type { AuthState } from '@/store/authStore';
import type { VisibilidadBitacora } from '@/types';

// ---------------------------------------------------------------------------
// selectEsJefe / selectRol — lógica derivada del store (no en permisos.test.ts)
// ---------------------------------------------------------------------------

describe('selectEsJefe', () => {

  function estado(overrides: Partial<AuthState>): AuthState {
    return { usuario: null, authUser: null, isLoading: false, ...overrides } as AuthState;
  }

  it('devuelve true cuando el usuario tiene rol "jefe"', () => {
    expect(selectEsJefe(estado({ usuario: makeJefe() }))).toBe(true);
  });

  it('devuelve false cuando el usuario tiene rol "miembro"', () => {
    expect(selectEsJefe(estado({ usuario: makeUsuario() }))).toBe(false);
  });

  it('devuelve false cuando usuario es null (sin sesión)', () => {
    expect(selectEsJefe(estado({ usuario: null }))).toBe(false);
  });
});

describe('selectRol', () => {

  function estado(overrides: Partial<AuthState>): AuthState {
    return { usuario: null, authUser: null, isLoading: false, ...overrides } as AuthState;
  }

  it('devuelve "jefe" para usuario jefe', () => {
    expect(selectRol(estado({ usuario: makeJefe() }))).toBe('jefe');
  });

  it('devuelve "miembro" para usuario miembro', () => {
    expect(selectRol(estado({ usuario: makeUsuario() }))).toBe('miembro');
  });

  it('devuelve null cuando usuario es null', () => {
    expect(selectRol(estado({ usuario: null }))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Matriz visibilidad de bitácora: rol × visibilidad × autoría
//
// Regla de dominio (espejo de las RLS en BD):
//   Jefe        → ve TODAS las notas sin importar visibilidad ni autor
//   Miembro     → ve sus propias notas (cualquier visibilidad)
//                 ve notas ajenas SOLO si visibilidad = 'todos'
//   Sin sesión  → no ve nada
// ---------------------------------------------------------------------------

/**
 * Implementación pura de la regla de acceso a notas.
 * Esta función replica la lógica RLS sin depender del stack de red.
 * Los tests sirven como especificación ejecutable de la política.
 */
function puedeVerNota(
  visibilidad:     VisibilidadBitacora,
  notaAutorId:     string,
  viendoUsuarioId: string | null,
  esJefe:          boolean,
): boolean {
  if (!viendoUsuarioId) return false;
  if (esJefe) return true;
  if (notaAutorId === viendoUsuarioId) return true;
  return visibilidad === 'todos';
}

const JEFE_ID    = TEST_IDS.jefe;
const MIEMBRO_A  = TEST_IDS.miembro;
const MIEMBRO_B  = 'bbbbbbbb-bbbb-4bbb-abbb-000000000099'; // otro miembro

describe('Visibilidad de notas de bitácora — matriz completa', () => {

  // ── Jefe: acceso total ──────────────────────────────────────────────────

  describe('Jefe', () => {

    const visibilidades: VisibilidadBitacora[] = ['todos', 'solo_jefe', 'privado'];

    for (const vis of visibilidades) {
      it(`puede ver nota con visibilidad "${vis}" de cualquier miembro`, () => {
        expect(puedeVerNota(vis, MIEMBRO_A, JEFE_ID, true)).toBe(true);
      });

      it(`puede ver su propia nota con visibilidad "${vis}"`, () => {
        expect(puedeVerNota(vis, JEFE_ID, JEFE_ID, true)).toBe(true);
      });
    }
  });

  // ── Miembro: acceso restringido ──────────────────────────────────────────

  describe('Miembro: sus propias notas', () => {

    const visibilidades: VisibilidadBitacora[] = ['todos', 'solo_jefe', 'privado'];

    for (const vis of visibilidades) {
      it(`puede ver su propia nota con visibilidad "${vis}"`, () => {
        expect(puedeVerNota(vis, MIEMBRO_A, MIEMBRO_A, false)).toBe(true);
      });
    }
  });

  describe('Miembro: notas ajenas', () => {

    it('puede ver nota ajena con visibilidad "todos"', () => {
      expect(puedeVerNota('todos', MIEMBRO_B, MIEMBRO_A, false)).toBe(true);
    });

    it('NO puede ver nota ajena con visibilidad "solo_jefe"', () => {
      expect(puedeVerNota('solo_jefe', MIEMBRO_B, MIEMBRO_A, false)).toBe(false);
    });

    it('NO puede ver nota ajena con visibilidad "privado"', () => {
      expect(puedeVerNota('privado', MIEMBRO_B, MIEMBRO_A, false)).toBe(false);
    });
  });

  // ── Sin sesión (userId null) ─────────────────────────────────────────────

  describe('Sin sesión (usuario null)', () => {

    const visibilidades: VisibilidadBitacora[] = ['todos', 'solo_jefe', 'privado'];

    for (const vis of visibilidades) {
      it(`no puede ver nota con visibilidad "${vis}"`, () => {
        expect(puedeVerNota(vis, MIEMBRO_A, null, false)).toBe(false);
      });
    }
  });

  // ── Tabla de verdad completa: rol × visibilidad × autoría ───────────────

  describe('tabla de verdad exhaustiva (rol × visibilidad × ¿propio?)', () => {

    type Caso = {
      rol:        'jefe' | 'miembro' | 'sin_sesion';
      vis:        VisibilidadBitacora;
      propio:     boolean;
      esperado:   boolean;
    };

    const casos: Caso[] = [
      // Jefe ve todo, siempre
      { rol: 'jefe',      vis: 'todos',     propio: true,  esperado: true  },
      { rol: 'jefe',      vis: 'todos',     propio: false, esperado: true  },
      { rol: 'jefe',      vis: 'solo_jefe', propio: true,  esperado: true  },
      { rol: 'jefe',      vis: 'solo_jefe', propio: false, esperado: true  },
      { rol: 'jefe',      vis: 'privado',   propio: true,  esperado: true  },
      { rol: 'jefe',      vis: 'privado',   propio: false, esperado: true  },
      // Miembro: propia nota → siempre puede
      { rol: 'miembro',   vis: 'todos',     propio: true,  esperado: true  },
      { rol: 'miembro',   vis: 'solo_jefe', propio: true,  esperado: true  },
      { rol: 'miembro',   vis: 'privado',   propio: true,  esperado: true  },
      // Miembro: nota ajena → solo si 'todos'
      { rol: 'miembro',   vis: 'todos',     propio: false, esperado: true  },
      { rol: 'miembro',   vis: 'solo_jefe', propio: false, esperado: false },
      { rol: 'miembro',   vis: 'privado',   propio: false, esperado: false },
      // Sin sesión: nunca
      { rol: 'sin_sesion', vis: 'todos',     propio: false, esperado: false },
      { rol: 'sin_sesion', vis: 'solo_jefe', propio: false, esperado: false },
      { rol: 'sin_sesion', vis: 'privado',   propio: false, esperado: false },
    ];

    for (const { rol, vis, propio, esperado } of casos) {
      it(`${rol} + "${vis}" + propio=${String(propio)} → ${String(esperado)}`, () => {
        const esJefe     = rol === 'jefe';
        const viendoId   = rol === 'sin_sesion' ? null : (esJefe ? JEFE_ID : MIEMBRO_A);
        const autorId    = propio ? (viendoId ?? MIEMBRO_A) : MIEMBRO_B;

        expect(puedeVerNota(vis, autorId, viendoId, esJefe)).toBe(esperado);
      });
    }
  });
});
