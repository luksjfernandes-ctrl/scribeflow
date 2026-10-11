/**
 * Nomes em portugues para os valores de status e rotulo gravados no metadata
 * dos docs ('To Do', 'red'...). So o texto da tela e traduzido: o valor gravado
 * continua o mesmo, porque os livros que ja existem guardam esses valores e o
 * app compara com eles. Sem React (tests/metadata-labels.test.ts).
 */

export const STATUS_OPTIONS = [
  { value: 'To Do', label: 'A fazer' },
  { value: 'First Draft', label: 'Primeiro rascunho' },
  { value: 'Revised Draft', label: 'Rascunho revisado' },
  { value: 'Final Draft', label: 'Versão final' },
] as const;

/** Rotulos que o Inspector e o Outliner oferecem. */
export const LABEL_OPTIONS = [
  { value: 'none', label: 'Sem rótulo' },
  { value: 'red', label: 'Capítulo' },
  { value: 'green', label: 'Cena' },
  { value: 'blue', label: 'Pesquisa' },
  { value: 'yellow', label: 'Nota' },
] as const;

/**
 * Tipos de secao. 'Part' e o que faz um texto virar Livro/Parte (isPart, na
 * estrutura e na exportacao): por isso o Inspector oferece uma lista, e nao um
 * campo livre onde "Parte" gravaria um valor que o app nao reconhece.
 */
export const SECTION_OPTIONS = [
  { value: 'Scene', label: 'Cena' },
  { value: 'Part', label: 'Livro / Parte' },
  { value: 'Heading', label: 'Título' },
] as const;

/** Cores que nao estao no menu mas podem vir de livros antigos (LABEL_COLORS). */
const LEGACY_LABELS: Record<string, string> = { orange: 'Nota', purple: 'Ideia' };

const STATUS_NAMES: Record<string, string> = Object.fromEntries(STATUS_OPTIONS.map((o) => [o.value, o.label]));
const LABEL_NAMES: Record<string, string> = {
  ...Object.fromEntries(LABEL_OPTIONS.map((o) => [o.value, o.label])),
  ...LEGACY_LABELS,
};

/** Nome do status na tela; valor desconhecido aparece como esta gravado. */
export const statusName = (value: string | null | undefined): string =>
  !value ? 'Sem status' : STATUS_NAMES[value] ?? value;

/** Nome do rotulo na tela; sem rotulo ou cor desconhecida vira "Sem rótulo". */
export const labelName = (value: string | null | undefined): string =>
  (value && LABEL_NAMES[value]) || LABEL_NAMES.none;

const SECTION_NAMES: Record<string, string> = Object.fromEntries(SECTION_OPTIONS.map((o) => [o.value, o.label]));

/** Nome do tipo de secao na tela; valor desconhecido aparece como esta gravado. */
export const sectionName = (value: string | null | undefined): string =>
  !value ? 'Sem tipo' : SECTION_NAMES[value] ?? value;

/** "1 palavra", "2 palavras", "1.234 palavras". */
export const quantos = (n: number, singular: string, plural: string): string =>
  `${n.toLocaleString('pt-BR')} ${n === 1 ? singular : plural}`;
