/**
 * Subtitulo do capitulo exibido como epigrafe de livro. O dado continua texto
 * puro em `metadata.subtitle`; aqui so se decide como cada linha aparece.
 *
 * Regra (a exportacao deve seguir a mesma, ver o PR #26):
 * - atribuicao ("— Seneca"): so as linhas FINAIS, e so com citacao antes:
 *   a) o bloco final de linhas que comecam com travessao (—), meia-risca (–)
 *      ou "--"; ou
 *   b) a ULTIMA linha, se tem ate 6 palavras e nao termina em pontuacao de
 *      frase (. ! ? … : ;), ex.: "Maxim Gorky".
 *   Travessao no meio da epigrafe e dialogo e fica como citacao.
 *   Dono: sf-exportar (a exportacao e o editor usam esta mesma funcao).
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
    return t ? { kind: 'quote', text: t, display: t } : { kind: 'blank', text: '', display: '' };
  });
  const toAttribution = (i: number) => {
    parsed[i] = { kind: 'attribution', text: parsed[i].text, display: attributionDisplay(parsed[i].text) };
  };
  // So as linhas FINAIS sao atribuicao, e so depois de alguma citacao. Travessao
  // no meio da epigrafe e dialogo ("— Nao sou nada, disse ele.") e fica como texto.
  let start = parsed.length;
  while (start > 0 && parsed[start - 1].kind === 'quote' && isAttributionLine(parsed[start - 1].text)) start--;
  const hasQuoteBefore = parsed.slice(0, start).some((l) => l.kind === 'quote');
  if (start < parsed.length) {
    if (hasQuoteBefore) for (let i = start; i < parsed.length; i++) toAttribution(i);
    return parsed;
  }
  const lastIndex = parsed.length - 1;
  if (parsed.slice(0, lastIndex).some((l) => l.kind === 'quote') && looksLikeBareAttribution(parsed[lastIndex].text)) {
    toAttribution(lastIndex);
  }
  return parsed;
}
