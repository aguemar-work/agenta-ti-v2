import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Sincroniza filtros de vista con la query string (persisten al navegar y al volver atrás).
 * Omite claves cuyo valor coincide con `defaults`.
 */
export function useFilterSearchParams<K extends string>(
  defaults: Record<K, string>,
): [Record<K, string>, (key: K, value: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const values = useMemo(() => {
    const next = { ...defaults };
    for (const key of Object.keys(defaults) as K[]) {
      const raw = searchParams.get(key);
      if (raw != null && raw !== '') next[key] = raw;
    }
    return next;
    // defaults es estable (constante de módulo o useMemo en la página)
  }, [searchParams, defaults]);

  const setValue = useCallback(
    (key: K, value: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const fallback = defaults[key];
          if (value === fallback || value === '') next.delete(key);
          else next.set(key, value);
          return next;
        },
        { replace: true },
      );
    },
    [defaults, setSearchParams],
  );

  return [values, setValue];
}
