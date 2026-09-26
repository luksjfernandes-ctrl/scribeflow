/**
 * Subtitulo do capitulo exibido como epigrafe de livro. O dado continua texto
 * puro em `metadata.subtitle`; aqui so se decide como cada linha aparece.
 *
 * Regra (a exportacao deve seguir a mesma, ver o PR #26):
 * - atribuicao ("— Seneca"):
 *   a) qualquer linha que comeca com travessao (—), meia-risca (–) ou "--"; ou
 *   b) a ULTIMA linha, quando ha citacao antes dela, tem ate 6 palavras e nao
 *      termina em pontuacao de frase (. ! ? … : ;), ex.: "Maxim Gorky".
 *   Exibida em linha propria, a direita, em redondo e versalete, sempre com
 *   "— " na frente. O travessao e acrescentado so na exibicao; o texto salvo
 *   nao muda.
 * - as outras linhas sao a citacao: italico, justificado;
 * - linhas em branco separam estrofes/paragrafos da citacao.
 */

export type EpigraphLineKind = 'quote' | 'attribution' | 'blank';

export interface EpigraphLine {
  kind: EpigraphLineKind;
  /** Texto como foi digitado (sem espacos nas pontas). */
  text: string;
  /** Texto para exibir: na atribuicao, sempre com "— " na frente. */
  display: string;
}

const DASH_PREFIX = /^\s*(—|–|--)\s*/;
const SENTENCE_END = /[.!?…:;]["'»”)]*$/;
export const ATTRIBUTION_MAX_WORDS = 6;

export function isAttributionLine(line: string): boolean {
  return DASH_PREFIX.test(line);
}

/** Ultima linha curta e sem ponto final, depois de uma citacao: e a atribuicao. */
export function looksLikeBareAttribution(line: string): boolean {
  const t = line.trim();
  if (!t || SENTENCE_END.test(t)) return false;
  return t.split(/\s+/).length <= ATTRIBUTION_MAX_WORDS;
}

const attributionDisplay = (line: string) => `— ${line.trim().replace(DASH_PREFIX, '')}`;

export function parseEpigraph(text: string | null | undefined): EpigraphLine[] {
  if (!text || !text.trim()) return [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  // Linhas em branco nas pontas nao tem funcao visual.
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const parsed: EpigraphLine[] = lines.map((line) => {
    const t = line.trim();
    if (!t) return { kind: 'blank', text: '', display: '' };
    if (isAttributionLine(t)) return { kind: 'attribution', text: t, display: attributionDisplay(t) };
    return { kind: 'quote', text: t, display: t };
  });
  const last = parsed[parsed.length - 1];
  const hasQuoteBefore = parsed.slice(0, -1).some((l) => l.kind === 'quote');
  if (last.kind === 'quote' && hasQuoteBefore && looksLikeBareAttribution(last.text)) {
    parsed[parsed.length - 1] = { kind: 'attribution', text: last.text, display: attributionDisplay(last.text) };
  }
  return parsed;
}
