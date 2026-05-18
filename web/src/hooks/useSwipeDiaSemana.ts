import { useEffect, useRef } from 'react';

const SWIPE_MIN_PX = 48;
const SWIPE_MAX_VERTICAL_PX = 40;

/**
 * Navegación por swipe horizontal entre días (móvil).
 * Solo activo cuando `enabled` es true.
 */
export function useSwipeDiaSemana(
  diasYmd: string[],
  diaActivo: string,
  onChange: (ymd: string) => void,
) {
  const startRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    if (!mq.matches || diasYmd.length < 2) return;

    function onTouchStart(e: TouchEvent) {
      const t = e.touches[0];
      if (!t) return;
      startRef.current = { x: t.clientX, y: t.clientY };
    }

    function onTouchEnd(e: TouchEvent) {
      const start = startRef.current;
      startRef.current = null;
      if (!start) return;
      const t = e.changedTouches[0];
      if (!t) return;

      const dx = t.clientX - start.x;
      const dy = Math.abs(t.clientY - start.y);
      if (dy > SWIPE_MAX_VERTICAL_PX || Math.abs(dx) < SWIPE_MIN_PX) return;

      const idx = diasYmd.indexOf(diaActivo);
      if (idx < 0) return;

      if (dx < 0 && idx < diasYmd.length - 1) onChange(diasYmd[idx + 1]!);
      else if (dx > 0 && idx > 0) onChange(diasYmd[idx - 1]!);
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [diasYmd, diaActivo, onChange]);
}
