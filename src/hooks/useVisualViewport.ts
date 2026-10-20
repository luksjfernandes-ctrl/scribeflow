import { useEffect } from 'react';
import { measureAppViewport, type AppViewport } from '../lib/viewport';

const editableFocused = () => {
  const element = document.activeElement;
  return element instanceof HTMLElement && (element.isContentEditable || element.matches(
    'textarea, input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="hidden"]):not([type="file"]):not([type="color"])',
  ));
};

/** Fora da edição com teclado, o CSS (100dvh/top:0) controla a raiz. Isso evita
 *  conservar altura/offset transitórios do iOS depois de uma rotação. */
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
    let settleTimers: ReturnType<typeof setTimeout>[] = [];
    let previous: AppViewport | undefined;
    const apply = () => {
      frame = 0;
      const focused = editableFocused();
      const m = measureAppViewport(window.innerHeight, window.visualViewport, previous, focused);
      previous = focused ? m : undefined;
      if (!m.keyboardOpen) {
        clear();
        return;
      }
      root.style.setProperty('--app-height', `${m.height}px`);
      root.style.setProperty('--app-offset-top', `${m.offsetTop}px`);
      root.dataset.keyboard = 'open';
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const rotate = () => {
      previous = undefined;
      clear();
      for (const timer of settleTimers) clearTimeout(timer);
      // No iOS, orientação e geometria final podem chegar em momentos distintos.
      const settle = () => {
        if (!editableFocused() && (!window.visualViewport || window.visualViewport.scale === 1)) {
          window.scrollTo(0, 0);
        }
        schedule();
      };
      settle();
      settleTimers = [100, 300, 600].map(delay => setTimeout(settle, delay));
    };
    apply();
    vv?.addEventListener('resize', schedule);
    vv?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', rotate);
    window.screen.orientation?.addEventListener('change', rotate);
    document.addEventListener('focusin', schedule);
    document.addEventListener('focusout', schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      for (const timer of settleTimers) clearTimeout(timer);
      vv?.removeEventListener('resize', schedule);
      vv?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', rotate);
      window.screen.orientation?.removeEventListener('change', rotate);
      document.removeEventListener('focusin', schedule);
      document.removeEventListener('focusout', schedule);
      clear();
    };
  }, [enabled]);
}
