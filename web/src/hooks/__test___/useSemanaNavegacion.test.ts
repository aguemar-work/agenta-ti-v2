import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useSemanaNavegacion } from '@/hooks/useSemanaNavegacion';
import { useAuthStore } from '@/store/authStore';
import { useVistaStore } from '@/store/vistaStore';
import { makeUsuario, makeJefe } from '@/test/helpers';

// ---------------------------------------------------------------------------
// Mocks de dependencias externas al hook
// ---------------------------------------------------------------------------

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({ data: undefined }),
  };
});

vi.mock('@/hooks/useUsuarios', () => ({
  useUsuariosActivos: () => ({ data: [] }),
}));

vi.mock('@/hooks/useTareas', () => ({
  useUsuariosParaSelector: () => ({ data: [] }),
}));

vi.mock('@/api/objetivos', () => ({
  getObjetivosActivos: vi.fn().mockResolvedValue([]),
}));

// ---------------------------------------------------------------------------

function setupAuth(usuario = makeUsuario()) {
  useAuthStore.setState({ usuario, isLoading: false, authUser: null });
}

beforeEach(() => {
  useVistaStore.setState({ seleccionId: null });
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------

describe('useSemanaNavegacion', () => {

  // ── Modo inicial ──────────────────────────────────────────────────────────

  describe('modo inicial', () => {
    it('usa "hoy" en días L-J (lunes=1)', () => {
      vi.setSystemTime(new Date('2026-04-27T10:00:00')); // lunes
      setupAuth();
      const { result } = renderHook(() => useSemanaNavegacion());
      expect(result.current.esModoHoy).toBe(true);
      vi.useRealTimers();
    });

    it('usa "semana" en viernes', () => {
      vi.setSystemTime(new Date('2026-05-01T10:00:00')); // viernes
      setupAuth();
      const { result } = renderHook(() => useSemanaNavegacion());
      expect(result.current.esModoHoy).toBe(false);
      vi.useRealTimers();
    });

    it('respeta el valor guardado en localStorage', () => {
      localStorage.setItem('mc-modo-semana', 'semana');
      vi.setSystemTime(new Date('2026-04-27T10:00:00')); // lunes — sería hoy por defecto
      setupAuth();
      const { result } = renderHook(() => useSemanaNavegacion());
      expect(result.current.esModoHoy).toBe(false);
      vi.useRealTimers();
    });
  });

  // ── setModo ───────────────────────────────────────────────────────────────

  describe('setModo', () => {
    it('cambia esModoHoy a false al activar modo semana', () => {
      setupAuth();
      const { result } = renderHook(() => useSemanaNavegacion());
      act(() => { result.current.setModo('semana'); });
      expect(result.current.esModoHoy).toBe(false);
    });

    it('cambia esModoHoy a true al activar modo hoy', () => {
      localStorage.setItem('mc-modo-semana', 'semana');
      setupAuth();
      const { result } = renderHook(() => useSemanaNavegacion());
      act(() => { result.current.setModo('hoy'); });
      expect(result.current.esModoHoy).toBe(true);
    });

    it('persiste el modo en localStorage', () => {
      setupAuth();
      const { result } = renderHook(() => useSemanaNavegacion());
      act(() => { result.current.setModo('semana'); });
      expect(localStorage.getItem('mc-modo-semana')).toBe('semana');
    });
  });

  // ── Navegación de semana ──────────────────────────────────────────────────

  describe('navegación de semana', () => {
    it('diasSemana tiene 6 elementos (L-S)', () => {
      setupAuth();
      const { result } = renderHook(() => useSemanaNavegacion());
      expect(result.current.diasSemana).toHaveLength(6);
    });

    it('sabado es 5 días después del lunes', () => {
      setupAuth();
      const { result } = renderHook(() => useSemanaNavegacion());
      const diff = result.current.sabado.getTime() - result.current.lunes.getTime();
      expect(diff).toBe(5 * 24 * 60 * 60 * 1000);
    });

    it('avanzar semana mueve el lunes 7 días hacia adelante', () => {
      setupAuth();
      const { result } = renderHook(() => useSemanaNavegacion());
      const lunesOriginal = result.current.lunes.getTime();
      act(() => {
        result.current.setLunes((d: Date) => new Date(d.getTime() + 7 * 24 * 60 * 60 * 1000));
      });
      expect(result.current.lunes.getTime()).toBe(lunesOriginal + 7 * 24 * 60 * 60 * 1000);
    });

    it('retroceder semana mueve el lunes 7 días hacia atrás', () => {
      setupAuth();
      const { result } = renderHook(() => useSemanaNavegacion());
      const lunesOriginal = result.current.lunes.getTime();
      act(() => {
        result.current.setLunes((d: Date) => new Date(d.getTime() - 7 * 24 * 60 * 60 * 1000));
      });
      expect(result.current.lunes.getTime()).toBe(lunesOriginal - 7 * 24 * 60 * 60 * 1000);
    });
  });

  // ── Banner viernes ────────────────────────────────────────────────────────

  describe('esBannerViernes', () => {
    it('es true solo los viernes', () => {
      vi.setSystemTime(new Date('2026-05-01T10:00:00')); // viernes
      setupAuth();
      const { result } = renderHook(() => useSemanaNavegacion());
      expect(result.current.esBannerViernes).toBe(true);
      vi.useRealTimers();
    });

    it('es false en días que no son viernes', () => {
      vi.setSystemTime(new Date('2026-04-27T10:00:00')); // lunes
      setupAuth();
      const { result } = renderHook(() => useSemanaNavegacion());
      expect(result.current.esBannerViernes).toBe(false);
      vi.useRealTimers();
    });
  });

  // ── Selector de usuario (jefe) ────────────────────────────────────────────

  describe('selector de usuario', () => {
    it('uid es el id del usuario autenticado por defecto', () => {
      const miembro = makeUsuario({ id: 'uuid-kevin' });
      setupAuth(miembro);
      const { result } = renderHook(() => useSemanaNavegacion());
      expect(result.current.uid).toBe('uuid-kevin');
    });

    it('uid cambia al llamar setSeleccionId (jefe cambia de vista)', () => {
      const jefe = makeJefe();
      setupAuth(jefe);
      const { result } = renderHook(() => useSemanaNavegacion());
      act(() => { result.current.setSeleccionId('uuid-otro-miembro'); });
      expect(result.current.uid).toBe('uuid-otro-miembro');
    });

    it('uid vuelve al propio si vistaStore.seleccionId es null', () => {
      const jefe = makeJefe({ id: 'uuid-jefe' });
      setupAuth(jefe);
      useVistaStore.setState({ seleccionId: null });
      const { result } = renderHook(() => useSemanaNavegacion());
      expect(result.current.uid).toBe('uuid-jefe');
    });
  });

  // ── Datos de usuario ──────────────────────────────────────────────────────

  describe('datos de usuario', () => {
    it('esJefe es true para rol jefe', () => {
      setupAuth(makeJefe());
      const { result } = renderHook(() => useSemanaNavegacion());
      expect(result.current.esJefe).toBe(true);
    });

    it('esJefe es false para rol miembro', () => {
      setupAuth(makeUsuario());
      const { result } = renderHook(() => useSemanaNavegacion());
      expect(result.current.esJefe).toBe(false);
    });
  });
});