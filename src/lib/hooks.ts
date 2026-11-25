import { useEffect, useState } from 'react';
import { COUNTER } from '../tunables';

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** Acres-protected counter: +1 roughly every 7 seconds. */
export function useLiveCounter() {
  const [value, setValue] = useState<number>(COUNTER.start);
  useEffect(() => {
    let id = 0;
    const tick = () => {
      id = window.setTimeout(
        () => {
          setValue((v) => v + 1);
          tick();
        },
        COUNTER.intervalMs + (Math.random() * 2 - 1) * COUNTER.jitterMs,
      );
    };
    tick();
    return () => window.clearTimeout(id);
  }, []);
  return value;
}

export const formatNumber = (n: number) => n.toLocaleString('en-US');
