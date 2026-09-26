/**
 * Rolagem de máquina de escrever do modo Compose (lógica pura, sem DOM).
 *
 * O cursor deve ficar dentro de uma faixa central do contêiner. Enquanto ele
 * estiver na faixa, nada rola. Quando sai, a rolagem leva o cursor só até a
 * borda mais próxima da faixa: a cada linha nova o texto sobe uma linha, sem
 * saltos para o meio ou para o início do documento.
 */

export interface TypewriterScrollInput {
  /** Topo do cursor, em coordenadas de viewport (coordsAtPos().top). */
  caretTop: number;
  /** Base do cursor, em coordenadas de viewport (coordsAtPos().bottom). */
  caretBottom: number;
  /** Topo do contêiner rolável, em coordenadas de viewport. */
  containerTop: number;
  /** Altura visível do contêiner (clientHeight). */
  containerHeight: number;
  /** scrollTop atual do contêiner. */
  scrollTop: number;
  /** scrollHeight - clientHeight: o máximo que o contêiner rola. */
  maxScrollTop: number;
  /** Borda superior da faixa, em fração da altura (padrão 0,3). */
  bandTop?: number;
  /** Borda inferior da faixa, em fração da altura (padrão 0,55). */
  bandBottom?: number;
}

/** Devolve o novo scrollTop, ou null se o cursor já está na faixa. */
export function computeTypewriterScroll({
  caretTop,
  caretBottom,
  containerTop,
  containerHeight,
  scrollTop,
  maxScrollTop,
  bandTop = 0.3,
  bandBottom = 0.55,
}: TypewriterScrollInput): number | null {
  const top = caretTop - containerTop;
  const bottom = caretBottom - containerTop;
  const limiteSuperior = containerHeight * bandTop;
  const limiteInferior = containerHeight * bandBottom;

  let delta = 0;
  if (bottom > limiteInferior) delta = bottom - limiteInferior;
  else if (top < limiteSuperior) delta = top - limiteSuperior;
  if (delta === 0) return null;

  const alvo = Math.round(Math.min(Math.max(scrollTop + delta, 0), Math.max(maxScrollTop, 0)));
  return alvo === Math.round(scrollTop) ? null : alvo;
}
