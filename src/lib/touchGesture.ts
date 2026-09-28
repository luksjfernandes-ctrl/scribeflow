/** Gesto de toque do Binder no celular (sem o dnd-kit, que no toque não separa
 *  "segurar parado" de "segurar e arrastar"):
 *  - toque curto: clique normal (abre o item);
 *  - deslizar antes do tempo: rolagem da lista;
 *  - segurar LONG_PRESS_MS parado e soltar: menu de contexto;
 *  - segurar LONG_PRESS_MS e então mover: arrasta o item. */
export const LONG_PRESS_MS = 450;
export const MOVE_TOLERANCE_PX = 10;

export type TouchPhase = 'idle' | 'pressing' | 'armed' | 'dragging';

export interface GestureState {
  phase: TouchPhase;
  startX: number;
  startY: number;
}

export const idleGesture: GestureState = { phase: 'idle', startX: 0, startY: 0 };

export const moved = (s: GestureState, x: number, y: number) =>
  Math.hypot(x - s.startX, y - s.startY) > MOVE_TOLERANCE_PX;

/** Próxima fase ao mover o dedo. */
export function onTouchMovePhase(s: GestureState, x: number, y: number): TouchPhase {
  if (s.phase === 'pressing') return moved(s, x, y) ? 'idle' : 'pressing';
  if (s.phase === 'armed') return moved(s, x, y) ? 'dragging' : 'armed';
  return s.phase;
}

/** O que fazer ao soltar o dedo. */
export function onTouchEndAction(s: GestureState): 'none' | 'menu' | 'drop' {
  if (s.phase === 'armed') return 'menu';
  if (s.phase === 'dragging') return 'drop';
  return 'none';
}

/** Rolagem automática da gaveta enquanto arrasta perto das bordas (px por quadro;
 *  negativo sobe). Mais rápido quanto mais perto da borda. */
export function autoScrollSpeed(y: number, top: number, bottom: number, edge = 40, max = 14): number {
  if (y < top + edge) return -Math.ceil(max * Math.min(1, (top + edge - y) / edge));
  if (y > bottom - edge) return Math.ceil(max * Math.min(1, (y - (bottom - edge)) / edge));
  return 0;
}
