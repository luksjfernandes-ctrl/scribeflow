/**
 * Subtitulo do capitulo exibido como epigrafe de livro. O dado continua texto
 * puro em `metadata.subtitle`; aqui so se decide como cada linha aparece.
 *
 * Regra (a exportacao deve seguir a mesma, ver o PR da sf-editor):
 * - linha que comeca com travessao (—), meia-risca (–) ou "--" e a atribuicao
 *   ("— Seneca"): alinhada a direita, sem italico;
 * - as outras linhas sao a citacao: italico, justificado;
 * - linhas em branco separam estrofes/paragrafos da citacao.
 */

export type EpigraphLineKind = 'quote' | 'attribution' | 'blank';

export interface EpigraphLine {
  kind: EpigraphLineKind;
  text: string;
}

const ATTRIBUTION = /^\s*(—|–|--)/;

export function isAttributionLine(line: string): boolean {
  return ATTRIBUTION.test(line);
}

export function parseEpigraph(text: string | null | undefined): EpigraphLine[] {
  if (!text || !text.trim()) return [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  // Linhas em branco nas pontas nao tem funcao visual.
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return lines.map((line) => {
    if (!line.trim()) return { kind: 'blank', text: '' };
    if (isAttributionLine(line)) return { kind: 'attribution', text: line.trim() };
    return { kind: 'quote', text: line.trim() };
  });
}
