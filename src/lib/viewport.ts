/** Largura abaixo da qual o app vira uma coluna por vez (celular). */
export const MOBILE_MAX_WIDTH = 767;
export const MOBILE_QUERY = `(max-width: ${MOBILE_MAX_WIDTH}px)`;

export interface VisualViewportLike {
  height: number;
  offsetTop: number;
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
export function measureAppViewport(innerHeight: number, vv: VisualViewportLike | null | undefined): AppViewport {
  if (!vv || !(vv.height > 0)) return { height: innerHeight, offsetTop: 0, keyboardOpen: false };
  const height = Math.round(vv.height);
  const offsetTop = Math.max(0, Math.round(vv.offsetTop));
  // Barras do Safari variam ~80px; teclado tira bem mais que isso.
  const keyboardOpen = innerHeight - height > 120;
  return { height, offsetTop, keyboardOpen };
}
