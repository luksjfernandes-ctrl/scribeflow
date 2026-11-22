import type { Doc } from '../types';
import { decodeEntities } from '../export/html';

/** Tags que separam palavras: fim de parágrafo, título, item, quebra de linha. */
const BLOCK_TAG = /<\/?(?:p|div|h[1-6]|li|ul|ol|blockquote|pre|hr|br|tr|td|th)\b[^>]*>/gi;

/**
 * Texto puro de um HTML do TipTap, para busca, estatísticas e contagem.
 *
 * Uma regra só para o app inteiro. Antes, cada tela tinha a sua:
 * - o Binder apagava as tags e grudava a última palavra de um parágrafo na
 *   primeira do seguinte ("mundo</p><p>Adeus" virava uma palavra);
 * - as outras telas trocavam toda tag por espaço, e "pala<strong>vra</strong>"
 *   virava duas palavras, que a busca por "palavra" não achava;
 * - nenhuma decodificava entidades: "&" é gravado como "&amp;", então a busca
 *   por "tom & jerry" não achava nada, e "amp" entrava nas palavras mais usadas.
 */
export const htmlToText = (html: string | null | undefined): string =>
  decodeEntities((html || '').replace(BLOCK_TAG, ' ').replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();

/** Palavras de um HTML do TipTap. */
export const countWords = (html: string | null | undefined): number => {
  const text = htmlToText(html);
  return text ? text.split(' ').length : 0;
};

/** Busca do Binder: título, sinopse ou texto. O termo é aparado, como na busca
 *  rápida (⌘O): "prólogo " com espaço no fim não achava "Prólogo". */
export const matchesSearch = (doc: Pick<Doc, 'title' | 'content' | 'metadata'>, query: string): boolean => {
  const q = query.trim().toLowerCase();
  return (
    doc.title.toLowerCase().includes(q) ||
    (doc.metadata?.synopsis || '').toLowerCase().includes(q) ||
    htmlToText(doc.content).toLowerCase().includes(q)
  );
};
