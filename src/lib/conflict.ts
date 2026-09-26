import type { DocumentMetadata, Snapshot } from '../types';

/**
 * Duas abas (ou dois aparelhos) no mesmo documento.
 *
 * A gravação é condicional à versão (`updated_at`) de onde a aba partiu. Se
 * outra aba gravou no meio, a aba relê o banco e junta as duas versões antes de
 * gravar de novo:
 * - corpo: vence a última gravação; a versão da outra aba vira um snapshot;
 * - título: vence a última gravação; o título da outra aba vai para as notas;
 * - metadata: junção de três vias, campo a campo (base = versão de onde a aba
 *   partiu). Campo que só uma aba mudou fica com a mudança. Campo de texto que
 *   as duas mudaram fica com a última gravação, e o texto perdedor vai para o
 *   fim das notas. Listas (comentários, marcadores, palavras-chave, snapshots)
 *   se juntam por id; item apagado por uma aba só volta se a outra o editou.
 * Nenhum texto some.
 */

/** Versão do banco de onde a aba partiu. */
export interface DocBase {
  updatedAt: number | null;
  title: string;
  content: string;
  metadata: Partial<DocumentMetadata>;
}

/** Texto que perdeu a disputa e vai para as notas. */
export interface LostText {
  field: string;
  text: string;
}

const plain = (html: string | null | undefined) =>
  (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/** O que está no banco agora é texto de outra aba, diferente da base e do nosso? */
export const needsConflictSnapshot = (baseContent: string, currentContent: string | null | undefined, ours: string): boolean =>
  plain(currentContent) !== '' && plain(currentContent) !== plain(baseContent) && plain(currentContent) !== plain(ours);

export const conflictSnapshot = (title: string, content: string, id: string, now: number): Snapshot => ({
  id,
  timestamp: now,
  title: `${title || 'Untitled'} (versão de outra aba)`,
  content,
});

/** Igualdade estrutural que não depende da ordem das chaves (o jsonb reordena). */
const stable = (v: unknown): string =>
  JSON.stringify(v, (_k, val) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.keys(val as object).sort().reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (val as Record<string, unknown>)[k];
          return acc;
        }, {})
      : val,
  ) ?? 'undefined';
const same = (a: unknown, b: unknown) => stable(a) === stable(b);

/**
 * O trecho que só a outra aba tem: tira as palavras iguais do começo e do fim.
 * O que é comum já está na versão vencedora; guardar o campo inteiro de novo
 * só duplicaria texto (nas notas, a cada disputa). Vazio = a outra aba só apagou.
 */
export const theirsOnly = (ours: string, theirs: string): string => {
  const o = (ours || '').split(/(\s+)/);
  const t = (theirs || '').split(/(\s+)/);
  let i = 0;
  while (i < o.length && i < t.length && o[i] === t[i]) i++;
  let j = 0;
  while (j < o.length - i && j < t.length - i && o[o.length - 1 - j] === t[t.length - 1 - j]) j++;
  return t.slice(i, t.length - j).join('').trim();
};

const keep = (lost: LostText[], field: string, ours: unknown, theirs: unknown) => {
  const text = theirsOnly(typeof ours === 'string' ? ours : '', typeof theirs === 'string' ? theirs : '');
  if (text) lost.push({ field, text });
};

/** Campos de texto livre: se as duas abas mudaram, o perdedor vai para as notas. */
const TEXT_FIELDS: Record<string, string> = { subtitle: 'subtítulo', synopsis: 'sinopse', notes: 'notas' };

type Item = Record<string, unknown>;
interface ListRule {
  key: (item: Item) => string;
  /** Texto do item que não pode sumir quando as duas abas o editaram. */
  text?: (item: Item) => string;
  label: string;
}
const LIST_FIELDS: Record<string, ListRule> = {
  comments: { key: (i) => String(i.id), text: (i) => String(i.text ?? ''), label: 'comentário' },
  bookmarks: { key: (i) => String(i.id), text: (i) => String(i.title ?? ''), label: 'marcador' },
  keywords: { key: (i) => String(i.text), label: 'palavra-chave' },
  snapshots: { key: (i) => String(i.id), label: 'snapshot' },
};

/** Três vias para um valor: quem mudou vence; as duas mudaram, vence o nosso. */
const pick = <T,>(base: T, ours: T, theirs: T): { value: T; conflict: boolean } => {
  if (same(ours, theirs)) return { value: ours, conflict: false };
  if (same(ours, base)) return { value: theirs, conflict: false };
  if (same(theirs, base)) return { value: ours, conflict: false };
  return { value: ours, conflict: true };
};

const mergeList = (rule: ListRule, base: Item[], ours: Item[], theirs: Item[], lost: LostText[]): Item[] => {
  const byKey = (list: Item[]) => new Map(list.map((i) => [rule.key(i), i]));
  const b = byKey(base);
  const o = byKey(ours);
  const t = byKey(theirs);
  // Ordem: a nossa lista, depois os itens que só a outra aba tem.
  const keys = [...o.keys(), ...[...t.keys()].filter((k) => !o.has(k))];
  const out: Item[] = [];
  for (const k of keys) {
    const bi = b.get(k);
    const oi = o.get(k);
    const ti = t.get(k);
    if (oi && ti) {
      const r = pick(bi, oi, ti);
      out.push(r.value as Item);
      if (r.conflict && rule.text) {
        keep(lost, rule.label, rule.text(oi), rule.text(ti));
      }
    } else if (oi) {
      // A outra aba não tem: ou é novo nosso, ou ela apagou. Apagado e não
      // editado por nós sai; editado por nós fica (não perder texto).
      if (!bi || !same(bi, oi)) out.push(oi);
    } else if (ti) {
      if (!bi || !same(bi, ti)) out.push(ti);
    }
  }
  return out;
};

const mergeRecord = (
  base: Record<string, string>,
  ours: Record<string, string>,
  theirs: Record<string, string>,
  lost: LostText[],
): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const k of new Set([...Object.keys(base), ...Object.keys(ours), ...Object.keys(theirs)])) {
    const r = pick(base[k], ours[k], theirs[k]);
    if (r.conflict) keep(lost, `campo "${k}"`, ours[k], theirs[k]);
    if (r.value !== undefined) out[k] = r.value;
  }
  return out;
};

/** Junção de três vias do metadata. `ours` é a versão que vence em disputa. */
export const mergeMetadata = (
  base: Partial<DocumentMetadata> | null | undefined,
  ours: Partial<DocumentMetadata> | null | undefined,
  theirs: Partial<DocumentMetadata> | null | undefined,
): { merged: DocumentMetadata; lost: LostText[] } => {
  const B = (base || {}) as Record<string, unknown>;
  const O = (ours || {}) as Record<string, unknown>;
  const T = (theirs || {}) as Record<string, unknown>;
  const lost: LostText[] = [];
  const out: Record<string, unknown> = {};
  for (const k of new Set([...Object.keys(B), ...Object.keys(O), ...Object.keys(T)])) {
    if (k === 'updated_at') {
      out[k] = Math.max(Number(O[k]) || 0, Number(T[k]) || 0);
    } else if (LIST_FIELDS[k]) {
      const arr = (v: unknown) => (Array.isArray(v) ? (v as Item[]) : []);
      out[k] = mergeList(LIST_FIELDS[k], arr(B[k]), arr(O[k]), arr(T[k]), lost);
    } else if (k === 'custom_metadata') {
      const rec = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, string>) : {});
      out[k] = mergeRecord(rec(B[k]), rec(O[k]), rec(T[k]), lost);
    } else {
      const r = pick(B[k], O[k], T[k]);
      if (r.conflict && TEXT_FIELDS[k]) keep(lost, TEXT_FIELDS[k], O[k], T[k]);
      if (r.value !== undefined) out[k] = r.value;
    }
  }
  return { merged: out as unknown as DocumentMetadata, lost };
};

/** Põe o trecho perdedor no fim das notas, com rótulo. `stamp` ex.: "26/09 21:03". */
export const appendLostToNotes = (meta: DocumentMetadata, lost: LostText[], stamp: string): DocumentMetadata => {
  if (lost.length === 0) return meta;
  const blocks = lost.map((l) => `[Trecho de outra aba · ${l.field} · ${stamp}]\n${l.text}`);
  const notes = [meta.notes || '', ...blocks].filter((s) => s.trim() !== '').join('\n\n');
  return { ...meta, notes };
};

/** O que a aba ia gravar (só os campos presentes entram na disputa). */
export interface OursFields {
  title?: string;
  content?: string;
  metadata?: Partial<DocumentMetadata>;
}

/**
 * Junta o que esta aba ia gravar com o que está no banco agora (`current`),
 * partindo de `base`. Título e corpo continuam os nossos; o metadata sai
 * juntado, com o snapshot do corpo da outra aba e os textos perdedores nas
 * notas, quando houver.
 */
export const resolveConflict = (args: {
  base: DocBase;
  ours: OursFields;
  current: { title: string; content: string; metadata: Partial<DocumentMetadata> | null };
  snapshotId: string;
  now: number;
  stamp: string;
}): { metadata: DocumentMetadata; lost: LostText[]; snapshot: Snapshot | null } => {
  const { base, ours, current } = args;
  const { merged, lost } = ours.metadata
    ? mergeMetadata(base.metadata, ours.metadata, current.metadata)
    : { merged: { ...(current.metadata || {}) } as DocumentMetadata, lost: [] as LostText[] };

  if (ours.title !== undefined && current.title !== base.title && current.title !== ours.title) {
    keep(lost, 'título', ours.title, current.title);
  }

  let snapshot: Snapshot | null = null;
  let metadata = merged;
  if (ours.content !== undefined && needsConflictSnapshot(base.content, current.content, ours.content)) {
    snapshot = conflictSnapshot(current.title, current.content, args.snapshotId, args.now);
    metadata = { ...metadata, snapshots: [snapshot, ...(metadata.snapshots || [])] };
  }
  return { metadata: appendLostToNotes(metadata, lost, args.stamp), lost, snapshot };
};
