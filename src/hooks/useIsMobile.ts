import { useEffect, useState } from 'react';
import { MOBILE_QUERY } from '../lib/viewport';

const matches = () => {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(MOBILE_QUERY).matches;
  } catch {
    return false;
  }
};

/** Tela estreita (celular): uma coluna por vez, Binder e Inspector como sobreposições. */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(matches);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}
