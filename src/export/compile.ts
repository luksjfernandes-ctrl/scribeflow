/**
 * Monta o manuscrito a exportar a partir da árvore do binder.
 *
 * Regras (modelo de romance do Scrivener, mais o Livro/Parte):
 * - Só entra o que está dentro da pasta Manuscript, na ordem do binder
 *   (árvore + `order`). Lixeira (via withoutTrash), Research, Characters e
 *   Places nunca entram.
 * - Livro/Parte (`type: 'text'` + `metadata.section_type: 'Part'`) no nível de
 *   cima vira página de título própria; os filhos dele são capítulos.
 * - Capítulo = item filho direto do Manuscript ou de um Livro/Parte (texto ou
 *   pasta). Cada capítulo começa em página nova.
 * - Tudo o que está dentro de um capítulo (cenas, subpastas) segue em fluxo
 *   contínuo, como seção.
 * - `is_include_in_compile` é por item: um item desmarcado não sai, mas os
 *   filhos marcados saem. Se o capítulo desmarcado tiver filhos marcados, o
 *   primeiro deles ainda abre a página nova.
 */
import type { Doc } from '../types';
import { compareSiblings, isPart } from '../lib/binderOrder';
import { withoutTrash } from '../lib/trash';
import { Block, parseHtml, trimEmptyBlocks } from './html';
import { parseEpigraph, type EpigraphLine } from '../lib/epigraph';
import { parsePartTitle } from '../lib/part';

/** Linhas da epígrafe na ordem digitada: citação, linha em branco (estrofe) e atribuição. */
export interface Epigraph {
  lines: EpigraphLine[];
}

export type CompileKind = 'part' | 'chapter' | 'section';

export interface CompileItem {
  id: string;
  kind: CompileKind;
  title: string;
  /** Livro/Parte: "Livro I – Infância" → rótulo "Livro I", nome "Infância". */
  label?: string;
  name?: string;
  /** Profundidade da seção dentro do capítulo (1 = filho direto). */
  depth: number;
  /** Primeiro item de um capítulo ou Livro: começa em página nova. */
  startsPage: boolean;
  epigraph: Epigraph | null;
  blocks: Block[];
}

export interface Manuscript {
  title: string;
  items: CompileItem[];
}

const EXPORTABLE_TYPES = new Set(['text', 'folder']);
const NON_MANUSCRIPT_ROLES = new Set(['characters', 'places', 'research', 'trash']);

const isIncluded = (d: Doc): boolean => !!d.metadata?.is_include_in_compile;

/**
 * Epígrafe (subtítulo) pela regra única do app, a mesma do editor:
 * src/lib/epigraph.ts. Vazio vira null.
 */
export const epigraphOf = (subtitle: string | null | undefined): Epigraph | null => {
  const lines = parseEpigraph(subtitle);
  return lines.length ? { lines } : null;
};

/** Raízes do manuscrito: filhos da pasta Manuscript, ou (projeto antigo sem ela) as raízes que não são estruturais. */
const manuscriptRoots = (docs: Doc[]): { parentId: string | null; roots: Doc[] } => {
  const manuscript = docs.find((d) => d.metadata?.folder_role === 'manuscript');
  if (manuscript) return { parentId: manuscript.id, roots: children(docs, manuscript.id) };
  const roots = children(docs, null).filter(
    (d) => d.type !== 'trash' && !NON_MANUSCRIPT_ROLES.has(d.metadata?.folder_role ?? ''),
  );
  return { parentId: null, roots };
};

const children = (docs: Doc[], parentId: string | null): Doc[] =>
  docs.filter((d) => d.parent_id === parentId && EXPORTABLE_TYPES.has(d.type)).sort(compareSiblings);

export const compileManuscript = (allDocs: Doc[], projectTitle: string): Manuscript => {
  // A lixeira sai antes de tudo, em qualquer profundidade (filho de pasta
  // apagada continua com is_include_in_compile: true).
  const docs = withoutTrash(allDocs);
  const items: CompileItem[] = [];
  const seen = new Set<string>();

  const makeItem = (d: Doc, kind: CompileKind, depth: number, startsPage: boolean): CompileItem => {
    const base: CompileItem = {
      id: d.id,
      kind,
      title: d.title?.trim() || '',
      depth,
      startsPage,
      epigraph: epigraphOf(d.metadata?.subtitle),
      blocks: d.type === 'text' ? trimEmptyBlocks(parseHtml(d.content)) : [],
    };
    if (kind === 'part') {
      // Mesma divisão do editor (src/lib/part.ts): "Livro I – Infância" → rótulo + nome.
      const { label, name } = parsePartTitle(base.title);
      base.name = name;
      if (label) base.label = label;
    }
    return base;
  };

  /** Seções dentro de um capítulo. Devolve se já emitiu algo (para a quebra de página). */
  const walkSections = (parentId: string, depth: number, pendingBreak: boolean): boolean => {
    for (const d of children(docs, parentId)) {
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      if (isIncluded(d)) {
        items.push(makeItem(d, 'section', depth, pendingBreak));
        pendingBreak = false;
      }
      pendingBreak = walkSections(d.id, depth + 1, pendingBreak);
    }
    return pendingBreak;
  };

  const walkTop = (list: Doc[]) => {
    for (const d of list) {
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      if (isPart(d)) {
        if (isIncluded(d)) items.push(makeItem(d, 'part', 0, true));
        walkTop(children(docs, d.id));
        continue;
      }
      let pending = true;
      if (isIncluded(d)) {
        items.push(makeItem(d, 'chapter', 0, true));
        pending = false;
      }
      walkSections(d.id, 1, pending);
    }
  };

  walkTop(manuscriptRoots(docs).roots);
  return { title: projectTitle.trim() || 'Manuscrito', items };
};

/** Nome de arquivo sem acento nem símbolo, que abre em qualquer sistema. */
export const safeFileName = (name: string | undefined): string => {
  const base = (name || 'manuscrito')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
  return base || 'manuscrito';
};
