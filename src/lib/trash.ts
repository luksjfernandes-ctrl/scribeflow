import type { Doc } from '../types';
import { isContainer } from './binderOrder';

/**
 * Regras da lixeira, fora do componente para poder testar sem React nem Supabase.
 *
 * Mandar para a lixeira move SÓ o item escolhido: os filhos de uma pasta vão
 * junto porque continuam apontando para ela. Assim a estrutura sobrevive e o
 * "Restaurar" devolve tudo de uma vez.
 */

/** Onde o item estava antes de ir para a lixeira, para o "Restaurar". */
export interface TrashOrigin {
  parent_id: string | null;
  order: number;
  is_include_in_compile: boolean;
}

export const trashFolderOf = (docs: Doc[]): Doc | undefined =>
  docs.find((d) => d.metadata?.folder_role === 'trash');

/** A própria lixeira ou qualquer item dentro dela, em qualquer profundidade. */
export const isInTrash = (docs: Doc[], id: string): boolean => {
  const byId = new Map(docs.map((d) => [d.id, d]));
  const seen = new Set<string>();
  let current = byId.get(id);
  while (current && !seen.has(current.id)) {
    if (current.metadata?.folder_role === 'trash') return true;
    seen.add(current.id);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return false;
};

/** Docs fora da lixeira: é o que busca, estatísticas e contagem de palavras enxergam. */
export const withoutTrash = (docs: Doc[]): Doc[] => docs.filter((d) => !isInTrash(docs, d.id));

/**
 * Pasta para onde o item volta ao restaurar: a de origem, se ainda existir fora
 * da lixeira e aceitar filhos; senão a raiz do Manuscript (ou a raiz do Binder).
 */
export const restoreParentId = (docs: Doc[], origin: TrashOrigin | undefined): string | null => {
  const originParent = origin?.parent_id ? docs.find((d) => d.id === origin.parent_id) : undefined;
  if (originParent && isContainer(originParent) && !isInTrash(docs, originParent.id)) return originParent.id;
  if (origin && origin.parent_id === null) return null;
  return docs.find((d) => d.metadata?.folder_role === 'manuscript')?.id ?? null;
};
