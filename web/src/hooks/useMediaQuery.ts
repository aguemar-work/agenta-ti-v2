import { useEffect, useState } from 'react';

/** Suscripción a `matchMedia` con valor inicial en SSR-safe (false hasta montar). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => { setMatches(mq.matches); };
    onChange();
    mq.addEventListener('change', onChange);
    return () => { mq.removeEventListener('change', onChange); };
  }, [query]);

  return matches;
}
