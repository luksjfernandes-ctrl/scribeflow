import type { Doc } from '../types';
import { getSortedChildren, isContainer } from './binderOrder';

/** Palavras de um HTML do TipTap (mesma regra das Estatísticas e do Binder). */
export const countWords = (html: string | null | undefined): number =>
  (html || '').replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;

/**
 * Subárvore de `rootId` achatada na ordem do Binder (profundidade primeiro, irmãos
 * por `order`). A raiz vem primeiro. Serve ao Scrivenings: um Livro traz os
 * capítulos e as cenas das pastas; o Manuscript traz tudo o que está dentro dele.
 */
export const flattenSubtree = (docs: Doc[], rootId: string): Doc[] => {
  const root = docs.find((d) => d.id === rootId);
  if (!root) return [];
  const out: Doc[] = [];
  const seen = new Set<string>();
  const visit = (doc: Doc) => {
    if (seen.has(doc.id)) return; // defesa contra ciclo em dado corrompido
    seen.add(doc.id);
    out.push(doc);
    for (const child of getSortedChildren(docs, doc.id)) visit(child);
  };
  visit(root);
  return out;
};

/** Palavras do próprio doc somadas às de todos os descendentes. */
export const subtreeWords = (docs: Doc[], rootId: string): number =>
  flattenSubtree(docs, rootId).reduce((acc, d) => acc + (d.type === 'text' ? countWords(d.content) : 0), 0);

/** Contagem que o Outliner mostra: pastas e Livros/Partes somam os descendentes. */
export const outlineWords = (docs: Doc[], doc: Doc): number =>
  isContainer(doc) ? subtreeWords(docs, doc.id) : countWords(doc.content);
