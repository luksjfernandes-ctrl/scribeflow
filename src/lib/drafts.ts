import type { Snapshot } from '../types';
import { plainTitle } from './conflict';

/**
 * Rascunho de emergencia: edicao que nao chegou ao banco porque a aba fechou
 * (o PATCH com keepalive pode casar 0 linhas se outra aba gravou no meio), a
 * sessao caiu ou a pessoa saiu da conta sem rede. Fica no localStorage deste
 * navegador e, na proxima vez que o livro abrir, volta como snapshot do doc,
 * sem sobrescrever nada. Sem React nem Supabase (tests/drafts.test.ts).
 */
export interface Draft {
  userId: string;
  docId: string;
  projectId: string;
  payload: Record<string, unknown>;
  at: number;
}

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

const PREFIX = 'scribeflow:rascunho:';
/** Rascunho mais velho que isso e descartado sem virar snapshot. */
export const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const keyOf = (userId: string, docId: string) => `${PREFIX}${userId}:${docId}`;

/** So vale guardar o que tem texto do livro; o resto (ordem, pasta) nao se perde. */
export const hasRecoverableText = (payload: Record<string, unknown>): boolean => typeof payload.content === 'string';

export function saveDraft(storage: DraftStorage, draft: Draft): boolean {
  if (!hasRecoverableText(draft.payload)) return false;
  try {
    storage.setItem(keyOf(draft.userId, draft.docId), JSON.stringify(draft));
    return true;
  } catch {
    return false; // cota cheia ou navegacao privada: o beforeunload ja avisou
  }
}

export function removeDraft(storage: DraftStorage, userId: string, docId: string): void {
  try {
    storage.removeItem(keyOf(userId, docId));
  } catch {
    /* sem storage, nada a remover */
  }
}

/** Rascunhos desta conta neste livro (os vencidos sao apagados aqui). */
export function readDrafts(storage: DraftStorage, userId: string, projectId: string, now: number): Draft[] {
  const out: Draft[] = [];
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith(`${PREFIX}${userId}:`)) keys.push(k);
    }
    for (const k of keys) {
      const raw = storage.getItem(k);
      let d: Draft | null = null;
      try {
        d = raw ? (JSON.parse(raw) as Draft) : null;
      } catch {
        d = null;
      }
      if (!d || typeof d.at !== 'number' || now - d.at > DRAFT_TTL_MS) {
        storage.removeItem(k);
        continue;
      }
      if (d.projectId === projectId) out.push(d);
    }
  } catch {
    return out;
  }
  return out;
}

/**
 * O snapshot que devolve o texto nao enviado, ou null se o banco ja tem esse
 * mesmo texto (o envio da descarga deu certo) ou se nao ha texto a recuperar.
 */
export function recoverySnapshot(
  serverDoc: { title: string; content: string },
  draft: Draft,
  id: string,
): Snapshot | null {
  const content = draft.payload.content;
  if (typeof content !== 'string' || content === serverDoc.content) return null;
  const title = plainTitle(typeof draft.payload.title === 'string' ? draft.payload.title : serverDoc.title) || 'Untitled';
  return { id, timestamp: draft.at, title: `${title} (não salvo ao fechar)`, content };
}
