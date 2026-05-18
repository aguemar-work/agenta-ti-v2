import { useCallback, useRef, useState } from 'react';

const OPEN_OFFSET_PX = -132;
const SNAP_THRESHOLD_PX = 44;

/**
 * Revela acciones al deslizar la fila hacia la izquierda (móvil).
 */
export function useSwipeOTRow(enabled: boolean) {
  const startRef = useRef<{ x: number; y: number; base: number } | null>(null);
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    setOffset(0);
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled) return;
      const t = e.touches[0];
      if (!t) return;
      startRef.current = { x: t.clientX, y: t.clientY, base: open ? OPEN_OFFSET_PX : 0 };
    },
    [enabled, open],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || !startRef.current) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - startRef.current.x;
      const dy = Math.abs(t.clientY - startRef.current.y);
      if (dy > 48) return;
      const next = Math.min(0, Math.max(OPEN_OFFSET_PX, startRef.current.base + dx));
      setOffset(next);
    },
    [enabled],
  );

  const onTouchEnd = useCallback(() => {
    if (!enabled) return;
    startRef.current = null;
    if (Math.abs(offset) > SNAP_THRESHOLD_PX && offset < 0) {
      setOpen(true);
      setOffset(OPEN_OFFSET_PX);
    } else {
      close();
    }
  }, [enabled, offset, close]);

  return {
    offset,
    open,
    close,
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
  };
}
