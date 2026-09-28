import { useEffect } from 'react';
import { measureAppViewport } from '../lib/viewport';

/** No celular, prende a raiz do app à área visível (visualViewport): com o
 *  teclado aberto a raiz encolhe e acompanha o deslocamento do iOS, então a barra
 *  de formatação (última faixa da coluna do editor) fica logo acima do teclado
 *  e o layout não "dança" ao focar. Publica --app-height e --app-offset-top. */
export function useVisualViewport(enabled: boolean) {
  useEffect(() => {
    const root = document.documentElement;
    const clear = () => {
      root.style.removeProperty('--app-height');
      root.style.removeProperty('--app-offset-top');
      delete root.dataset.keyboard;
    };
    if (!enabled) {
      clear();
      return;
    }
    const vv = window.visualViewport;
    let frame = 0;
    const apply = () => {
      frame = 0;
      const m = measureAppViewport(window.innerHeight, vv);
      root.style.setProperty('--app-height', `${m.height}px`);
      root.style.setProperty('--app-offset-top', `${m.offsetTop}px`);
      if (m.keyboardOpen) root.dataset.keyboard = 'open';
      else delete root.dataset.keyboard;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    apply();
    vv?.addEventListener('resize', schedule);
    vv?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      vv?.removeEventListener('resize', schedule);
      vv?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      clear();
    };
  }, [enabled]);
}
