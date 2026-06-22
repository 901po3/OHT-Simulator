import { useEffect, useState } from 'react';

/**
 * Returns true when the viewport width is <= 768px.
 * Reacts to window resize / device rotation via matchMedia.
 */
export function useIsMobile(): boolean {
  const query = '(max-width: 768px)';
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    // Set initial in case it changed before mount
    setIsMobile(mql.matches);
    if (mql.addEventListener) {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    } else {
      // Safari < 14 fallback
      mql.addListener(handler);
      return () => mql.removeListener(handler);
    }
  }, []);

  return isMobile;
}
