/**
 * Livro/Parte dentro do manuscrito (ex.: "Livro I – Infancia", como na
 * Republica de Platao). Contrato comum das sessoes de 26/09: doc com
 * `type: 'text'` e `metadata.section_type: 'Part'`, sem coluna nova.
 */

// Quem e Livro/Parte decide `isPart` em ./binderOrder (o mesmo que o Binder usa).

export interface PartTitle {
  /** "Livro I" (vazio se o titulo nao tiver separador). */
  label: string;
  /** "Infancia" (o titulo inteiro se nao houver separador). */
  name: string;
}

// Primeiro " – ", " — " ou " - " com espaco dos dois lados. Hifen sem espaco
// ("Jean-Paul") nao separa.
const SEPARATOR = /\s+[–—-]\s+/;

export function parsePartTitle(title: string | null | undefined): PartTitle {
  const t = (title || '').trim();
  const m = SEPARATOR.exec(t);
  if (!m) return { label: '', name: t };
  const label = t.slice(0, m.index).trim();
  const name = t.slice(m.index + m[0].length).trim();
  if (!label || !name) return { label: '', name: t };
  return { label, name };
}
