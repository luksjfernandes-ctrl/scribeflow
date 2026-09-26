import type { Doc } from '../types';

/**
 * Lógica pura do arrastar e soltar do Binder.
 *
 * Fica fora do componente para poder ser testada sem React nem Supabase:
 * dado o estado atual dos docs e onde o item foi solto, devolve a lista de
 * docs cujo `parent_id` ou `order` mudou. Os irmãos afetados (pasta de origem
 * e pasta de destino) são reindexados 0..n-1, sem buracos nem `order` repetido.
 */

export type DropPosition = 'before' | 'after' | 'inside';

export interface OrderUpdate {
  id: string;
  parent_id: string | null;
  order: number;
}

const CONTAINER_TYPES = new Set(['folder', 'research', 'characters', 'places', 'front-matter', 'trash']);

/** Pastas, grupos e pastas estruturais aceitam filhos. */
export const isContainer = (doc: Doc): boolean =>
  CONTAINER_TYPES.has(doc.type) || doc.metadata?.folder_role != null;

/**
 * Ordem estável entre irmãos. Com `order` repetido (dado legado), desempata por
 * data de criação e depois pelo id, para a lista não trocar de lugar a cada recarga.
 */
export const compareSiblings = (a: Doc, b: Doc): number =>
  (a.order ?? 0) - (b.order ?? 0) ||
  (a.metadata?.created_at ?? 0) - (b.metadata?.created_at ?? 0) ||
  a.id.localeCompare(b.id);

export const getSortedChildren = (docs: Doc[], parentId: string | null): Doc[] =>
  docs.filter((d) => d.parent_id === parentId).sort(compareSiblings);

/** Próximo `order` livre numa pasta (máximo + 1, não a contagem de irmãos). */
export const nextOrder = (docs: Doc[], parentId: string | null): number =>
  docs.reduce((max, d) => (d.parent_id === parentId ? Math.max(max, d.order ?? 0) : max), -1) + 1;

export const getDescendantIds = (docs: Doc[], id: string): Set<string> => {
  const result = new Set<string>();
  const stack = [id];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const d of docs) {
      if (d.parent_id === current && !result.has(d.id)) {
        result.add(d.id);
        stack.push(d.id);
      }
    }
  }
  return result;
};

const isInsideTrash = (docs: Doc[], parentId: string | null): boolean => {
  let current = parentId ? docs.find((d) => d.id === parentId) : undefined;
  while (current) {
    if (current.metadata?.folder_role === 'trash') return true;
    current = current.parent_id ? docs.find((d) => d.id === current!.parent_id) : undefined;
  }
  return false;
};

/**
 * Decide a posição pela altura do ponteiro dentro da linha alvo.
 * Em pasta: quarto de cima = antes, quarto de baixo = depois, meio = dentro.
 * Em texto: metade de cima = antes, metade de baixo = depois.
 */
export const getDropPosition = (
  pointerY: number,
  rect: { top: number; height: number },
  targetIsContainer: boolean,
): DropPosition => {
  const ratio = rect.height > 0 ? (pointerY - rect.top) / rect.height : 0.5;
  if (targetIsContainer) {
    if (ratio < 0.25) return 'before';
    if (ratio > 0.75) return 'after';
    return 'inside';
  }
  return ratio < 0.5 ? 'before' : 'after';
};

/**
 * Calcula as mudanças de um drop. Devolve `null` quando o drop é inválido
 * (pasta estrutural, dentro de si mesmo, na lixeira) e `[]` quando nada muda.
 */
export const planDrop = (
  docs: Doc[],
  activeId: string,
  targetId: string,
  position: DropPosition,
): OrderUpdate[] | null => {
  if (activeId === targetId) return null;
  const active = docs.find((d) => d.id === activeId);
  const target = docs.find((d) => d.id === targetId);
  if (!active || !target) return null;

  // Manuscript, Characters, Places, Research e Trash ficam fixos.
  if (active.metadata?.folder_role) return null;
  if (position === 'inside' && !isContainer(target)) return null;

  const newParentId = position === 'inside' ? target.id : target.parent_id;

  // Não pode entrar em si mesmo nem num descendente.
  if (newParentId === active.id || (newParentId && getDescendantIds(docs, active.id).has(newParentId))) {
    return null;
  }

  // Mandar para a lixeira é o "Excluir" (que também tira do compile), não o arraste.
  if (isInsideTrash(docs, newParentId) || (position === 'inside' && target.metadata?.folder_role === 'trash')) {
    return null;
  }

  const destSiblings = getSortedChildren(docs, newParentId).filter((d) => d.id !== active.id);
  let insertAt: number;
  if (position === 'inside') {
    insertAt = destSiblings.length;
  } else {
    const targetIndex = destSiblings.findIndex((d) => d.id === target.id);
    insertAt = position === 'before' ? targetIndex : targetIndex + 1;
  }
  const newDest = [...destSiblings.slice(0, insertAt), active, ...destSiblings.slice(insertAt)];

  const wanted = new Map<string, OrderUpdate>();
  newDest.forEach((d, i) => wanted.set(d.id, { id: d.id, parent_id: newParentId, order: i }));

  if (active.parent_id !== newParentId) {
    getSortedChildren(docs, active.parent_id)
      .filter((d) => d.id !== active.id)
      .forEach((d, i) => wanted.set(d.id, { id: d.id, parent_id: active.parent_id, order: i }));
  }

  const byId = new Map(docs.map((d) => [d.id, d]));
  return [...wanted.values()].filter((u) => {
    const current = byId.get(u.id)!;
    return current.parent_id !== u.parent_id || current.order !== u.order;
  });
};

export const applyOrderUpdates = (docs: Doc[], updates: OrderUpdate[]): Doc[] => {
  if (updates.length === 0) return docs;
  const byId = new Map(updates.map((u) => [u.id, u]));
  return docs.map((d) => {
    const u = byId.get(d.id);
    return u ? { ...d, parent_id: u.parent_id, order: u.order } : d;
  });
};
