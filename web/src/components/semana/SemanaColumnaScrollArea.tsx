import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

/** Columna con scroll vertical e indicador discreto de contenido oculto al fondo. */
export function SemanaColumnaScrollArea({ children }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hiddenCount, setHiddenCount] = useState(0);

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const { scrollTop, clientHeight, scrollHeight } = el;
    if (scrollHeight <= clientHeight + 2) {
      setHiddenCount(0);
      return;
    }

    const remaining = scrollHeight - scrollTop - clientHeight;
    if (remaining <= 4) {
      setHiddenCount(0);
      return;
    }

    const viewportBottom = el.getBoundingClientRect().bottom;
    let hidden = 0;
    for (const child of el.children) {
      const rect = child.getBoundingClientRect();
      if (rect.top >= viewportBottom - 6) hidden += 1;
      else if (rect.bottom > viewportBottom + 6) hidden += 1;
    }
    setHiddenCount(Math.max(1, hidden));
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener('scroll', measure, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', measure);
    };
  }, [measure, children]);

  return (
    <div className="mc-semana-dia-col__body relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div ref={scrollRef} className="mc-semana-dia-col__scroll">
        {children}
      </div>
      {hiddenCount > 0 ? (
        <p className="mc-semana-dia-col__scroll-hint" aria-hidden>
          ↓ {hiddenCount} más
        </p>
      ) : null}
    </div>
  );
}
