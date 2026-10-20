import { useEffect, useState } from 'react';
import { isMobileViewport, MOBILE_QUERY } from '../lib/viewport';

const matches = () => {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia && isMobileViewport(
      window.innerWidth, window.matchMedia('(pointer: coarse)').matches, window.screen,
    );
  } catch {
    return false;
  }
};

/** Celular, inclusive deitado: uma coluna, Binder e Inspector como sobreposições. */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(matches);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(matches());
    onChange();
    mql.addEventListener('change', onChange);
    // A rotação pode mudar a tela sem cruzar o limite da consulta de candidatos.
    window.addEventListener('resize', onChange);
    return () => {
      mql.removeEventListener('change', onChange);
      window.removeEventListener('resize', onChange);
    };
  }, []);
  return isMobile;
}
