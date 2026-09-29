import { useEffect, useRef, useState } from 'react';
import { reduceMotion } from '@/lib/pk/tokens';

// Motion 1 and 2: a figure counts up the first time it appears (once per session per key), and when it
// later changes it counts to the new value and flashes 'up' or 'down' for a moment.
// Works with "58", "$1.33M", "$560K", "91%".
const played = new Set<string>();

function parse(text: string) {
  const m = /^([^\d-]*)(-?[\d,.]+)(.*)$/.exec(text.trim());
  if (!m) return null;
  const n = parseFloat(m[2].replace(/,/g, ''));
  const decimals = (m[2].split('.')[1] ?? '').length;
  return isFinite(n) ? { pre: m[1], n, post: m[3], decimals } : null;
}

export function useCountUp(text: string, key: string, ms = 900) {
  const [shown, setShown] = useState(text);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const prev = useRef<string | null>(null);
  useEffect(() => {
    const to = parse(text);
    const from = prev.current != null ? parse(prev.current) : null;
    const first = prev.current == null;
    prev.current = text;
    if (!to || reduceMotion() || (first && played.has(key))) return setShown(text);
    if (!first && from && from.n === to.n) return setShown(text);
    played.add(key);
    const start = first ? 0 : from?.n ?? 0;
    if (!first && from) setFlash(to.n > from.n ? 'up' : 'down');
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      const v = start + (to.n - start) * e;
      setShown(`${to.pre}${v.toFixed(to.decimals)}${to.post}`);
      if (k < 1) raf = requestAnimationFrame(step);
      else setTimeout(() => setFlash(null), 900);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [text, key]);
  return { text: shown, flash };
}
