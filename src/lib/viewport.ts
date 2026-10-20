/** Largura abaixo da qual o app vira uma coluna por vez (celular). */
export const MOBILE_MAX_WIDTH = 767;
// Consulta de candidatos: o hook também confere a tela física para distinguir
// celular deitado de tablet. A altura da janela varia com o teclado virtual.
export const MOBILE_QUERY = `(max-width: ${MOBILE_MAX_WIDTH}px), (max-width: 1023px) and (pointer: coarse)`;

export function isMobileViewport(
  width: number,
  coarsePointer: boolean,
  screen: { width: number; height: number },
): boolean {
  if (width <= MOBILE_MAX_WIDTH) return true;
  const shortSide = Math.min(screen.width, screen.height);
  return width <= 1023 && coarsePointer && Number.isFinite(shortSide) && shortSide > 0 && shortSide <= 500;
}

export interface VisualViewportLike {
  height: number;
  offsetTop: number;
  scale?: number;
}

export interface AppViewport {
  /** Altura visível de fato (sem o teclado virtual). */
  height: number;
  /** Quanto o iOS rolou a janela visual para mostrar o cursor. */
  offsetTop: number;
  /** Teclado virtual aberto (a área visível encolheu de forma relevante). */
  keyboardOpen: boolean;
}

/** Mede a área visível. No iOS o teclado não encolhe o layout (innerHeight fica
 *  igual); só a visualViewport encolhe e desloca. Seguimos a visualViewport para
 *  que a barra de formatação fique logo acima do teclado e nada pule. */
export function measureAppViewport(
  innerHeight: number,
  vv: VisualViewportLike | null | undefined,
  previous?: AppViewport,
): AppViewport {
  const fallback = previous ?? { height: innerHeight, offsetTop: 0, keyboardOpen: false };
  if (!vv) return { height: innerHeight, offsetTop: 0, keyboardOpen: false };
  // Pinça/pan muda a área VISÍVEL, não o layout. Redimensionar a raiz aqui
  // reflowa o texto durante o gesto e ainda confunde o zoom com o teclado.
  // Preserva também o teclado já aberto; retoma a medição ao voltar à escala 1.
  if (vv.scale !== undefined && (!Number.isFinite(vv.scale) || Math.abs(vv.scale - 1) > 0.01)) return fallback;
  if (!Number.isFinite(vv.height) || vv.height <= 0 || !Number.isFinite(vv.offsetTop)) return fallback;
  const height = Math.round(vv.height);
  const offsetTop = Math.max(0, Math.round(vv.offsetTop));
  // Barras do Safari variam ~80px; teclado tira bem mais que isso.
  const keyboardOpen = innerHeight - height > 120;
  return { height, offsetTop, keyboardOpen };
}
