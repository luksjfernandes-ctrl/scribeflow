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
